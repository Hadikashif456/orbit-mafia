# OSD-575 — Real NASA dataset for Orbit Mafia

Locked: 14 Nov 2026. Checked live on osdr.nasa.gov on 14 Nov 2026.

## Study

- Name: SpaceX Inspiration4 Blood Serum Metabolic Panel and Immune/Cardiac Cytokine Arrays
- Study: OSD-575, Version 3, 722.80 KB, CC0-1.0, public processed data
- Page: https://osdr.nasa.gov/bio/repo/data/studies/OSD-575
- Mission: SpaceX Inspiration4, 3 days, 4 private astronauts, Sep 2021
- Crew: C001 (male), C002 (female), C003 (female), C004 (male)
- Samples: 28 serum samples
- Times: L-92, L-44, L-3 (pre-flight), R+1, R+45, R+82, R+194 (post-flight)
- Contact PI: Christopher E. Mason, Weill Cornell Medicine

## Assays — what is in the study

- Eve Technologies Panel HDCVD9: Human Cardiovascular Disease Panel, 9-plex
- Eve Technologies Panel HD71: Immune cytokine panel
- Alamar Biosciences: multiplex cytokine panel
- Quest Diagnostics: Comprehensive Metabolic Panel (CMP)

## Files to download — Hadi and Hijab, do this today

1. Open https://osdr.nasa.gov/bio/repo/data/studies/OSD-575
2. Go to Files, download these:
   - LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv
   - LSDS-8_Multiplex_serum_cardiovascular_EvePanel_SUBMITTED.csv
   - OSD-575_metadata_OSD-575-ISA.zip
3. Save them in this data folder, do NOT rename them
4. Open the TRANSFORMED CSV first, check the columns, write the column names in the team group
5. Backup: OSD-656, Inspiration4 Urine Inflammation Panel, 417.67 KB, https://osdr.nasa.gov/bio/repo/data/studies/OSD-656

Download of the CSV files themselves was NOT yet verified on 14 Nov — only the study page was checked live. Hadi must report the real column names after download.

## What this dataset CAN and CANNOT do for CRI

CAN:
- Prove a real spaceflight immune and heart signal exists
- Show which markers rise right after flight (R+1)
- Give the Alert screen real NASA evidence to cite
- Give the copilot real drivers to name

CANNOT:
- Give daily sleep, HR, HRV, exercise, or mood time-series — OSD-575 has no daily wearable data
- So daily CRI streams MUST stay synthetic, labelled synthetic everywhere
- Never present synthetic daily data as real astronaut records

## Real findings to cite in the app — from the Inspiration4 paper

Source: Nature Communications, Inspiration4 multi-ome paper, OSD-575 is the blood serum source data.
At R+1 (1 day after return), these rose: IL-1RA, IL-4, IL-5, IL-6, IL-7, IL-10, IL-27, MCP-1, TNF alpha, IP-10, ENA-78, CRP, Fractalkine.
A smaller set fell. Do NOT claim exact numbers from this note — read the numbers from the downloaded CSV.

## How to use it in Orbit Mafia

- Backend: read the TRANSFORMED CSV, show 2 or 3 real markers on the Astronaut Detail screen, with source name OSD-575 and time R+1 vs L-3
- Alert screen: if CRI falls, name a real driver from this study, for example "CRP and IL-6 rose at R+1 in OSD-575"
- Copilot: only recommend from the NASA countermeasure file, never invent a treatment from a cytokine value
- Submission: name OSD-575, OSDR, GeneLab, with the link above, and say daily CRI data is synthetic

## Working dataset to start NOW — do not wait for download

- data/synthetic_daily.csv is the working dataset for frontend and backend today
- 12 rows, Day 140, 141, 142, 4 astronauts, CRI 82 to 61 for Astro 2, all maths checked
- It is synthetic demo data, labelled synthetic in the file, in the app, and in the submission
- Eman: build all 4 screens on this file first, swap in real OSD-575 markers later, same API fields
