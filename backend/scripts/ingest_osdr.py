"""NASA OSDR data ingestion. B1 job, Hour 0-3. Hadi.

Reads the *_TRANSFORMED.csv files in data/raw (read-only, never edit),
melts the wide format into long rows, and writes them into the SQLite
table `biomarkers` with provenance='REAL_OSDR'.

Run from the repo root:
    python backend/scripts/ingest_osdr.py

It writes:
    data/processed/orbit_mafia.db           (SQLite, table biomarkers)
    data/processed/biomarkers_sample.json   (Hour 3 deliverable, sample JSON)

The API reads its DB from settings.DB_PATH (backend/app/config.py,
default ../data/processed/orbit_mafia.db). Before you start the server, set DB_PATH in
backend/.env to the db file, for example:
    DB_PATH=../data/processed/orbit_mafia.db
"""

import csv
import json
import sqlite3
import sys
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional, Tuple

PANEL_PRIORITY = {
    "CARDIO_EVE": 1,
    "INFLAMMATION_ALAMAR": 2,
    "IMMUNE_HD71": 3,
    "CMP": 4,
}

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
    "millimol_per_liter": "mmol/L",
    "units_per_liter": "U/L",
    "milliliter_per_minute_per_1.73_meter_squared": "mL/min/1.73m2",
    "npq": "NPQ",
}

TIMEPOINTS = ["L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194"]


def panel_for(filename: str) -> str:
    fn = filename.lower()
    if "cardiovascular" in fn or "hdcvd9" in fn:
        return "CARDIO_EVE"
    if "alamar" in fn:
        return "INFLAMMATION_ALAMAR"
    if "immune" in fn and ("eve" in fn or "hd71" in fn):
        return "IMMUNE_HD71"
    if "cmp" in fn or "metabolic" in fn:
        return "CMP"
    return "UNKNOWN"


def unit_from(column: str) -> str:
    for needle, unit in UNIT_MAP.items():
        if needle in column:
            return unit
    return ""


def clean_float(val) -> Optional[float]:
    if val is None:
        return None
    val = str(val).strip()
    if val in ("", "NA", "N/A", "null", "NULL", "None", "nan", "NaN"):
        return None
    try:
        return float(val)
    except ValueError:
        return None


def parse_sample(sample: str) -> Tuple[str, str]:
    """C001_serum_L-3 -> (C001, L-3). Alamar uses the same shape."""
    sample = sample.strip()
    if "_serum_" in sample:
        crew, timepoint = sample.split("_serum_", 1)
        return crew.strip(), timepoint.strip()
    parts = sample.rsplit("_", 1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    return sample, ""


def melt_file(path: Path) -> List[dict]:
    """One TRANSFORMED csv -> list of long biomarker rows. No pandas."""
    rows = []
    panel = panel_for(path.name)
    if panel == "UNKNOWN":
        print(f"SKIP {path.name}: unknown panel.")
        return rows

    priority = PANEL_PRIORITY.get(panel, 99)

    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames or []
        sample_col = "Sample Name" if "Sample Name" in fields else "Sample ID"
        if sample_col not in fields:
            print(f"SKIP {path.name}: no Sample Name column.")
            return rows

        value_cols = []
        for col in fields:
            if "_percent" in col or "_normalized" in col or "_range_" in col:
                continue
            if "_concentration_" in col:
                key = col.split("_concentration_")[0]
                value_cols.append((key, col))
            elif "_value_" in col:
                key = col.split("_value_")[0]
                value_cols.append((key, col))
            elif col.endswith("_value"):
                key = col[:-6]
                value_cols.append((key, col))

        for raw in reader:
            crew, timepoint = parse_sample(raw.get(sample_col) or "")
            if not crew or timepoint not in TIMEPOINTS:
                continue
            for key, col in value_cols:
                parsed_val = clean_float(raw.get(col))
                if parsed_val is None:
                    continue  # Drop null/NA values, per spec
                ref_min = clean_float(raw.get(key + "_range_min") or raw.get(key + "_range_min_"))
                ref_max = clean_float(raw.get(key + "_range_max") or raw.get(key + "_range_max_"))
                name = DISPLAY.get(key, key.replace("_", " ").title())
                rows.append(
                    {
                        "crew_id": crew,
                        "timepoint": timepoint,
                        "panel": panel,
                        "name": name,
                        "value": parsed_val,
                        "unit": unit_from(col),
                        "ref_min": ref_min,
                        "ref_max": ref_max,
                        "provenance": "REAL_OSDR",
                        "_priority": priority,
                    }
                )
    print(f"{path.name}: {len(rows)} raw rows, panel {panel}")
    return rows


def ingest_osdr(db_path: Optional[Path] = None, raw_dir: Optional[Path] = None) -> dict:
    repo_root = Path(__file__).resolve().parents[2]
    if raw_dir is None:
        raw_dir = repo_root / "data" / "raw"
    if db_path is None:
        out_dir = repo_root / "data" / "processed"
        out_dir.mkdir(parents=True, exist_ok=True)
        db_path = out_dir / "orbit_mafia.db"
    else:
        out_dir = db_path.parent
        out_dir.mkdir(parents=True, exist_ok=True)

    sample_path = out_dir / "biomarkers_sample.json"

    files = sorted(raw_dir.glob("*TRANSFORMED.csv"))
    if not files:
        print(f"No *_TRANSFORMED.csv found in {raw_dir}. Put the real CSVs there first.")
        sys.exit(1)

    # Sort files according to PANEL_PRIORITY so that higher priority panels are read
    # or priority is resolved deterministically
    all_raw_rows = []
    for path in files:
        all_raw_rows.extend(melt_file(path))

    # Deduplicate based on (crew_id, timepoint, name) keeping highest priority
    # Panel priority: CARDIO_EVE (1) > INFLAMMATION_ALAMAR (2) > IMMUNE_HD71 (3) > CMP (4)
    deduped: Dict[Tuple[str, str, str], dict] = {}
    conflicts: List[Tuple[Tuple[str, str, str], str, str]] = []

    for r in all_raw_rows:
        key = (r["crew_id"], r["timepoint"], r["name"])
        prio = r["_priority"]
        if key in deduped:
            existing = deduped[key]
            conflicts.append((key, existing["panel"], r["panel"]))
            if prio < existing["_priority"]:
                deduped[key] = r
        else:
            deduped[key] = r

    final_rows = list(deduped.values())
    # Clean internal _priority before DB insert
    for r in final_rows:
        r.pop("_priority", None)

    conn = sqlite3.connect(db_path)
    try:
        conn.execute("DROP TABLE IF EXISTS biomarkers")
        conn.execute(
            """CREATE TABLE biomarkers (
                id INTEGER PRIMARY KEY,
                crew_id TEXT NOT NULL,
                timepoint TEXT NOT NULL,
                panel TEXT NOT NULL,
                name TEXT NOT NULL,
                value REAL NOT NULL,
                unit TEXT,
                ref_min REAL,
                ref_max REAL,
                provenance TEXT NOT NULL DEFAULT 'REAL_OSDR',
                UNIQUE(crew_id, timepoint, name)
            )"""
        )
        conn.executemany(
            """INSERT INTO biomarkers
               (crew_id, timepoint, panel, name, value, unit, ref_min, ref_max, provenance)
               VALUES (:crew_id, :timepoint, :panel, :name, :value, :unit, :ref_min, :ref_max, :provenance)""",
            final_rows,
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
                "conflicts_count": len(conflicts),
                "sample_rows": final_rows[:5],
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"Total rows in {db_path}: {total}")
    print(f"Total conflicts resolved: {len(conflicts)}")
    print(f"Per crew: {dict(per_crew)}")
    print(f"Per panel: {dict(per_panel)}")
    print(f"Sample JSON: {sample_path}")

    return {
        "total": total,
        "per_crew": dict(per_crew),
        "per_panel": dict(per_panel),
        "conflicts": conflicts,
    }


def main() -> None:
    ingest_osdr()


if __name__ == "__main__":
    main()
