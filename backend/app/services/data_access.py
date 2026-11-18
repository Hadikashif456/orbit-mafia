"""Data access layer for Orbit Mafia AI services.

Contract:
- Queries SQLite read-only via URI 'file:<DB_PATH>?mode=ro'.
- Parameterized queries only; no dynamic SQL concatenation.
- get_vitals_history returns the union of Sol 1-14 baseline and [sol-window+1 .. sol], sorted by sol ascending without duplicates.
- get_biomarkers returns biomarkers ordered chronologically (L-92, L-44, L-3, R+1, R+45, R+82, R+194) then by analyte name.
- get_vitals_window returns exactly `window` vitals points ending at `sol` (fewer only if sol < window).
- If database file or tables are missing or inaccessible, raises DataUnavailableError without exposing internal file paths.
- Never falls back to fake or hardcoded mock data.
- Read-only results are cached in memory keyed by (resolved DB path, file mtime_ns) so repeat API calls respond in milliseconds while remaining 100% isolated across tests and DB updates.
"""

from functools import lru_cache
import re
import sqlite3
from pathlib import Path
from typing import List, Optional, Tuple

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


def _resolve_db_path() -> Path:
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
    return db_path.resolve()


def _db_cache_key() -> Tuple[str, int]:
    resolved = _resolve_db_path()
    try:
        mtime_ns = resolved.stat().st_mtime_ns
    except OSError:
        raise DataUnavailableError("Database service is unavailable") from None
    return (resolved.as_posix(), mtime_ns)


def _get_connection(resolved_posix: Optional[str] = None) -> sqlite3.Connection:
    posix = resolved_posix if resolved_posix is not None else _resolve_db_path().as_posix()
    uri = f"file:{posix}?mode=ro"
    try:
        conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception:
        raise DataUnavailableError("Database service is unavailable") from None


@lru_cache(maxsize=64)
def _load_crew_vitals(db_posix: str, mtime_ns: int, crew_id: str) -> Tuple[VitalPoint, ...]:
    """Loads all vitals rows for a crew member from read-only SQLite, sorted ascending by sol."""
    _ = mtime_ns
    conn = _get_connection(db_posix)
    query = """
        SELECT crew_id, sol, hr, hrv, sleep_hours, radiation_msv, exercise_min, mood, provenance
        FROM vitals
        WHERE crew_id = ?
        ORDER BY sol ASC
    """
    try:
        cursor = conn.execute(query, (crew_id,))
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
    return tuple(results)


def get_vitals_history(crew_id: str, sol: int, window: int = 14) -> List[VitalPoint]:
    """Retrieves physiological vitals for crew member up to sol across window, plus baseline (Sol 1-14)."""
    db_posix, mtime_ns = _db_cache_key()
    all_vitals = _load_crew_vitals(db_posix, mtime_ns, crew_id)
    start_sol = max(1, sol - window + 1)
    return [
        v for v in all_vitals
        if (1 <= v.sol <= 14) or (start_sol <= v.sol <= sol)
    ]


@lru_cache(maxsize=128)
def _load_crew_biomarkers(
    db_posix: str,
    mtime_ns: int,
    crew_id: str,
    panel: Optional[str],
    norm_names_key: Optional[Tuple[str, ...]],
    for_cri: bool,
) -> Tuple[Biomarker, ...]:
    _ = mtime_ns
    conn = _get_connection(db_posix)
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

    norm_names = set(norm_names_key) if norm_names_key is not None else None

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
    return tuple(results)


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
    db_posix, mtime_ns = _db_cache_key()
    norm_names_key = (
        tuple(sorted({re.sub(r"[\s\-_]", "", n).upper() for n in names}))
        if names is not None
        else None
    )
    return list(_load_crew_biomarkers(db_posix, mtime_ns, crew_id, panel, norm_names_key, for_cri))


def get_vitals_window(crew_id: str, sol: int, window: int) -> List[VitalPoint]:
    """Retrieves exactly window vitals points ending at sol (fewer only if sol < window)."""
    db_posix, mtime_ns = _db_cache_key()
    all_vitals = _load_crew_vitals(db_posix, mtime_ns, crew_id)
    eligible = [v for v in all_vitals if v.sol <= sol]
    return eligible[-window:] if window > 0 else []
