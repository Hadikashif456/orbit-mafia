# How to run Orbit Mafia

## Backend (Hadi, with Javeria)

```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
python cri.py
uvicorn app:app --reload --port 8000
```

- `python cri.py` must print `61 amber`.
- Open http://127.0.0.1:8000/crew (or http://127.0.0.1:8000/api/v1/crew)
- You must see 4 astronauts. Astro 2 (C002 / Cmdr B) must be ~61, amber.
- Open http://127.0.0.1:8000/alerts (or http://127.0.0.1:8000/api/v1/scenario/state?sol=144)
- You must see 1 alert for Astro 2 (C002).
- API Documentation (Swagger UI): http://127.0.0.1:8000/docs

## Frontend (Eman)

- React dashboard, 4 screens only.
- Screen 1: Crew board. Screen 2: Astronaut detail.
- Screen 3: Risk alert and AI copilot. Screen 4: Demo mode Day 140 to 145.
- Use the real API above (`/api/v1`). Do not hard code numbers in the dashboard.
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

## Voice Narration (Web Speech Synthesis)

- **User Gesture Requirement**: Speech synthesis requires a user gesture (click or tap) before speech can be unlocked. The app primes the audio subsystem during user interactions (e.g., clicking "Play", "Ask Copilot", or "Read aloud").
- **Browser Voice Differences**: Voices available in Chrome, Edge, Firefox, and Safari differ based on OS and browser speech synthesis engine implementations (e.g., local vs remote speech services).
- **Permissions**: Speech synthesis is text-to-speech output only and requires no microphone permissions (do not add or modify Permissions-Policy headers).

## Mobile & Network Access (Phone Testing)

1. Run frontend on your local network:
   ```bash
   npm run dev -- --host
   ```
2. Set API base URL pointing to your machine's LAN IP:
   ```bash
   VITE_API_BASE_URL=http://<LAN-IP>:8000/api/v1
   ```
3. Run backend listening on all interfaces:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
4. Add `http://<LAN-IP>:5173` to `ALLOWED_ORIGINS` in backend configuration (explicit origins only, no wildcard CORS).
