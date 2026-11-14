# How to run Orbit Mafia

## Backend (Hadi, with Javeria)

```
cd backend
pip install -r requirements.txt
python cri.py
uvicorn app:app --reload
```

- `python cri.py` must print `61 amber`.
- Open http://127.0.0.1:8000/crew
- You must see 4 astronauts. Astro 2 must be 61, amber.
- Open http://127.0.0.1:8000/alerts
- You must see 1 alert for Astro 2.

## Frontend (Eman)

- React dashboard, 4 screens only.
- Screen 1: Crew board. Screen 2: Astronaut detail.
- Screen 3: Risk alert and AI copilot. Screen 4: Demo mode Day 140 to 145.
- Use the real API above. Do not hard code numbers in the dashboard.
- If React is behind at Hour 12, Hadi decides once: React or Streamlit. Never build both.

## GitHub rules

- Repo name: `orbit-mafia`, public.
- Anyone on the team can merge to main.
- Before you merge, check 3 things: code runs, CRI test passes, tell the group what you merged.
- If your merge breaks main, fix it right away, or undo it.
- Do not merge in the last hour without telling Hadi first.
- Each person works on their own branch, small commits, push often.
- Never push an unpushed copy overnight.
- Never copy practice code into this repo. All code here was written Nov 14-15.
