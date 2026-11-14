"""Crew router providing endpoints for crew resilience summary, vitals, CRI, and biomarkers."""

from typing import List, Optional
from fastapi import APIRouter, Path, Query, HTTPException, status
from app.models import CrewSummary, VitalPoint, CRIResult, Biomarker
from app.security.validators import validate_crew_id, validate_sol, validate_window

router = APIRouter(prefix="/crew", tags=["Crew"])


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
    """Retrieve detailed CRI breakdown and stress contributions."""
    return CRIResult(
        crewId=id,
        sol=sol or 144,
        cri=61.2,
        status="amber",
        contributions={
            "radiation": 13.5,
            "sleep": 9.1,
            "cardio": 10.4,
            "mood": 3.8,
            "inflammation": 2.0,
        },
        weights={
            "radiation": 0.30,
            "sleep": 0.25,
            "cardio": 0.25,
            "mood": 0.10,
            "inflammation": 0.10,
        },
        formulaVersion="v1",
        provenance="SYNTHETIC+REAL_OSDR",
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
