"""Data access layer for Orbit Mafia AI services.

Contract:
- Queries SQLite read-only via URI 'file:<DB_PATH>?mode=ro'.
- Parameterized queries only; no dynamic SQL concatenation.
- get_vitals_history returns the union of Sol 1-14 baseline and [sol-window+1 .. sol], sorted by sol ascending without duplicates.
- get_biomarkers returns biomarkers ordered chronologically (L-92, L-44, L-3, R+1, R+45, R+82, R+194) then by analyte name.
- get_vitals_window returns exactly `window` vitals points ending at `sol` (fewer only if sol < window).
- If database file or tables are missing or inaccessible, raises DataUnavailableError without exposing internal file paths.
- Never falls back to fake or hardcoded mock data.
"""

import re
import sqlite3
from pathlib import Path
from typing import List, Optional

from app.config import settings
from app.models import VitalPoint, Biomarker

# Panel priority for CRI inflammation engine:
# For each canonical marker (IL-6, CRP, Fibrinogen), feed the CRI only ONE panel.
# Priority: CARDIO_EVE (Eve panel in pg/mL / ng/mL) > IMMUNE_HD71 (pg/mL) > INFLAMMATION_ALAMAR (NPQ) > CMP.
CRI_PANEL_PRIORITY = {
    "CARDIO_EVE": 1,
    "IMMUNE_HD71": 2,
    "INFLAMMATION_ALAMAR": 3,
    "CMP": 4,
}


def normalize_analyte_name(name: str) -> str:
    """Normalizes analyte name to canonical form so cri_engine finds exact matches.

    "Il 6", "Il6", and "IL-6" -> "IL-6"
    "CRP" -> "CRP"
    "FIBRINOGEN" -> "Fibrinogen"
    """
    clean = re.sub(r"[\s\-_]", "", name).upper()
    if clean == "IL6":
        return "IL-6"
    if clean == "CRP":
        return "CRP"
    if clean == "FIBRINOGEN":
        return "Fibrinogen"
    return name


class DataUnavailableError(Exception):
    """Raised when the database file or requested table is unavailable."""
    pass


def _get_connection() -> sqlite3.Connection:
    db_path = Path(settings.DB_PATH)
    if not db_path.exists():
        repo_root = Path(__file__).resolve().parents[3]
        cand = repo_root / "backend" / db_path
        if cand.exists():
            db_path = cand
        else:
            cand2 = repo_root / db_path
            if cand2.exists():
                db_path = cand2
            else:
                raise DataUnavailableError("Database service is unavailable")
    uri = f"file:{db_path.resolve().as_posix()}?mode=ro"
    try:
        conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception:
        raise DataUnavailableError("Database service is unavailable") from None


def get_vitals_history(crew_id: str, sol: int, window: int = 14) -> List[VitalPoint]:
    """Retrieves physiological vitals for crew member up to sol across window, plus baseline (Sol 1-14)."""
    conn = _get_connection()
    start_sol = max(1, sol - window + 1)
    query = """
        SELECT crew_id, sol, hr, hrv, sleep_hours, radiation_msv, exercise_min, mood, provenance
        FROM vitals
        WHERE crew_id = ? AND ((sol BETWEEN 1 AND 14) OR (sol BETWEEN ? AND ?))
        ORDER BY sol ASC
    """
    try:
        cursor = conn.execute(query, (crew_id, start_sol, sol))
        rows = cursor.fetchall()
    except sqlite3.OperationalError:
        raise DataUnavailableError("Database service is unavailable") from None
    finally:
        conn.close()

    results: List[VitalPoint] = []
    seen_sols = set()
    for r in rows:
        s = r["sol"]
        if s in seen_sols:
            continue
        seen_sols.add(s)
        results.append(
            VitalPoint(
                crewId=r["crew_id"],
                sol=s,
                hr=r["hr"],
                hrv=r["hrv"],
                sleepHours=r["sleep_hours"],
                radiationMsv=r["radiation_msv"],
                exerciseMin=r["exercise_min"],
                mood=r["mood"],
                provenance=r["provenance"],
            )
        )
    return results


def get_biomarkers(
    crew_id: str,
    panel: Optional[str] = None,
    names: Optional[List[str]] = None,
    for_cri: bool = False,
) -> List[Biomarker]:
    """Retrieves blood biomarkers for astronaut across NASA OSDR timepoints in chronological order.

    Normalizes analyte names to canonical form before rows reach cri_engine ("Il 6", "Il6", "IL-6" -> "IL-6").
    Dedupes identical rows within the same panel and unit.
    For CRI (for_cri=True), selects only one preferred panel per canonical marker (CARDIO_EVE > IMMUNE_HD71 > INFLAMMATION_ALAMAR > CMP).
    For router filtering:
      - Default (panel=None, names=None): short list of CRP, Fibrinogen plus the CMP panel.
      - panel='all': all panels returned.
      - panel=<panel_name>: filtered to that specific panel.
      - names=[...]: filtered to matching analytes (case/space/dash insensitive).
    """
    conn = _get_connection()
    query = """
        SELECT crew_id, timepoint, panel, name, value, unit, ref_min, ref_max, provenance
        FROM biomarkers
        WHERE crew_id = ?
        ORDER BY
            CASE timepoint
                WHEN 'L-92' THEN 1
                WHEN 'L-44' THEN 2
                WHEN 'L-3' THEN 3
                WHEN 'R+1' THEN 4
                WHEN 'R+45' THEN 5
                WHEN 'R+82' THEN 6
                WHEN 'R+194' THEN 7
                ELSE 8
            END ASC,
            name ASC
    """
    try:
        cursor = conn.execute(query, (crew_id,))
        rows = cursor.fetchall()
    except sqlite3.OperationalError:
        raise DataUnavailableError("Database service is unavailable") from None
    finally:
        conn.close()

    # Determine preferred panel per canonical marker for CRI
    chosen_cri_panels = {}
    if for_cri:
        for r in rows:
            c_name = normalize_analyte_name(r["name"])
            c_upper = c_name.strip().upper()
            if c_upper in ("CRP", "FIBRINOGEN", "IL-6"):
                p = r["panel"]
                curr = chosen_cri_panels.get(c_upper)
                if curr is None or CRI_PANEL_PRIORITY.get(p, 99) < CRI_PANEL_PRIORITY.get(curr, 99):
                    chosen_cri_panels[c_upper] = p

    norm_names = {re.sub(r"[\s\-_]", "", n).upper() for n in names} if names else None

    results: List[Biomarker] = []
    seen = set()
    for r in rows:
        c_name = normalize_analyte_name(r["name"])
        c_upper = c_name.strip().upper()
        p = r["panel"]
        u = r["unit"] or ""

        if for_cri:
            # Feed CRI only one panel per canonical marker
            if c_upper in chosen_cri_panels and p != chosen_cri_panels[c_upper]:
                continue
        else:
            if panel is None and norm_names is None:
                # Default: CRP, Fibrinogen plus CMP panel
                if p != "CMP" and c_upper not in ("CRP", "FIBRINOGEN"):
                    continue
            else:
                if panel and panel != "all" and p != panel:
                    continue
                if norm_names is not None and re.sub(r"[\s\-_]", "", c_name).upper() not in norm_names:
                    continue

        # Dedupe only identical rows within the same panel and unit
        dedupe_key = (r["timepoint"], p, c_name, u, r["value"])
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        results.append(
            Biomarker(
                crewId=r["crew_id"],
                timepoint=r["timepoint"],
                panel=p,
                name=c_name,
                value=r["value"],
                unit=u,
                refMin=r["ref_min"],
                refMax=r["ref_max"],
                provenance=r["provenance"],
            )
        )

    timepoint_order = {
        "L-92": 1,
        "L-44": 2,
        "L-3": 3,
        "R+1": 4,
        "R+45": 5,
        "R+82": 6,
        "R+194": 7,
    }
    results.sort(key=lambda b: (timepoint_order.get(b.timepoint, 8), b.name))
    return results


def get_vitals_window(crew_id: str, sol: int, window: int) -> List[VitalPoint]:
    """Retrieves exactly window vitals points ending at sol (fewer only if sol < window)."""
    conn = _get_connection()
    query = """
        SELECT crew_id, sol, hr, hrv, sleep_hours, radiation_msv, exercise_min, mood, provenance
        FROM vitals
        WHERE crew_id = ? AND sol <= ?
        ORDER BY sol DESC
        LIMIT ?
    """
    try:
        cursor = conn.execute(query, (crew_id, sol, window))
        rows = cursor.fetchall()
    except sqlite3.OperationalError:
        raise DataUnavailableError("Database service is unavailable") from None
    finally:
        conn.close()

    rows = sorted(rows, key=lambda r: r["sol"])
    return [
        VitalPoint(
            crewId=r["crew_id"],
            sol=r["sol"],
            hr=r["hr"],
            hrv=r["hrv"],
            sleepHours=r["sleep_hours"],
            radiationMsv=r["radiation_msv"],
            exerciseMin=r["exercise_min"],
            mood=r["mood"],
            provenance=r["provenance"],
        )
        for r in rows
    ]
