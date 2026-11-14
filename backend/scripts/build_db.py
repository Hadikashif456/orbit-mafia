"""Build Orbit Mafia SQLite database containing NASA OSDR biomarkers and synthetic vitals.

Usage:
    python backend/scripts/build_db.py

This script:
1. Ingests NASA OSDR OSD-575 blood biomarker data from data/raw/*_TRANSFORMED.csv into table `biomarkers`.
2. Generates deterministic synthetic physiological vitals (Sol 1-145) for all 4 crew members into table `vitals`.
3. Validates database counts (580 vitals rows) and outputs biomarker counts per crew and per panel.
4. Computes and displays CRI calculations for C002 across Sol 142-145.
Safe to re-run multiple times.
"""

import sqlite3
import sys
from pathlib import Path

# Add backend directory to sys.path to import internal modules
repo_root = Path(__file__).resolve().parents[2]
backend_dir = repo_root / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from scripts.ingest_osdr import ingest_osdr
from scripts.generate_synthetic import generate_synthetic
from app.services.crew_service import compute_cri_for, top_driver_label


def build_db(db_path: Path = None) -> dict:
    if db_path is None:
        db_path = repo_root / "data" / "processed" / "orbit_mafia.db"

    db_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"=== Building Orbit Mafia Database at {db_path} ===")

    # Step 1: Ingest NASA OSDR biomarkers
    print("\n--- 1. Ingesting Real OSDR Biomarkers ---")
    ingest_result = ingest_osdr(db_path=db_path)

    # Step 2: Generate seeded synthetic vitals
    print("\n--- 2. Generating Synthetic Physiological Vitals ---")
    synth_result = generate_synthetic(db_path=db_path)

    # Step 3: Validate database rows
    print("\n--- 3. Database Validation & Counts ---")
    conn = sqlite3.connect(db_path)
    try:
        vitals_count = conn.execute("SELECT COUNT(*) FROM vitals").fetchone()[0]
        biomarkers_count = conn.execute("SELECT COUNT(*) FROM biomarkers").fetchone()[0]
        per_crew_vitals = conn.execute(
            "SELECT crew_id, COUNT(*) FROM vitals GROUP BY crew_id ORDER BY crew_id"
        ).fetchall()
        per_crew_bio = conn.execute(
            "SELECT crew_id, COUNT(*) FROM biomarkers GROUP BY crew_id ORDER BY crew_id"
        ).fetchall()
        per_panel_bio = conn.execute(
            "SELECT panel, COUNT(*) FROM biomarkers GROUP BY panel ORDER BY panel"
        ).fetchall()
    finally:
        conn.close()

    print(f"Vitals Total Rows: {vitals_count} (Expected: 580 = 4 x 145)")
    print(f"Vitals Per Crew: {dict(per_crew_vitals)}")
    print(f"Biomarkers Total Rows: {biomarkers_count}")
    print(f"Biomarkers Per Crew: {dict(per_crew_bio)}")
    print(f"Biomarkers Per Panel: {dict(per_panel_bio)}")

    assert vitals_count == 580, f"Expected 580 vitals rows, got {vitals_count}"

    # Step 4: Compute and verify C002 Sol 142-145 CRI
    print("\n--- 4. C002 Sol 142-145 CRI Calculations ---")
    c002_cris = {}
    for sol in range(142, 146):
        res = compute_cri_for("C002", sol)
        c002_cris[sol] = res.cri
        print(f"  C002 Sol {sol}: CRI={res.cri:.1f} ({res.status}), topDriver={top_driver_label(res)}, contributions={res.contributions}")

    print("\n=== Database Build Complete Successfully ===")
    return {
        "vitals_count": vitals_count,
        "biomarkers_count": biomarkers_count,
        "per_crew_bio": dict(per_crew_bio),
        "per_panel_bio": dict(per_panel_bio),
        "c002_cris": c002_cris,
    }


def main() -> None:
    build_db()


if __name__ == "__main__":
    main()
