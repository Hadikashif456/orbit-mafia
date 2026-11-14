"""NASA OSDR Data Ingestion Script.

Ingests de-identified public biomarker datasets from NASA OSDR (OSD-575 / LSDS-8)
into SQLite database table `biomarkers`.

Rules & Requirements (from TRD Section 4):
- Source: The `*_TRANSFORMED.csv` files in `/data/raw` (wide format; one row per sample;
  first column `Sample Name` e.g. `C001_serum_L-3`; the Alamar file uses `Sample ID`).
- Parse `Sample Name` -> `crew_id` (`C001`..`C004`) and `timepoint` (`L-92`, `L-44`, `L-3`,
  `R+1`, `R+45`, `R+82`, `R+194`).
- Melt wide columns to long rows. Column names embed units
  (`..._value_gram_per_deciliter`, `..._concentration_picogram_per_milliliter`);
  extract name and unit from the column name.
- The CMP file has `_range_min_` / `_range_max_` columns mapping to `ref_min` / `ref_max`.
- Ingest at least:
    * Cardio Eve panel: CRP, fibrinogen, haptoglobin, A2-macroglobulin.
    * Immune panels: IL-6, TNF-alpha, IFN-gamma (if present).
    * CMP essentials: glucose, creatinine, ALT, AST, albumin, sodium, potassium.
- Drop rows with null values; log row counts.
- Never modify `/data/raw` (treat as strictly read-only).
- Tag every inserted row with provenance='REAL_OSDR'.
"""

import sys


def main() -> None:
    """Ingests NASA OSDR transformed CSV files into SQLite database."""
    print("TODO: Ingestion logic will be implemented in Milestone Hours 2-8.")


if __name__ == "__main__":
    main()
