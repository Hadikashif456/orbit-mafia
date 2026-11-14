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

import sqlite3
from pathlib import Path
from typing import List

from app.config import settings
from app.models import VitalPoint, Biomarker


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


def get_biomarkers(crew_id: str) -> List[Biomarker]:
    """Retrieves blood biomarkers for astronaut across NASA OSDR timepoints in chronological order."""
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

    return [
        Biomarker(
            crewId=r["crew_id"],
            timepoint=r["timepoint"],
            panel=r["panel"],
            name=r["name"],
            value=r["value"],
            unit=r["unit"] or "",
            refMin=r["ref_min"],
            refMax=r["ref_max"],
            provenance=r["provenance"],
        )
        for r in rows
    ]


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
