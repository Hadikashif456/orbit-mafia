"""Orbit Mafia backend. FastAPI. Small and clear.

Routes are fixed. Do not change field names without telling Eman the same day.
See docs/API_CONTRACT.md for the full contract.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from cri import calc_cri, cri_status, cri_explanation

app = FastAPI(title="Orbit Mafia")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Synthetic demo data. Labelled synthetic everywhere. Never real records.
CREW = [
    {"id": "astro-1", "name": "Astro 1", "sleep": 85, "cardio": 88, "radiation": 82, "exercise": 84, "mood": 86},
    {"id": "astro-2", "name": "Astro 2", "sleep": 55, "cardio": 60, "radiation": 55, "exercise": 70, "mood": 70},
    {"id": "astro-3", "name": "Astro 3", "sleep": 82, "cardio": 80, "radiation": 84, "exercise": 80, "mood": 83},
    {"id": "astro-4", "name": "Astro 4", "sleep": 88, "cardio": 86, "radiation": 85, "exercise": 87, "mood": 88},
]


def crew_with_cri(person):
    cri = round(calc_cri(person["sleep"], person["cardio"], person["radiation"], person["exercise"], person["mood"]))
    return {
        "id": person["id"],
        "name": person["name"],
        "cri": cri,
        "status": cri_status(cri),
        "sleep": person["sleep"],
        "cardio": person["cardio"],
        "radiation": person["radiation"],
        "exercise": person["exercise"],
        "mood": person["mood"],
        "synthetic": True,
    }


@app.get("/crew")
def get_crew():
    return {"crew": [crew_with_cri(p) for p in CREW], "synthetic": True}


@app.get("/crew/{astro_id}")
def get_astronaut(astro_id: str):
    for person in CREW:
        if person["id"] == astro_id:
            data = crew_with_cri(person)
            data["drivers"] = cri_explanation(
                person["sleep"], person["cardio"], person["radiation"], person["exercise"], person["mood"]
            )
            return data
    return {"error": "astronaut not found"}


@app.get("/alerts")
def get_alerts():
    alerts = []
    for person in CREW:
        data = crew_with_cri(person)
        if data["status"] in ("amber", "red"):
            alerts.append(
                {
                    "id": person["id"],
                    "name": person["name"],
                    "cri": data["cri"],
                    "status": data["status"],
                    "drivers": cri_explanation(
                        person["sleep"], person["cardio"], person["radiation"], person["exercise"], person["mood"]
                    ),
                    "action": "Reschedule the EVA and start the sleep protocol.",
                    "synthetic": True,
                }
            )
    return {"alerts": alerts, "synthetic": True}


@app.get("/")
def home():
    return {"app": "Orbit Mafia", "message": "Crew Resilience Index API is running."}
