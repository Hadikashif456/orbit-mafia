# VitalOrbit

> **Autonomous Crew Health Guardian for Long-Duration Moon and Mars Missions**  
> *NASA Space Apps 2026 Challenge · 30-Hour Build · 4-Person Team*

VitalOrbit is an offline-capable, explainable astronaut health monitoring dashboard and early warning system. By monitoring multimodal stressors that are typically analyzed in isolation—radiation, sleep loss, cardiovascular/autonomic strain, mood/isolation, and inflammatory blood biomarkers—VitalOrbit computes the unified **Crew Resilience Index (CRI, 0–100)** to detect health risks ~48 hours before symptoms emerge and surface NASA-documented operational countermeasures.

> [!IMPORTANT]
> **Safety & Medical Policy:** VitalOrbit flags operational health risks and surfaces NASA-documented countermeasures only. It does **not** diagnose medical conditions, prescribe pharmaceutical dosages, or replace flight surgeons. Every data point is explicitly tagged with its provenance (`REAL_OSDR`, `SYNTHETIC`, or `CURATED`).

---

## 1. Monorepo Folder Structure

```
vitalorbit/
├── frontend/                  # Vite + React 18 + TypeScript (strict) + Tailwind CSS
│   ├── src/
│   │   ├── api/               # API client wrapper (8s timeout, mock fallback), Zod schemas, TypeScript types
│   │   ├── mocks/             # Static offline JSON payloads (provenance-tagged)
│   │   ├── components/        # ErrorBoundary, DisclaimerBar, ProvenanceBadge
│   │   ├── pages/             # CrewBoard, AstronautDetail, DemoMode
│   │   ├── hooks/             # Custom React & TanStack Query hooks
│   │   ├── lib/               # Constants (thresholds, CRI weights), status helper, Vitest unit tests
│   │   ├── App.tsx            # React Router v6 setup with persistent DisclaimerBar
│   │   └── main.tsx           # React entry point with QueryClientProvider & ErrorBoundary
│   ├── index.html             # Zero external scripts/CDNs/fonts
│   ├── .env.example           # VITE_API_BASE_URL, VITE_USE_MOCK
│   ├── _headers               # CSP and security transport headers
│   └── package.json           # Pinned dependencies (<= 12 runtime packages)
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI application entry point, CORS allowlist, middleware, health endpoint
│   │   ├── config.py          # Pydantic Settings (refuses wildcard CORS in prod)
│   │   ├── routers/           # crew.py, scenario.py, copilot.py, provenance.py
│   │   ├── models/            # Pydantic v2 schemas (extra="forbid")
│   │   ├── services/          # Pure computational logic (cri_engine, anomaly, scenario_engine, copilot_service)
│   │   ├── db/                # SQLite read-only connection helper (file:...?mode=ro)
│   │   └── security/          # Input validators, slowapi rate limiting, HTTP security headers
│   ├── knowledge/             # countermeasures.md (curated NASA HRP protocols)
│   ├── scripts/               # ingest_osdr.py, generate_synthetic.py (offline data pipelines)
│   ├── tests/                 # pytest suite (test_health.py, test_validators.py, test_cri.py)
│   ├── requirements.txt       # Pinned backend dependencies, bandit, pip-audit
│   └── .env.example           # Backend environment configuration
├── data/
│   ├── raw/                   # Read-only NASA OSDR datasets (e.g. OSD-575 / LSDS-8)
│   └── processed/             # Processed SQLite artifacts (git-ignored)
├── docs/
│   ├── PRD.md                 # Product Requirements Document
│   ├── TRD.md                 # Technical Requirements Document
│   ├── SECURITY.md            # Threat model, controls, and pre-submission checklist
│   ├── API_CONTRACT.md        # API specification generated from TRD Section 9
│   ├── ENTERPRISE_BLUEPRINTS.md # Supplementary architectural & security blueprints
│   └── design.md              # Design system and UI specs (reserved for designer)
├── .gitignore                 # Enforces security and artifact isolation
├── .pre-commit-config.yaml    # Gitleaks pre-commit secret detection
└── README.md                  # Project overview, folder map, team roles, and quickstart
```

---

## 2. Team Roles & Responsibilities

| Role Code | Title | Responsibilities |
|---|---|---|
| **F** | Frontend Specialist | React 18 UI, Tailwind layout, Recharts data visualization, accessibility, mock fallback. |
| **FS** | Full-Stack Lead | Monorepo scaffolding, API contract integration, TanStack Query hooks, Demo Mode orchestration. |
| **B1** | Backend Specialist 1 (Algorithms/Data) | Data ingestion (`ingest_osdr.py`), synthetic generator, CRI heuristic engine (`cri_engine.py`), IsolationForest anomaly detection. |
| **B2** | Backend Specialist 2 (API/Security/LLM) | FastAPI routing, Pydantic validation, slowapi rate limiting, copilot guardrails, offline cache fallback, automated tests. |

---

## 3. How to Run

### Prerequisites
- Node.js >= 18 (LTS recommended)
- Python >= 3.11
- npm >= 9

### Backend Setup
```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
- Health Check: `http://localhost:8000/api/v1/health` -> `{"status":"ok"}`
- Run Backend Tests:
  ```bash
  pytest
  ```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
- App runs at: `http://localhost:5173`
- Run Frontend Tests:
  ```bash
  npm run test
  ```

---

## 4. Documentation Links

- [Product Requirements Document (PRD)](file:///c:/Users/HCE/Documents/orbit-mafia/docs/PRD.md)
- [Technical Requirements Document (TRD)](file:///c:/Users/HCE/Documents/orbit-mafia/docs/TRD.md)
- [Security Requirements & Threat Model](file:///c:/Users/HCE/Documents/orbit-mafia/docs/SECURITY.md)
- [API Contract Specification](file:///c:/Users/HCE/Documents/orbit-mafia/docs/API_CONTRACT.md)
- [Enterprise Architecture Blueprints](file:///c:/Users/HCE/Documents/orbit-mafia/docs/ENTERPRISE_BLUEPRINTS.md)
- [Design Specs](file:///c:/Users/HCE/Documents/orbit-mafia/docs/design.md)

---

## 5. Architectural Alignment & Conflict Resolution

Per prompt instructions, `docs/PRD.md`, `docs/TRD.md`, and `docs/SECURITY.md` serve as the absolute source of truth. The following architectural variations between the supplementary Enterprise Blueprints and the project specification have been identified and resolved in favor of the source of truth:

1. **Frontend Architecture:** The Enterprise Blueprint specifies Next.js 14+ App Router (`apps/web`). The project follows `TRD.md` using Vite + React 18 SPA (`frontend/`) to enable offline zero-server static hosting on transit missions.
2. **Backend Stack:** The Enterprise Blueprint specifies Node.js/Express or NestJS (`apps/api`). The project follows `TRD.md` using Python 3.11 + FastAPI (`backend/app/`) for seamless scientific Python data/ML libraries (`numpy`, `pandas`, `scikit-learn`).
3. **Database & Infrastructure:** The Enterprise Blueprint specifies MongoDB/PostgreSQL, Redis cluster, and BullMQ queues. The project follows `TRD.md` using a zero-network, embedded read-only SQLite database (`vitalorbit.db`) and offline Python execution pipelines without external distributed servers.
4. **Authentication & Identity:** The Enterprise Blueprint outlines RS256 JWT auth, refresh cookies, WorkOS/Firebase, and RBAC. The project follows `PRD.md` Section 3 (Non-goals: "User accounts, login, multi-tenant features are out of scope"), maintaining a zero-auth, read-only operational dashboard for deep-space mission readiness.
