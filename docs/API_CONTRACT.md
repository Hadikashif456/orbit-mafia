# VitalOrbit API Specification & Contract

Version 1.0 · Generated from TRD Section 9 · Source of Truth for Frontend and Backend Contract

## 1. Overview & Conventions

- **Base URL:** `/api/v1`
- **Protocol:** HTTPS only (HTTP allowed for local development: `http://localhost:8000/api/v1`)
- **Format:** JSON (`Content-Type: application/json; charset=utf-8`)
- **Strict Validation:** Request and response bodies forbid extra fields (`extra="forbid"` / Zod `strict()`).
- **Error Format:**
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid input parameter."
    }
  }
  ```
  Standard error codes: `VALIDATION_ERROR`, `NOT_FOUND`, `RATE_LIMIT_EXCEEDED`, `INTERNAL`.
  No stack traces or internals are ever returned to clients.

---

## 2. Validation Rules

- `crewId` / `id`: Regular expression `^C00[1-4]$`
- `sol`: Integer between `1` and `200` inclusive.
- `window`: Integer enum `7` or `30`.
- Request body size: `<= 1 KB`.
- Unknown properties: Rejected with HTTP 422.

---

## 3. Endpoints

### 3.1 `GET /health`
Liveness and readiness health check.

- **Request:** None
- **Response `200 OK`:**
  ```json
  {
    "status": "ok"
  }
  ```

---

### 3.2 `GET /crew`
Get resilience summary for all crew members.

- **Query Parameters:**
  - `sol` (integer, optional, 1–200): Mission Sol counter (defaults to latest available Sol, e.g. 144).
- **Response `200 OK`:** `CrewSummary[]`
  ```json
  [
    {
      "id": "C001",
      "callsign": "Cmdr A",
      "cri": 84.5,
      "status": "green",
      "topDriver": "Baseline stable",
      "sparkline": [85, 84, 85, 84, 85],
      "provenance": "SYNTHETIC"
    },
    {
      "id": "C002",
      "callsign": "Cmdr B",
      "cri": 61.2,
      "status": "amber",
      "topDriver": "Radiation event",
      "sparkline": [84, 83, 82, 80, 61],
      "provenance": "SYNTHETIC"
    }
  ]
  ```

---

### 3.3 `GET /crew/{id}/vitals`
Retrieve time-series physiological vitals for a given astronaut.

- **Path Parameters:**
  - `id` (string, required): Crew ID matching `^C00[1-4]$`.
- **Query Parameters:**
  - `window` (integer, optional, default: 7): Days window ∈ `{7, 30}`.
  - `sol` (integer, optional, 1–200): Ending mission Sol.
- **Response `200 OK`:** `VitalPoint[]`
  ```json
  [
    {
      "crewId": "C002",
      "sol": 144,
      "hr": 72.4,
      "hrv": 45.1,
      "sleepHours": 5.4,
      "radiationMsv": 8.9,
      "exerciseMin": 35.0,
      "mood": 2,
      "provenance": "SYNTHETIC"
    }
  ]
  ```

---

### 3.4 `GET /crew/{id}/cri`
Retrieve calculated Crew Resilience Index (CRI) and stress term contributions.

- **Path Parameters:**
  - `id` (string, required): Crew ID matching `^C00[1-4]$`.
- **Query Parameters:**
  - `sol` (integer, optional, 1–200): Mission Sol.
- **Response `200 OK`:** `CRIResult`
  ```json
  {
    "crewId": "C002",
    "sol": 144,
    "cri": 61.2,
    "status": "amber",
    "contributions": {
      "radiation": 13.5,
      "sleep": 9.1,
      "cardio": 10.4,
      "mood": 3.8,
      "inflammation": 2.0
    },
    "weights": {
      "radiation": 0.30,
      "sleep": 0.25,
      "cardio": 0.25,
      "mood": 0.10,
      "inflammation": 0.10
    },
    "formulaVersion": "v1",
    "provenance": "SYNTHETIC+REAL_OSDR"
  }
  ```

---

### 3.5 `GET /crew/{id}/biomarkers`
Retrieve NASA OSDR blood biomarkers for an astronaut across available mission timepoints.

- **Path Parameters:**
  - `id` (string, required): Crew ID matching `^C00[1-4]$`.
- **Response `200 OK`:** `Biomarker[]`
  ```json
  [
    {
      "crewId": "C002",
      "timepoint": "L-3",
      "panel": "CARDIO_EVE",
      "name": "CRP",
      "value": 5131700.0,
      "unit": "pg/mL",
      "refMin": 0.0,
      "refMax": 3000000.0,
      "provenance": "REAL_OSDR"
    }
  ]
  ```

---

### 3.6 `GET /scenario/state`
Builds snapshot of mission state for demo replay (Sol 140–145).

- **Query Parameters:**
  - `sol` (integer, required): Sol counter between `140` and `145`.
- **Response `200 OK`:**
  ```json
  {
    "sol": 144,
    "crew": [
      {
        "id": "C002",
        "callsign": "Cmdr B",
        "cri": 61.2,
        "status": "amber",
        "topDriver": "Radiation event",
        "sparkline": [84, 83, 82, 80, 61],
        "provenance": "SYNTHETIC"
      }
    ],
    "alerts": [
      {
        "id": "alt-144-c002",
        "crewId": "C002",
        "severity": "warning",
        "criFrom": 82.0,
        "criTo": 61.2,
        "drivers": ["Radiation event", "Sleep disruption"],
        "predictedWindowHours": 48,
        "message": "CRI drop detected for C002 following radiation spike.",
        "provenance": "SYNTHETIC"
      }
    ],
    "events": [
      {
        "sol": 143,
        "crewId": "C002",
        "type": "RADIATION_SPIKE",
        "text": "Solar particle event detected: radiation spike",
        "magnitude": 9.0
      }
    ]
  }
  ```

---

### 3.7 `POST /copilot/explain`
Requests AI Copilot risk explanation and suggested NASA countermeasures.
*Note: No free text accepted.*

- **Request Body (`<= 1 KB`):** `CopilotRequest`
  ```json
  {
    "crewId": "C002",
    "sol": 144
  }
  ```
- **Response `200 OK`:** `CopilotResponse`
  ```json
  {
    "summary": "Cmdr B experienced cumulative sleep deficit and a solar particle event at Sol 143, resulting in elevated cardiovascular strain and a projected CRI decline.",
    "drivers": [
      "Solar particle event (9.0 mSv dose)",
      "Sleep duration under 6h for 3 consecutive sols",
      "HR elevated by 10 bpm over baseline"
    ],
    "suggestedActions": [
      {
        "title": "Radiation Storm Shelter Protocol",
        "protocol": "Remain in designated storm shelter until dosimeter reads baseline (<2.0 mSv/day). Reschedule all EVA activities.",
        "source": "NASA HRP: Radiation Health Bio-Protection Guidelines"
      },
      {
        "title": "Sleep Recovery Protocol",
        "protocol": "Implement 30-minute light therapy upon waking; enforce 8.5-hour sleep opportunity in crew quarters.",
        "source": "NASA HRP: Fatigue Management and Countermeasures"
      }
    ],
    "disclaimer": "Risk flags and suggested countermeasures only. Not a medical diagnosis.",
    "groundedIn": [
      "countermeasures.md#radiation",
      "countermeasures.md#sleep"
    ],
    "mode": "live"
  }
  ```

---

### 3.8 `GET /provenance`
Metadata disclosure on data provenance, synthetic fields, real OSDR datasets, and replay mapping.

- **Request:** None
- **Response `200 OK`:**
  ```json
  {
    "datasets": [
      {
        "id": "OSD-575 / LSDS-8",
        "title": "NASA GeneLab / OSDR Astronaut Omics & Biomarker Dataset",
        "citation": "NASA Open Science Data Repository (OSDR) OSD-575",
        "accessDate": "2026-11-14",
        "provenance": "REAL_OSDR"
      }
    ],
    "syntheticFields": [
      "vitals.hr",
      "vitals.hrv",
      "vitals.sleep_hours",
      "vitals.radiation_msv",
      "vitals.exercise_min",
      "vitals.mood"
    ],
    "replayNote": "The demo replays real NASA OSDR biomarker timepoints (L-92..R+194) against the synthetic Mars-transit timeline (Sol 1-145) for illustration purposes.",
    "policy": "Risk flags and suggested countermeasures only. The words 'diagnose', 'detects disease', and 'treats' are strictly forbidden."
  }
  ```

---

## 4. Status Codes & Error Handling

| Code | Meaning | Behavior |
|---|---|---|
| `200 OK` | Request succeeded | Standard JSON payload returned. |
| `400 Bad Request` | Malformed JSON syntax | Returns standard error format. |
| `404 Not Found` | Crew ID not found | Returns standard error format. |
| `422 Unprocessable Entity` | Schema or regex violation, extra fields | Returns standard error format without echoing untrusted input. |
| `429 Too Many Requests` | Rate limit exceeded | Returns standard error with 429 status. |
| `500 Internal Error` | Unhandled backend exception | Generic `{"error":{"code":"INTERNAL","message":"Something went wrong"}}` (no stack traces). |
| `503 Unavailable` | External dependency failure | Copilot service intercepts LLM errors and falls back to `mode: "cached"` (never sends 503). |