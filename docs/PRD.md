# VitalOrbit — Product Requirements Document (PRD)

Version 1.0 · NASA Space Apps 2026 · Challenge: Health Monitoring Software for Astronauts · Build window: 30 hours · Team: 4

---

## 1. Summary

VitalOrbit is an offline-capable AI health guardian for crews on Moon and Mars missions. It watches stressors that are usually studied separately (radiation, sleep loss, cardiovascular strain, mood/isolation, and inflammation biomarkers) and combines them into one explainable score, the **Crew Resilience Index (CRI, 0–100)**. When the CRI of a crew member drops or is predicted to drop, VitalOrbit raises a risk flag roughly 48 hours ahead and suggests NASA-documented countermeasures, without waiting for a doctor on Earth.

**Why it matters:** one-way communication delay to Mars is up to ~22 minutes (about 44 minutes round trip). Real-time medical consultation is not possible. The system has to be "the doctor that lives with the crew", with the strict limit that it **flags risk and suggests protocols; it never diagnoses**.

## 2. Problem statement

- Space health research mostly studies one stressor at a time (radiation, or microgravity, or sleep).
- Astronauts on deep-space missions cannot get real-time medical support.
- Existing dashboards show raw numbers; they do not tell a crew member what the numbers mean together or what to do.

## 3. Goals and non-goals

**Goals**
1. G1: Show a clear, color-coded health-resilience status for each of 4 crew members.
2. G2: Combine at least 5 stressor categories into one explainable index (CRI) whose formula fits on one slide.
3. G3: Predict a risk window (~48h) from trends and anomalies, and explain the drivers in plain language.
4. G4: Suggest NASA-documented countermeasures grounded in a curated knowledge file, with sources shown.
5. G5: Provide a one-click demo that replays Sol 140–145, where a radiation event hits and the CRI falls live.
6. G6: Run fully offline from cached data.
7. G7: Be honest: every number labeled REAL (NASA OSDR) or SYNTHETIC.

**Non-goals (out of scope)**
- Medical diagnosis, dosing, or treatment advice.
- User accounts, login, multi-tenant features.
- Real wearable or device integration.
- Mobile native app, chatbots free-text chat, maps, farming, multi-mission support.
- Clinical validation (this is a hackathon prototype).

## 4. Users and personas

| Persona | Description | Needs |
|---|---|---|
| **Crew member** ("Cmdr A") | One of 4 astronauts on a deep-space transit | Understand own status in seconds; get clear actions; trust the explanation |
| **Mission commander** | Responsible for crew readiness and EVA scheduling | Crew-wide overview; know whom to rest or reschedule; see drivers |
| **NASA judge** | Evaluates in a ~2 minute demo | Sees real data, a novel named index, a working product, honest labeling, a human story |

## 5. Key user stories

| ID | As a… | I want… | So that… |
|---|---|---|---|
| US-1 | commander | to see all 4 crew with traffic-light CRI on one screen | I know at a glance who needs attention |
| US-2 | crew member | to open my detail page with HR, HRV, sleep, radiation, exercise, mood trends | I see what changed |
| US-3 | crew member | to see which factors reduce my CRI and by how much | I understand the cause |
| US-4 | commander | an alert when a crew member's CRI drops or is predicted to drop | I can act before symptoms |
| US-5 | crew member | a plain-language explanation and suggested countermeasures | I know what to do without Earth |
| US-6 | judge | a "Play demo" button that replays Sol 140–145 | I see the prediction happen live |
| US-7 | judge | clear labels of real vs synthetic data and a "How CRI works" explanation | I can trust and verify the work |
| US-8 | crew member | the app to work with no internet | it works on a mission |

## 6. Functional requirements

Priority: **P0** = must ship, **P1** = should ship, **P2** = nice to have.

### 6.1 Crew Board (Screen 1)
| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-1.1 | Show 4 crew cards (callsign, CRI, status color, status text, sparkline, top driver) | P0 | 4 cards render from API or mock within 2s |
| FR-1.2 | Status thresholds: green ≥ 75, amber 50–74, red < 50 | P0 | Boundary values 75, 74, 50, 49 map correctly (unit-tested) |
| FR-1.3 | Status is never color-only (icon + text label) | P0 | Passes accessibility check |
| FR-1.4 | Clicking a card opens that astronaut's detail page | P0 | Route `/crew/:id` loads |
| FR-1.5 | Show provenance badge on each card | P0 | Badge visible: SYNTHETIC (vitals) |

### 6.2 Astronaut Detail (Screen 2)
| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-2.1 | Trend charts for HR, HRV, sleep hours, radiation dose, exercise minutes, mood | P0 | 6 charts render with axis labels and units |
| FR-2.2 | 7-sol / 30-sol window toggle | P1 | Toggle changes the data range |
| FR-2.3 | CRI breakdown: contribution of radiation, sleep, cardio, mood, inflammation | P0 | Stacked bar sums to (100 − CRI) |
| FR-2.4 | Real biomarker panel (CRP, fibrinogen, selected cytokines, CMP values) by timepoint, with reference ranges | P0 | Badge REAL · NASA OSDR; units shown |
| FR-2.5 | Chart tooltips with exact values and units | P1 | Hover/focus shows value |

### 6.3 Risk Alert and AI Copilot (Screen 3)
| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-3.1 | Alert when CRI drops ≥ 10 over 2 sols, or CRI < 75 (watch), < 60 (warning), < 50 (critical) | P0 | Alert appears in the Sol 143–144 demo |
| FR-3.2 | Alert shows CRI from → to, drivers, predicted risk window (hours) | P0 | All 4 fields present |
| FR-3.3 | Copilot explanation: summary, drivers, suggested actions with source, disclaimer | P0 | Response validates against schema |
| FR-3.4 | Copilot works with cached/templated response when LLM or internet is unavailable | P0 | Works with LLM key removed |
| FR-3.5 | Disclaimer always visible: "Risk flags and suggested countermeasures only. Not a medical diagnosis." | P0 | On every page |
| FR-3.6 | Response shows `mode: live \| cached` | P1 | Chip visible |

### 6.4 Mission Timeline Demo (Screen 4)
| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-4.1 | Play / pause / scrub Sol 140 → 145 | P0 | Works by click and keyboard |
| FR-4.2 | Scripted event: radiation spike at Sol 143 affecting C002 (and mild effect on others) | P0 | CRI of C002 drops ≥ 20 points by Sol 144 |
| FR-4.3 | Alert opens automatically at the spike; copilot explanation follows | P0 | No manual click needed in auto mode |
| FR-4.4 | Event log lists what happened per sol | P1 | Readable list |
| FR-4.5 | Play speed control (1x / 2x) | P2 | — |

### 6.5 Cross-cutting
| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | "How CRI works" modal: formula, weights, "heuristic, not clinical" statement | P0 |
| FR-5.2 | Provenance page/modal: dataset IDs, citations, which fields are synthetic | P0 |
| FR-5.3 | Offline mode chip when using cached data | P0 |
| FR-5.4 | Loading, empty and error states on every data view | P0 |

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | First meaningful content < 2s on broadband; API p95 < 500 ms for non-LLM routes; copilot < 6s live, < 300 ms cached |
| Offline | Entire demo works with wifi off (mock JSON bundled, cached copilot responses bundled, no CDN assets) |
| Reliability | UI never shows a blank screen; failed calls fall back to mocks or error states |
| Accessibility | Semantic HTML, keyboard navigation, color not sole signal, Lighthouse a11y ≥ 90 |
| Security | See SECURITY.md (no secrets in client, validated inputs, rate limits, CSP) |
| Explainability | CRI contributions visible; weights documented; no black-box claims |
| Browser support | Latest Chrome, Edge, Firefox, Safari; responsive to phone width |
| Maintainability | TypeScript strict; Pydantic models; contract-first API; tests for CRI and validators |

## 8. Data requirements

| Data | Source | Label | Use |
|---|---|---|---|
| Blood biomarkers: CMP, cardiovascular Eve panel, immune Eve panel, Alamar immune panel | NASA OSDR OSD-575 / LSDS-8 (4 crew C001–C004, timepoints L-92, L-44, L-3, R+1, R+45, R+82, R+194) | **REAL_OSDR** | Biomarker panel; inflammation term of CRI |
| HR, HRV, sleep, radiation dose, exercise, mood | Seeded generator written by the team | **SYNTHETIC** | Trend charts; CRI terms |
| Countermeasure knowledge | Team-curated `countermeasures.md` from NASA Human Research Program public material | **CURATED** (cite source per item) | Copilot grounding |

Honesty note: the real dataset contains no heart-rate, sleep or radiation streams. The demo **replays** real biomarker timepoints against the synthetic mission timeline for illustration. This mapping must be stated in the provenance view.

## 9. Success metrics (hackathon)

| Metric | Target |
|---|---|
| Judge sees full prediction story in the demo | < 60 seconds, no explanation needed |
| P0 requirements complete | 100% |
| Works offline | Pass (wifi off test) |
| Console errors during demo | 0 |
| Every displayed number labeled REAL or SYNTHETIC | 100% |

## 10. Demo script (2 minutes)

1. **0:00–0:20 Story:** "Day 142 to Mars. A message to Earth takes up to 22 minutes one way. If an astronaut's body starts failing, Houston cannot answer in time."
2. **0:20–0:40 Crew Board:** four crew, one index, all green/amber.
3. **0:40–1:20 Play demo:** radiation spike at Sol 143; C002's CRI falls from ~82 to ~61; alert opens.
4. **1:20–1:45 Copilot:** drivers (3 nights < 6h sleep + radiation event), predicted risk window ~48h, actions (20-minute exercise protocol, light therapy, reschedule EVA), sources.
5. **1:45–2:00 Trust:** open "How CRI works" and provenance: real NASA OSDR biomarkers, synthetic vitals labeled, "flags risk, does not diagnose".

## 11. Release plan (30 hours)

| Hours | Milestone |
|---|---|
| 0–2 | Repo, structure, contract frozen |
| 2–8 | Mocks + Crew Board; data ingest; CRI v1 |
| 8–16 | Detail page; vitals/biomarker/CRI endpoints; scenario + Demo Mode |
| 16 | **Feature freeze** |
| 16–22 | Copilot, panels, polish |
| 22–26 | Security pass, offline test, deploy |
| 26–30 | Deck, video, README, **submit by hour 28** |

Scope-cut order if behind: (1) 30-sol view, (2) IsolationForest (keep z-score), (3) play speed control, (4) event log. Never cut Demo Mode or the provenance labels.

## 12. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Real dataset lacks vitals | Certain | Synthetic generator, clearly labeled |
| Integration mismatch frontend/backend | High | Frozen contract, Zod validation, mock-first |
| LLM unavailable or slow | Medium | Cached + templated fallback |
| Judges question medical validity | Medium | "Risk flag only" language, heuristic disclosure, formula transparency |
| Scope creep | High | Feature freeze at hour 16, P0 list is the only contract |
| Team lacks experience / vibe-coded bugs | High | Small steps, code review, tests for CRI, security checklist |

## 13. Glossary

- **CRI:** Crew Resilience Index, 0–100, higher = more resilient.
- **Sol:** one Mars day; used here as the mission day counter.
- **OSDR:** NASA Open Science Data Repository (formerly GeneLab).
- **HRV:** heart rate variability.
- **EVA:** extravehicular activity (spacewalk).
- **Provenance:** whether a data point is REAL_OSDR or SYNTHETIC.