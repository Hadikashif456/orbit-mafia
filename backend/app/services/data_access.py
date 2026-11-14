# Backend 1 replaces the bodies of these two functions with DB queries; signatures must not change.
"""Data access layer for VitalOrbit AI services.

Exposes vitals history and biomarker queries decoupled from HTTP routers.
"""

from typing import List
from app.models import VitalPoint, Biomarker


def get_vitals_history(crew_id: str, sol: int, window: int = 14) -> List[VitalPoint]:
    """Retrieves physiological vitals for crew member up to sol across window."""
    start_sol = max(1, sol - window + 1)
    sols_to_generate = sorted(set(list(range(1, 15)) + list(range(start_sol, sol + 1))))
    results: List[VitalPoint] = []
    for s in sols_to_generate:
        if crew_id == "C002" and s >= 143:
            results.append(
                VitalPoint(
                    crewId=crew_id,
                    sol=s,
                    hr=72.0 + (s - 143) * 2.0,
                    hrv=48.0 - (s - 143) * 3.0,
                    sleepHours=5.4,
                    radiationMsv=9.0 if s == 143 else 4.5,
                    exerciseMin=35.0,
                    mood=2,
                    provenance="SYNTHETIC",
                )
            )
        elif crew_id == "C002" and s in (141, 142):
            results.append(
                VitalPoint(
                    crewId=crew_id,
                    sol=s,
                    hr=64.0,
                    hrv=58.0,
                    sleepHours=5.5,
                    radiationMsv=1.85,
                    exerciseMin=40.0,
                    mood=3,
                    provenance="SYNTHETIC",
                )
            )
        else:
            results.append(
                VitalPoint(
                    crewId=crew_id,
                    sol=s,
                    hr=62.0,
                    hrv=65.0,
                    sleepHours=7.3,
                    radiationMsv=1.84,
                    exerciseMin=45.0,
                    mood=4,
                    provenance="SYNTHETIC",
                )
            )
    return results


def get_biomarkers(crew_id: str) -> List[Biomarker]:
    """Retrieves blood biomarkers for astronaut across NASA OSDR timepoints."""
    return [
        Biomarker(
            crewId=crew_id,
            timepoint="L-92",
            panel="CARDIO_EVE",
            name="CRP",
            value=4820000.0,
            unit="pg/mL",
            refMin=0.0,
            refMax=3000000.0,
            provenance="REAL_OSDR",
        ),
        Biomarker(
            crewId=crew_id,
            timepoint="L-44",
            panel="CARDIO_EVE",
            name="CRP",
            value=4910000.0,
            unit="pg/mL",
            refMin=0.0,
            refMax=3000000.0,
            provenance="REAL_OSDR",
        ),
        Biomarker(
            crewId=crew_id,
            timepoint="L-3",
            panel="CARDIO_EVE",
            name="CRP",
            value=5131700.0 if crew_id == "C002" else 4950000.0,
            unit="pg/mL",
            refMin=0.0,
            refMax=3000000.0,
            provenance="REAL_OSDR",
        ),
        Biomarker(
            crewId=crew_id,
            timepoint="R+1",
            panel="CARDIO_EVE",
            name="CRP",
            value=5400000.0 if crew_id == "C002" else 5000000.0,
            unit="pg/mL",
            refMin=0.0,
            refMax=3000000.0,
            provenance="REAL_OSDR",
        ),
    ]
