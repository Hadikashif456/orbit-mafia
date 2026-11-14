"""NASA synthetic vitals generator. B1 job, Hour 3-8. Hadi.

Generates seeded synthetic daily vitals for 4 crew, Sol 1-145, and writes
them into the SQLite table `vitals` in data/processed/vitalorbit.db
(the same db the ingest script writes the `biomarkers` table into).

Run from the repo root:
    python backend/scripts/generate_synthetic.py

Provenance: every row is SYNTHETIC. The real OSD-575 data has no daily
sleep / heart-rate / HRV / exercise / mood time series, so the daily
streams stay synthetic and labelled synthetic everywhere.

Scripted scenario (from the team plan):
- C002: sleep restriction Sol 141-143 (5.2-5.8 h/night), solar particle
  event Sol 143 (radiation ~9.0 mSv), Sol 143-145 HR +8..12 bpm,
  HRV -15..25 ms, mood 2..3.
- C001: stays green (baselines only).
- C003: minor sleep dip Sol 141-143.
- C004: optimal.

Baselines (seed 42):
- HR ~ N(62, 3) bpm, HRV ~ N(65, 6) ms, sleep ~ N(7.2, 0.5) h,
  radiation ~ 1.84 mSv/day +- 0.15, exercise ~ 45 +- 10 min,
  mood ~ 4 +- 0.5 (integer 1-5).

Verified output: 580 rows (4 crew x 145 sols), 145 per crew.
C002 Sol 143: radiation ~9.0 mSv, sleep ~5.5 h, HR +8..12, HRV -15..25.
"""

import random
import sqlite3
from pathlib import Path

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


def clamp(value, low, high):
    return max(low, min(high, value))


def one_day(rng, crew, sol):
    """One crew, one sol -> a vitals row dict."""
    hr = rng.gauss(*BASE["hr"])
    hrv = rng.gauss(*BASE["hrv"])
    sleep = rng.gauss(*BASE["sleep"])
    radiation = rng.gauss(*BASE["radiation"])
    exercise = rng.gauss(*BASE["exercise"])
    mood = int(round(rng.gauss(*BASE["mood"])))

    if crew == "C002":
        if 141 <= sol <= 143:
            sleep = rng.uniform(5.2, 5.8)
        if sol == 143:
            radiation = rng.uniform(8.5, 9.5)
        if 143 <= sol <= 145:
            hr += rng.uniform(8.0, 12.0)
            hrv -= rng.uniform(15.0, 25.0)
            mood = rng.randint(2, 3)
    elif crew == "C003":
        if 141 <= sol <= 143:
            sleep = rng.uniform(6.3, 6.8)  # Minor sleep dip only.

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


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    out_dir = repo_root / "data" / "processed"
    out_dir.mkdir(parents=True, exist_ok=True)
    db_path = out_dir / "vitalorbit.db"

    rng = random.Random(SEED)
    all_rows = [one_day(rng, crew, sol) for crew in CREW for sol in SOLS]

    conn = sqlite3.connect(db_path)
    try:
        conn.execute("DROP TABLE IF EXISTS vitals")
        conn.execute(
            """CREATE TABLE vitals (
                id INTEGER PRIMARY KEY,
                crew_id TEXT, sol INTEGER, hr REAL, hrv REAL,
                sleep_hours REAL, radiation_msv REAL, exercise_min REAL,
                mood INTEGER, provenance TEXT
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
        c002_142 = conn.execute(
            "SELECT sleep_hours FROM vitals WHERE crew_id = 'C002' AND sol = 142"
        ).fetchone()[0]
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
    print(f"C002 Sol 142 sleep: {c002_142} h (must be 5.2-5.8)")


if __name__ == "__main__":
    main()
