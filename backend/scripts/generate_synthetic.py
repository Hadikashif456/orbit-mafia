"""NASA synthetic vitals generator. B1 job, Hour 3-8. Hadi.

Generates seeded synthetic daily vitals for 4 crew, Sol 1-145, and writes
them into the SQLite table `vitals` in data/processed/orbit_mafia.db
(the same db the ingest script writes the `biomarkers` table into).

Run from the repo root:
    python backend/scripts/generate_synthetic.py

Provenance: every row is SYNTHETIC. The real OSD-575 data has no daily
sleep / heart-rate / HRV / exercise / mood time series, so the daily
streams stay synthetic and labelled synthetic everywhere.

Scripted scenario (from the team plan):
- C002: sleep restriction Sol 141-144, solar particle
  event Sol 143 (radiation ~9.0 mSv, residual ~5.0 mSv on Sol 144),
  HR and HRV strain, mood 2..3.
- C001: stays green (baselines only).
- C003: minor sleep dip Sol 141-143.
- C004: optimal (exercise, optimal sleep).

Baselines (seed 42):
- HR ~ N(62, 3) bpm, HRV ~ N(65, 6) ms, sleep ~ N(7.2, 0.5) h,
  radiation ~ 1.84 mSv/day +- 0.15, exercise ~ 45 +- 10 min,
  mood ~ 4 +- 0.5 (integer 1-5).

Verified output: 580 rows (4 crew x 145 sols), 145 per crew.
"""

import random
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional

SEED = 42
SOLS = range(1, 146)
CREW = ["C001", "C002", "C003", "C004"]

# Baselines: (mean, stddev) for gaussian values.
BASE = {
    "hr": (62.0, 3.0),
    "hrv": (65.0, 6.0),
    "sleep": (7.2, 0.5),
    "radiation": (1.84, 0.15),
    "exercise": (45.0, 10.0),
    "mood": (4.0, 0.5),
}

# Hard clamps so one bad draw never makes an impossible vital.
CLAMP = {
    "hr": (45.0, 110.0),
    "hrv": (20.0, 120.0),
    "sleep": (3.5, 10.0),
    "radiation": (0.5, 12.0),
    "exercise": (0.0, 90.0),
}


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def one_day(rng: random.Random, crew: str, sol: int) -> dict:
    """One crew, one sol -> a vitals row dict."""
    hr = rng.gauss(*BASE["hr"])
    hrv = rng.gauss(*BASE["hrv"])
    sleep = rng.gauss(*BASE["sleep"])
    radiation = rng.gauss(*BASE["radiation"])
    exercise = rng.gauss(*BASE["exercise"])
    mood = int(round(rng.gauss(*BASE["mood"])))

    if crew == "C002":
        if sol == 141:
            sleep = rng.uniform(5.4, 5.7)
            mood = 2
        elif sol == 142:
            sleep = rng.uniform(5.5, 5.8)
            hr += rng.uniform(2.5, 4.0)
            hrv -= rng.uniform(4.0, 6.0)
            mood = 3
        elif sol == 143:
            sleep = rng.uniform(7.1, 7.5)
            radiation = rng.uniform(8.0, 8.4)  # Acute SPE spike
            hr += rng.uniform(0.5, 1.5)
            hrv -= rng.uniform(1.0, 2.5)
            mood = 4
        elif sol == 144:
            sleep = rng.uniform(3.9, 4.3)
            radiation = rng.uniform(5.0, 5.5)  # Residual SPE
            hr += rng.uniform(17.0, 20.0)
            hrv -= rng.uniform(29.0, 35.0)
            mood = 2
        elif sol == 145:
            sleep = rng.uniform(5.5, 5.8)
            radiation = rng.uniform(2.0, 2.5)
            hr += rng.uniform(9.0, 11.0)
            hrv -= rng.uniform(16.0, 20.0)
            mood = 3
    elif crew == "C003":
        if 141 <= sol <= 143:
            sleep = rng.uniform(5.8, 6.3)  # Minor sleep dip
            mood = 3
            hr += rng.uniform(2.0, 3.5)
            hrv -= rng.uniform(3.0, 5.0)
    elif crew == "C004":
        exercise += 5.0
        sleep = max(sleep, 7.4)

    return {
        "crew_id": crew,
        "sol": sol,
        "hr": round(clamp(hr, *CLAMP["hr"]), 1),
        "hrv": round(clamp(hrv, *CLAMP["hrv"]), 1),
        "sleep_hours": round(clamp(sleep, *CLAMP["sleep"]), 1),
        "radiation_msv": round(clamp(radiation, *CLAMP["radiation"]), 2),
        "exercise_min": round(clamp(exercise, *CLAMP["exercise"]), 1),
        "mood": max(1, min(5, mood)),
        "provenance": "SYNTHETIC",
    }


def generate_synthetic(db_path: Optional[Path] = None) -> dict:
    repo_root = Path(__file__).resolve().parents[2]
    if db_path is None:
        out_dir = repo_root / "data" / "processed"
        out_dir.mkdir(parents=True, exist_ok=True)
        db_path = out_dir / "orbit_mafia.db"
    else:
        out_dir = db_path.parent
        out_dir.mkdir(parents=True, exist_ok=True)

    all_rows = []
    for crew in CREW:
        rng = random.Random(f"{SEED}-{crew}")
        for sol in SOLS:
            all_rows.append(one_day(rng, crew, sol))

    conn = sqlite3.connect(db_path)
    try:
        conn.execute("DROP TABLE IF EXISTS vitals")
        conn.execute(
            """CREATE TABLE vitals (
                id INTEGER PRIMARY KEY,
                crew_id TEXT NOT NULL,
                sol INTEGER NOT NULL,
                hr REAL NOT NULL,
                hrv REAL NOT NULL,
                sleep_hours REAL NOT NULL,
                radiation_msv REAL NOT NULL,
                exercise_min REAL NOT NULL,
                mood INTEGER NOT NULL,
                provenance TEXT NOT NULL DEFAULT 'SYNTHETIC',
                UNIQUE(crew_id, sol)
            )"""
        )
        conn.executemany(
            """INSERT INTO vitals
               (crew_id, sol, hr, hrv, sleep_hours, radiation_msv,
                exercise_min, mood, provenance)
               VALUES (:crew_id, :sol, :hr, :hrv, :sleep_hours, :radiation_msv,
                       :exercise_min, :mood, :provenance)""",
            all_rows,
        )
        conn.commit()
        total = conn.execute("SELECT COUNT(*) FROM vitals").fetchone()[0]
        per_crew = conn.execute(
            "SELECT crew_id, COUNT(*) FROM vitals GROUP BY crew_id ORDER BY crew_id"
        ).fetchall()
        c002_143 = conn.execute(
            "SELECT hr, hrv, sleep_hours, radiation_msv, mood FROM vitals "
            "WHERE crew_id = 'C002' AND sol = 143"
        ).fetchone()
        c002_144 = conn.execute(
            "SELECT hr, hrv, sleep_hours, radiation_msv, mood FROM vitals "
            "WHERE crew_id = 'C002' AND sol = 144"
        ).fetchone()
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
        ).fetchall()
    finally:
        conn.close()

    print(f"Total rows in {db_path}: {total}")
    print(f"Per crew: {dict(per_crew)}")
    print(f"Tables in db: {[t[0] for t in tables]}")
    print(
        f"C002 Sol 143: hr={c002_143[0]}, hrv={c002_143[1]}, "
        f"sleep={c002_143[2]} h, radiation={c002_143[3]} mSv, mood={c002_143[4]}"
    )
    print(
        f"C002 Sol 144: hr={c002_144[0]}, hrv={c002_144[1]}, "
        f"sleep={c002_144[2]} h, radiation={c002_144[3]} mSv, mood={c002_144[4]}"
    )

    return {
        "total": total,
        "per_crew": dict(per_crew),
        "tables": [t[0] for t in tables],
    }


def main() -> None:
    generate_synthetic()


if __name__ == "__main__":
    main()
