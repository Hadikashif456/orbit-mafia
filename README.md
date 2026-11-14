# orbit-mafia

# Orbit Mafia

**An offline AI health guardian for astronauts on the way to Mars.**

NASA Space Apps Challenge 2026, Lahore.
Challenge 5: Create Health Monitoring Software for Astronauts on Space Missions.

Team Orbit Mafia.

---

## The problem

A message to Earth can take up to 22 minutes one way. Houston cannot answer in time if a body starts to fail.

Orbit Mafia watches the whole crew member at once. Sleep, heart, radiation, exercise, and mood together, not separately. It gives one clear score, flags risk early, and tells the astronaut one clear next action.

## The Crew Resilience Index (CRI)

One score, 0 to 100, for each astronaut.

| Part | Weight |
| --- | --- |
| Sleep | 25% |
| Cardiovascular and HRV | 25% |
| Radiation | 20% |
| Exercise | 15% |
| Mood | 15% |

Each part is scored 0 to 100 against the astronaut's own baseline.

| CRI | Status | What it means |
| --- | --- | --- |
| 75 to 100 | Green | Stable |
| 60 to 74 | Amber | Watch, act today |
| Below 60 | Red | Act now, reschedule demanding work |

Orbit Mafia does not diagnose disease. It flags risk and suggests NASA documented countermeasures only.

## The demo story: Day 142

One astronaut. Three short nights of sleep. A radiation spike on Day 141.

CRI falls 82 to 61. The system flags it about 48 hours before symptoms start. The copilot says why it fell and gives one action: reschedule the EVA and start the sleep protocol.

## The 4 screens

1. Crew board. 4 astronauts, CRI, traffic light status.
2. Astronaut detail. Heart rate, HRV, sleep, radiation, exercise, mood, 7-sol and 30-sol trends. Real NASA labs from OSD-575.
3. Risk alert and AI copilot. Why CRI fell, what risk is rising, one recommended action.
4. Demo mode, Day 140 to 145. Play the scenario, trigger the radiation event, watch CRI fall.

No new features after Hour 24. Hours 24 to 48 are polish, demo, video, and submission only.

## Data

Real NASA data: OSD-575, SpaceX Inspiration4 blood serum, Eve HDCVD9 panel. 4 crew, 28 samples, 9 markers. See `data/osd575/`. Backup: OSD-656.

Synthetic demo data: the daily crew time series in `data/synthetic_daily.csv` is synthetic demo data. It is labelled synthetic in the file, in the app, and in the submission. It is never presented as real astronaut records.

## Tech

Backend: Python, FastAPI. Frontend: React.

API: `GET /crew`, `GET /crew/{id}`, `GET /alerts`, `GET /crew/{id}/labs`, `GET /labs`. Full contract in `docs/API_CONTRACT.md`.

## How to run

See `RUN.md`.

```text
cd backend
python -m pip install -r requirements.txt
python cri.py
python -m uvicorn app:app --reload
```

Then open `127.0.0.1:8000/crew`. `cri.py` must print `61 amber`.

## AI use

AI was used to help write code, tests, and docs during the hackathon, Nov 14-15, 2026. All code in this repo was written Nov 14-15. No Orbit Mafia code was copied from practice work.

The copilot only recommends from the curated NASA countermeasure file. It never invents a treatment. No external AI API is used.
