# orbit-mafia
Orbit Mafia
Team Orbit Mafia. NASA Space Apps Challenge 2026, Lahore.
Challenge: Create Health Monitoring Software for Astronauts on Space Missions.
What it is
Orbit Mafia is an offline AI health guardian for the crew on the way to Mars.
A message to Earth can take up to 22 minutes one way. Houston cannot answer in time if a body starts to fail.
Orbit Mafia watches radiation, sleep, heart rate, HRV, exercise, and mood together, not separately.
It gives one clear score, the Crew Resilience Index (CRI), 0 to 100.
It flags risk early and tells the astronaut one clear next action.
Crew Resilience Index (CRI)
CRI = Sleep 25% + Cardiovascular and HRV 25% + Radiation 20% + Exercise 15% + Mood 15%
Each part is scored 0 to 100 against the astronaut's own baseline.
Status:
75 to 100: green, stable
60 to 74: amber, watch, act today
Below 60: red, act now, reschedule demanding work
Orbit Mafia does not diagnose disease. It flags risk and suggests NASA documented countermeasures only.
The demo story: Day 142
One astronaut. Three short nights of sleep. A radiation spike on Day 141.
CRI falls 82 to 61. The system flags it about 48 hours before symptoms start.
The copilot says why it fell and gives one action: reschedule the EVA and start the sleep protocol.
The 4 screens only
Crew board: 4 astronauts, CRI, traffic light status
Astronaut detail: heart rate, HRV, sleep, radiation, exercise, mood, 7-sol and 30-sol trends
Risk alert and AI copilot: why CRI fell, what risk is rising, one recommended action
Demo mode Day 140 to 145: play the scenario, trigger the radiation event, watch CRI fall
No new feature after Hour 24. Hours 24 to 48 are polish, demo, video, and submission only.
Data
Real NASA data: OSD-575 is the first choice, OSD-656 is the backup. See data/README.md.
Synthetic demo data: the daily crew time series in data/synthetic_daily.csv is synthetic demo data. It is labelled synthetic in the file, in the app, and in the submission. It is never presented as real astronaut records.
How to run
See RUN.md.
Backend: Python, FastAPI. Frontend: React.
Team is 4 people only:
Hadi Kashif: lead, CRI engine, backend, integration, submission
Eman Fatima: frontend and AI agent
Javeria Yasin: automation, full stack, backend help, deployment, QA automation
Hijab Qaiser: presentation, Python tools, data support, docs, CRI tests. She presents.
AI use
AI was used to help write code, tests, and docs during the hackathon, Nov 14-15, 2026.
All code in this repo was written Nov 14-15. No Orbit Mafia code was copied from practice work.
The copilot only recommends from the curated NASA countermeasure file. It never invents a treatment.
