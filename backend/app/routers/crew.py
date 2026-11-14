"""Crew router providing endpoints for crew resilience summary, vitals, CRI, and biomarkers."""

from typing import List, Optional
from fastapi import APIRouter, Path, Query, HTTPException, status
from app.models import CrewSummary, VitalPoint, CRIResult, Biomarker
from app.security.validators import validate_crew_id, validate_sol, validate_window
from app.services.cri_engine import compute_cri, get_baseline, compute_inflammation_score

router = APIRouter(prefix="/crew", tags=["Crew"])


# ==============================================================================
# Data Layer Integration Stubs
# TODO: Replace with data teammate's DB query functions from app.db when ready.
# ==============================================================================

def _get_vitals_history_stub(crew_id: str, sol: int) -> List[VitalPoint]:
    """TODO (Data Teammate): Replace with DB query from app.db when ready:
    SELECT * FROM vitals WHERE crew_id = ? AND sol <= ? ORDER BY sol ASC
    """
    sols_to_generate = sorted(set(list(range(1, 15)) + list(range(max(1, sol - 2), sol + 1))))
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


def _get_biomarkers_stub(crew_id: str) -> List[Biomarker]:
    """TODO (Data Teammate): Replace with DB query from app.db when ready:
    SELECT * FROM biomarkers WHERE crew_id = ? ORDER BY timepoint ASC
    """
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


@router.get("", response_model=List[CrewSummary])
def get_crew_summaries(
    sol: Optional[int] = Query(144, ge=1, le=200, description="Mission Sol counter"),
) -> List[CrewSummary]:
    """Retrieve resilience status summary for all 4 crew members."""
    return [
        CrewSummary(
            id="C001",
            callsign="Cmdr A",
            cri=84.5,
            status="green",
            topDriver="Baseline stable",
            sparkline=[85.0, 84.8, 85.1, 84.6, 84.5],
            provenance="SYNTHETIC",
        ),
        CrewSummary(
            id="C002",
            callsign="Cmdr B",
            cri=61.2,
            status="amber",
            topDriver="Radiation event",
            sparkline=[84.0, 83.2, 82.0, 80.1, 61.2],
            provenance="SYNTHETIC",
        ),
        CrewSummary(
            id="C003",
            callsign="Cmdr C",
            cri=78.0,
            status="green",
            topDriver="Mild sleep debt",
            sparkline=[82.0, 81.0, 80.5, 79.0, 78.0],
            provenance="SYNTHETIC",
        ),
        CrewSummary(
            id="C004",
            callsign="Cmdr D",
            cri=88.0,
            status="green",
            topDriver="Optimal vitals",
            sparkline=[87.0, 87.5, 88.0, 87.9, 88.0],
            provenance="SYNTHETIC",
        ),
    ]


@router.get("/{id}/vitals", response_model=List[VitalPoint])
def get_crew_vitals(
    id: str = Path(..., pattern=r"^C00[1-4]$", description="Astronaut ID"),
    window: int = Query(7, description="Time window in sols (7 or 30)"),
    sol: Optional[int] = Query(144, ge=1, le=200, description="Ending mission Sol"),
) -> List[VitalPoint]:
    """Retrieve historical physiological vitals for a specific astronaut."""
    if not validate_window(window):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Window must be 7 or 30.",
        )

    return [
        VitalPoint(
            crewId=id,
            sol=sol or 144,
            hr=72.4,
            hrv=45.1,
            sleepHours=5.4,
            radiationMsv=8.9,
            exerciseMin=35.0,
            mood=2,
            provenance="SYNTHETIC",
        )
    ]


@router.get("/{id}/cri", response_model=CRIResult)
def get_crew_cri(
    id: str = Path(..., pattern=r"^C00[1-4]$", description="Astronaut ID"),
    sol: Optional[int] = Query(144, ge=1, le=200, description="Mission Sol"),
) -> CRIResult:
    """Retrieve calculated Crew Resilience Index (CRI) and stress term contributions."""
    current_sol = sol if sol is not None else 144
    vitals_history = _get_vitals_history_stub(id, current_sol)
    baseline = get_baseline(vitals_history)
    vitals_window = [v for v in vitals_history if current_sol - 2 <= v.sol <= current_sol]
    biomarkers = _get_biomarkers_stub(id)
    inflammation = compute_inflammation_score(biomarkers)

    return compute_cri(
        vitals_window=vitals_window,
        baseline=baseline,
        inflammation_score=inflammation,
        crew_id=id,
        sol=current_sol,
    )


@router.get("/{id}/biomarkers", response_model=List[Biomarker])
def get_crew_biomarkers(
    id: str = Path(..., pattern=r"^C00[1-4]$", description="Astronaut ID"),
) -> List[Biomarker]:
    """Retrieve real NASA OSDR blood biomarkers for this astronaut across mission timepoints."""
    return [
        Biomarker(
            crewId=id,
            timepoint="L-3",
            panel="CARDIO_EVE",
            name="CRP",
            value=5131700.0,
            unit="pg/mL",
            refMin=0.0,
            refMax=3000000.0,
            provenance="REAL_OSDR",
        ),
        Biomarker(
            crewId=id,
            timepoint="L-3",
            panel="CARDIO_EVE",
            name="Fibrinogen",
            value=310.0,
            unit="mg/dL",
            refMin=200.0,
            refMax=400.0,
            provenance="REAL_OSDR",
        ),
    ]
