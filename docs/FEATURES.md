# Orbit Mafia — Feature Catalog & Operational Guide

This document catalogs the feature suite added to Orbit Mafia, detailing the data dependencies, mathematical models, operational boundaries, and a 2-minute demonstration walkthrough.

---

## 1. Feature Architecture & New Routes

Orbit Mafia provides autonomous crew resilience assessment for deep-space missions, combining Inspiration4 biological post-flight profiles with simulated mission telemetry. All resilience calculations are computed strictly server-side by the backend CRI engine.

| Feature ID | Route | Component | Purpose |
|---|---|---|---|
| **D1** | `/triage` | `TriageQueuePage` | Prioritized astronaut triage queue sorted by critical urgency |
| **D2** | `/comms` | `CommsSimulationPage` | Deep-space Earth communication blackout simulation & autonomous onboard guidance |
| **D3** | `/levers` | `RecoveryLeversPage` | Quantified physiological recovery points returned to baseline |
| **D4** | `/baselines/:id` | `PersonalBaselinesPage` | Sol 1–14 personal baseline envelopes ($\mu \pm 2\sigma$) and telemetry anomaly detection |
| **D5** | `/trust` | `DataTrustPage` | Live data provenance matrix, NASA OSDR citations, and methodological limitations |
| **D6** | `/report/:id` | `IncidentReportPage` | Printable commander incident summary and countermeasure action brief |

---

## 2. Feature Specifications & Boundaries

### D1. Crew Triage Queue (`/triage`)
- **Data Streams & Hooks**: Consumes `useCrewSummaries(sol)` and cached `useCriRange(id)` for 7-sol trend calculation.
- **Sorting Logic (`src/lib/triage.ts`)**:
  1. Primary: Severity band (`red` > `amber` > `green`).
  2. Secondary: Absolute CRI score ascending (lowest resilience first).
  3. Tertiary: 7-sol CRI velocity descending (largest recent drop first).
- **Operational Boundaries**: Pure prioritization triage tool for flight surgeons; does not produce automated medical triage decisions.

### D2. Earth-Link-Lost Simulation (`/comms`)
- **Data Streams & Hooks**: `useCommsSimulation`, `useScenario`, `useCopilotExplanation`.
- **Mechanism**:
  - Link status toggle (`OK` vs `LOST`).
  - Adjustable speed-of-light one-way latency slider (3.0 to 22.0 minutes).
  - Delay countdown timer with visual latency buffer indicator.
  - Autonomous onboard Copilot advisory mode with English speech synthesis narration.
- **Operational Boundaries**: Simulated communication latency model based on Mars orbital mechanics; speech requires initial user gesture unlock.

### D3. Recovery Levers (`/levers`)
- **Data Streams & Hooks**: `useRecoveryLevers(crewId, sol)` consuming backend `GET /api/v1/crew/{id}/cri`.
- **Mathematical Model (`src/lib/levers.ts`)**:
  - Deductions from 100 CRI represent the exact points that can be reclaimed: $\text{Deficit} = 100 - \text{CRI}$.
  - Levers are extracted directly from backend `contributions` without frontend CRI recomputation:
    $$\sum_{i} \text{Points}_i = \text{Deficit}$$
  - Displays descending bar chart of recoverable points and percentage of total deficit.
- **Operational Boundaries**: Points reflect independent heuristic factors; real-world multi-organ recovery may involve non-linear compound responses.

### D4. Personal-Baseline Bands (`/baselines/:id`)
- **Data Streams & Hooks**: `usePersonalBaselines(crewId, sol)` issuing at most two queries per astronaut (`getVitals(id, 30, 14)` for Sol 1–14 baseline and `getVitals(id, 30, sol)` for current window).
- **Mathematical Formulation (`src/lib/baseline.ts`)**:
  - Sample mean: $\mu = \frac{1}{N}\sum x_i$
  - Sample standard deviation: $\sigma = \sqrt{\frac{1}{N-1}\sum (x_i - \mu)^2}$
  - Envelope: $[\mu - 2\sigma, \mu + 2\sigma]$ (approx. 95% nominal bounds).
  - Sols exceeding the envelope are flagged with out-of-band indicator dots.
- **Operational Boundaries**: Vitals telemetry is synthetic spaceflight modeling; labeled explicitly with `"SYNTHETIC personal baseline"`.

### D5. Data Trust Panel (`/trust`)
- **Data Streams & Hooks**: Live `useProvenance()` backend sync and static dataset catalog `TRUST_ENTRIES`.
- **Traceability Matrix**:
  - **REAL_OSDR**: Proteomics (OSD-579) & Clinical Chemistry (OSD-580) from Inspiration4.
  - **SYNTHETIC**: Heart Rate, HRV, Sleep Debt, Radiation Surges, Mood Ratings.
  - **CURATED**: NASA Human Research Program (HRP) countermeasures knowledge base.
- **Honest Limitations**:
  - Cohort size: 4 civilian astronauts ($N = 4$).
  - Mission profile: 3-day Low Earth Orbit flight, not deep-space interplanetary transit.
  - Timepoints: 7 discrete pre/post-flight collection intervals.
  - Reference ranges: Exclusively present in the CMP panel.

### D6. Printable Incident Report (`/report/:id`)
- **Data Streams & Hooks**: `useCri`, `useScenario`, `useCopilotExplanation`, and `buildIncidentReportData`.
- **Output Structure**:
  - Incident classification header with "SIMULATED" stamp.
  - Sol telemetry snapshot & CRI score.
  - Active operational alerts with drivers and transition deltas ($CRI_{from} \to CRI_{to}$).
  - Top 3 primary recovery levers.
  - Scenario incident log up to the selected sol.
  - Medical copilot countermeasure guidance.
  - Formal disclaimer and flight signoff block.
- **Print Optimization**: `@media print` style overrides background to pure white, text to black, suppresses non-print UI chrome and navigation, and enforces `page-break-inside: avoid` per section.

---

## 3. Two-Minute Live Demo Walkthrough

### 0:00 – 0:25: Triage & Mission Overview
1. Open `/triage`.
2. Point out the prioritized crew roster: C002 (Vanguard) is ranked #1 in critical status due to recent compound stress.
3. Show the 7-sol sparkline highlighting the rapid resilience velocity decline.

### 0:25 – 0:50: Communication Latency Simulation
1. Navigate to `/comms`.
2. Toggle link status to **LOST (DEEP SPACE)**.
3. Drag the one-way latency slider to **14 minutes** (Mars opposition distance).
4. Click **Read Autonomous Guidance Aloud** to showcase offline onboard Copilot narration operating independently of Earth ground control.

### 0:50 – 1:15: Recovery Levers & Countermeasure Modeling
1. Click **Levers** (`/levers`).
2. Select Astronaut C002 at Sol 145.
3. Highlight that the deficit is broken down into quantified potential gains: Sleep Debt recovery (+16.3 pts) and Cardiovascular autonomic recovery (+10.0 pts) offer the largest returns.

### 1:15 – 1:35: Personal Baseline Envelopes
1. Navigate to **Baselines** (`/baselines/C002`).
2. Show the shaded $\mu \pm 2\sigma$ nominal envelope derived from Sol 1–14 telemetry.
3. Point out the out-of-band excursions during the Sol 100–145 workload crunch.

### 1:35 – 2:00: Transparency & Printable Incident Handoff
1. Open **Data Trust** (`/trust`) to show OSDR dataset citations and honest limitations (N=4, LEO analog).
2. Jump to **Report** (`/report/C002`).
3. Click **Print / Save PDF** to demonstrate the commander incident handoff document formatted cleanly for flight records.
