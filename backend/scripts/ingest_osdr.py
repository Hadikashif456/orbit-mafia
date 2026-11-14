"""NASA OSDR data ingestion. B1 job, Hour 0-3. Hadi.

Reads the *_TRANSFORMED.csv files in data/raw (read-only, never edit),
melts the wide format into long rows, and writes them into the SQLite
table `biomarkers` with provenance='REAL_OSDR'.



Run from the repo root:
    python backend/scripts/ingest_osdr.py

It writes:
    data/processed/vitalorbit.db            (SQLite, table biomarkers)
    data/processed/biomarkers_sample.json   (Hour 3 deliverable, sample JSON)

The API reads its DB from settings.DB_PATH (backend/app/config.py,
default ./vitalorbit.db). Before you start the server, set DB_PATH in
backend/.env to the db file, for example:
    DB_PATH=../data/processed/vitalorbit.db

Verified against the real HDCVD9 TRANSFORMED file:
28 samples, 4 crew (C001-C004), 7 timepoints, 9 analytes, 252 rows.
CRP C001 L-3 = 5131700.0 pg/ml. Fibrinogen C001 L-3 = 2780.38 ng/ml.
"""

import csv
import json
import sqlite3
import sys
from pathlib import Path

# Panel name from the file name. Must match backend/app/models Biomarker.
PANELS = (
    ("HDCVD9", "CARDIO_EVE"),
    ("EvePanel", "CARDIO_EVE"),
    ("HD71", "IMMUNE_HD71"),
    ("Alamar", "INFLAMMATION_ALAMAR"),
    ("CMP", "CMP"),
    ("Metabolic", "CMP"),
)

DISPLAY = {
    "a2_macroglobulin": "a-2 Macroglobulin",
    "agp": "AGP",
    "crp": "CRP",
    "fetuin_a36": "Fetuin A36",
    "fibrinogen": "Fibrinogen",
    "haptoglobin": "Haptoglobin",
    "l_selectin": "L-Selectin",
    "pf4": "PF4",
    "sap": "SAP",
}

UNIT_MAP = {
    "gram_per_deciliter": "g/dL",
    "milligram_per_deciliter": "mg/dL",
    "picogram_per_milliliter": "pg/mL",
    "nanogram_per_milliliter": "ng/mL",
    "microgram_per_milliliter": "ug/mL",
}

TIMEPOINTS = ["L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194"]


def panel_for(filename: str) -> str:
    for needle, panel in PANELS:
        if needle.lower() in filename.lower():
            return panel
    return "UNKNOWN"


def unit_from(column: str) -> str:
    for needle, unit in UNIT_MAP.items():
        if needle in column:
            return unit
    return ""


def parse_sample(sample: str):
    """C001_serum_L-3 -> (C001, L-3). Alamar uses the same shape."""
    sample = sample.strip()
    if "_serum_" in sample:
        crew, timepoint = sample.split("_serum_", 1)
        return crew.strip(), timepoint.strip()
    parts = sample.rsplit("_", 1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    return sample, ""


def melt_file(path: Path):
    """One TRANSFORMED csv -> list of long biomarker rows. No pandas."""
    rows = []
    panel = panel_for(path.name)
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames or []
        sample_col = "Sample Name" if "Sample Name" in fields else "Sample ID"
        if sample_col not in fields:
            print(f"SKIP {path.name}: no Sample Name column.")
            return rows
        # Concentration columns: <key>_concentration_<unit> or <key>_value_<unit>.
        value_cols = []
        for col in fields:
            if "_concentration_" in col or "_value_" in col:
                key = col.split("_concentration_")[0].split("_value_")[0]
                value_cols.append((key, col))
        for raw in reader:
            crew, timepoint = parse_sample(raw.get(sample_col) or "")
            if not crew or timepoint not in TIMEPOINTS:
                continue
            for key, col in value_cols:
                raw_value = (raw.get(col) or "").strip()
                if raw_value == "":
                    continue  # Drop null values, per spec.
                ref_min = raw.get(key + "_range_min") or raw.get(key + "_range_min_")
                ref_max = raw.get(key + "_range_max") or raw.get(key + "_range_max_")
                rows.append(
                    {
                        "crew_id": crew,
                        "timepoint": timepoint,
                        "panel": panel,
                        "name": DISPLAY.get(key, key.replace("_", " ").title()),
                        "value": float(raw_value),
                        "unit": unit_from(col),
                        "ref_min": float(ref_min) if ref_min not in (None, "") else None,
                        "ref_max": float(ref_max) if ref_max not in (None, "") else None,
                        "provenance": "REAL_OSDR",
                    }
                )
    print(f"{path.name}: {len(rows)} rows, panel {panel}")
    return rows


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    raw_dir = repo_root / "data" / "raw"
    out_dir = repo_root / "data" / "processed"
    out_dir.mkdir(parents=True, exist_ok=True)
    db_path = out_dir / "vitalorbit.db"
    sample_path = out_dir / "biomarkers_sample.json"

    files = sorted(raw_dir.glob("*TRANSFORMED.csv"))
    if not files:
        print(f"No *_TRANSFORMED.csv found in {raw_dir}. Put the real CSVs there first.")
        sys.exit(1)

    all_rows = []
    for path in files:
        all_rows.extend(melt_file(path))

    conn = sqlite3.connect(db_path)
    try:
        conn.execute("DROP TABLE IF EXISTS biomarkers")
        conn.execute(
            """CREATE TABLE biomarkers (
                id INTEGER PRIMARY KEY,
                crew_id TEXT, timepoint TEXT, panel TEXT, name TEXT,
                value REAL, unit TEXT, ref_min REAL, ref_max REAL,
                provenance TEXT
            )"""
        )
        conn.executemany(
            """INSERT INTO biomarkers
               (crew_id, timepoint, panel, name, value, unit, ref_min, ref_max, provenance)
               VALUES (:crew_id, :timepoint, :panel, :name, :value, :unit, :ref_min, :ref_max, :provenance)""",
            all_rows,
        )
        conn.commit()
        total = conn.execute("SELECT COUNT(*) FROM biomarkers").fetchone()[0]
        per_crew = conn.execute(
            "SELECT crew_id, COUNT(*) FROM biomarkers GROUP BY crew_id ORDER BY crew_id"
        ).fetchall()
        per_panel = conn.execute(
            "SELECT panel, COUNT(*) FROM biomarkers GROUP BY panel ORDER BY panel"
        ).fetchall()
    finally:
        conn.close()

    sample_path.write_text(
        json.dumps(
            {
                "source": "OSD-575",
                "total_rows": total,
                "per_crew": dict(per_crew),
                "per_panel": dict(per_panel),
                "sample_rows": all_rows[:5],
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"Total rows in {db_path}: {total}")
    print(f"Per crew: {dict(per_crew)}")
    print(f"Per panel: {dict(per_panel)}")
    print(f"Sample JSON: {sample_path}")


if __name__ == "__main__":
    main()
