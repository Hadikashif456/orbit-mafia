# 🚀 Orbit Mafia — Autonomous Crew Health Guardian
**Deep Space Telemetry & Autonomous Astronaut Resilience System**

---

## 🔗 Project Links

| Resource | URL | Description |
| :--- | :--- | :--- |
| **Frontend Application** | [https://orbit-mafia.vercel.app](https://orbit-mafia.vercel.app) | Live React + Vite Dashboard hosted on Vercel |
| **Backend API** | [https://orbit-mafia.up.railway.app/api/v1](https://orbit-mafia.up.railway.app/api/v1) | Production FastAPI backend hosted on Railway |
| **API Documentation** | [https://orbit-mafia.up.railway.app/docs](https://orbit-mafia.up.railway.app/docs) | Interactive Swagger / OpenAPI documentation |
| **GitHub Repository** | [https://github.com/Hadikashif456/orbit-mafia](https://github.com/Hadikashif456/orbit-mafia) | Complete Source Code (Frontend, Backend, Knowledge Base, Docker) |

---

## 🌌 Problem Statement

During long-duration deep-space transit missions (such as NASA Artemis Lunar bases and crewed Mars expeditions):
1. **Light-Speed Communication Delays**: Earth-to-Mars communication suffers delays ranging from **3 to 22.1 minutes each way** (up to 44 minutes round-trip), making real-time telemedicine from Houston Mission Control scientifically impossible during acute medical emergencies.
2. **Compound Multi-Stressor Degradation**: Astronauts are simultaneously exposed to galactic cosmic rays, solar particle events (SPE), prolonged circadian sleep debt, microgravity cardiovascular deconditioning, elevated spacecraft $\text{CO}_2$, and immune dysregulation.
3. **Isolated Alarms vs. Holistic Resilience**: Existing spacecraft systems monitor isolated thresholds (e.g. heart rate alarm or dosimeter spike), failing to detect subtle, compounding multi-system decay until an astronaut crosses an acute medical crisis threshold.

---

## 🛡️ The Solution: Orbit Mafia

**Orbit Mafia** is an edge-first, autonomous physiological surveillance platform designed to operate onboard deep-space spacecraft with **0s Earth signal dependency**.

### Key Innovations:

1. **Crew Resilience Index (CRI 0–100)**:
   - A single, explainable composite index evaluating real-time crew survivability and operational readiness.
   - Mathematical formula:
     $$\text{CRI} = 100 - \sum (w_i \cdot \Delta_i) - \text{Penalty}_{\text{compound}}$$
   - Decomposes stress contributions across **Radiation**, **Sleep Deficit**, **Cardiovascular Strain**, **Mood/Behavioral Health**, and **Systemic Inflammation**.

2. **~48-Hour Early Warning Horizon**:
   - Anticipates physiological degradation ~48 hours before clinical collapse by tracking multi-omics biomarker divergence and baseline drift (tested on Sol 140–145 SPE scenario).

3. **Autonomous Offline Medical Copilot**:
   - Built with high-speed LPU inference to generate instant triage rankings, clinical debriefs, and recovery countermeasure prescriptions without waiting for ground transmission.

4. **Bi-Directional Comms Latency Buffer**:
   - Accurately models asynchronous space communication delays (0 to 22.1 minutes), demonstrating seamless handoff between onboard autonomous triage and Earth mission control.

5. **NASA OSDR Scientific Grounding**:
   - Anchored on multi-omics analog mission datasets from the NASA Open Science Data Repository (OSDR), incorporating baseline anomaly flags and return-to-baseline recovery dynamics.

---

## 🛠️ Technology Stack

- **Frontend**: Vite 6, React 18, TypeScript, Tailwind CSS, Space Glassmorphism UI, Recharts, Lucide Icons, Cosmic ASCII / WebGL Shaders.
- **Backend**: Python 3.12, FastAPI, SQLite, Pydantic v2, Uvicorn, Groq LPU Cloud SDK.
- **Infrastructure & Deployment**:
  - **Frontend**: Vercel (Edge CDN, Single Page Application)
  - **Backend**: Railway (Dockerized container with production reverse-proxy headers)
  - **Security**: Strict Content Security Policy (CSP), CORS protection, Rate limiting, Non-root Docker execution.

---

## 👥 Team
**Orbit Mafia** — Built for Deep Space Resilience Monitoring.
Repository: [https://github.com/Hadikashif456/orbit-mafia](https://github.com/Hadikashif456/orbit-mafia)
