# Data

## Real NASA data

- First choice: OSD-575, SpaceX Inspiration4 blood serum panel and cytokine arrays, human, CC0-1.0, tabular CSVs.
- Backup: OSD-656, urine inflammation.
- Hadi and Hijab download one dataset today, check the CSV columns, clean it, and cache the cleaned file here.
- The demo never depends on a live NASA call. All demo data is cached in the repo.
- Download and headers are not yet verified. Hadi reports the columns in the group today.

## Synthetic demo data

- `synthetic_daily.csv` is synthetic demo data.
- It is labelled synthetic in the file, in the app, and in the submission.
- It is never presented as real astronaut records.
- Daily CRI streams are synthetic because no direct daily sleep, HR, HRV, exercise, or mood time series was found in OSDR.

## Countermeasures

- The copilot only recommends from the curated NASA Human Research Program countermeasure file.
- Hijab curates that file with Hadi. The copilot never invents a treatment.
