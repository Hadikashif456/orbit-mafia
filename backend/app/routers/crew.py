"""Crew router providing endpoints for crew resilience summary, vitals, CRI, biomarkers, and trend."""

import re
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Path, Query, status
from pydantic import BaseModel

from app.models import Biomarker, CRIResult, CrewSummary, VitalPoint
from app.security.validators import validate_window
from app.services.crew_service import (
    CALLSIGNS,
    compute_cri_for,
    crew_trend,
    cri_series,
    top_driver_label,
)
from app.services.data_access import (
    DataUnavailableError,
    get_biomarkers,
    get_vitals_window,
)

router = APIRouter(prefix="/crew", tags=["Crew"])

KNOWN_PANELS = {"CMP", "CARDIO_EVE", "IMMUNE_HD71", "INFLAMMATION_ALAMAR", "all"}
ANALYTE_NAME_REGEX = re.compile(r"^[A-Za-z0-9 _.-]{1,40}$")


class TrendPoint(BaseModel):
    sol: int
    cri: float
    status: str


@router.get("", response_model=List[CrewSummary])
def get_crew_summaries(
    sol: Optional[int] = Query(144, ge=1, le=200, description="Mission Sol counter"),
) -> List[CrewSummary]:
    """Retrieve resilience status summary for all 4 crew members."""
    current_sol = sol if sol is not None else 144
    try:
        summaries: List[CrewSummary] = []
        for crew_id in ["C001", "C002", "C003", "C004"]:
            res = compute_cri_for(crew_id, current_sol)
            spark = cri_series(crew_id, current_sol, n=5)
            driver = top_driver_label(res)
            summaries.append(
                CrewSummary(
                    id=crew_id,
                    callsign=CALLSIGNS[crew_id],
                    cri=res.cri,
                    status=res.status,
                    topDriver=driver,
                    sparkline=spark,
                    provenance="SYNTHETIC",
                )
            )
        return summaries
    except DataUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service is unavailable",
        )


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
    current_sol = sol if sol is not None else 144
    try:
        return get_vitals_window(id, current_sol, window)
    except DataUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service is unavailable",
        )


@router.get("/{id}/cri", response_model=CRIResult)
def get_crew_cri(
    id: str = Path(..., pattern=r"^C00[1-4]$", description="Astronaut ID"),
    sol: Optional[int] = Query(144, ge=1, le=200, description="Mission Sol"),
) -> CRIResult:
    """Retrieve calculated Crew Resilience Index (CRI) and stress term contributions."""
    current_sol = sol if sol is not None else 144
    try:
        return compute_cri_for(id, current_sol)
    except DataUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service is unavailable",
        )


@router.get("/{id}/trend", response_model=List[TrendPoint])
def get_crew_trend(
    id: str = Path(..., pattern=r"^C00[1-4]$", description="Astronaut ID"),
    window: int = Query(7, description="Time window in sols (7 or 30)"),
    sol: Optional[int] = Query(144, ge=1, le=200, description="Ending mission Sol"),
) -> List[TrendPoint]:
    """Retrieve chronological rolling CRI trend series for crew member."""
    if not validate_window(window):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Window must be 7 or 30.",
        )
    current_sol = sol if sol is not None else 144
    try:
        data = crew_trend(id, current_sol, window)
        return [TrendPoint(**item) for item in data]
    except DataUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service is unavailable",
        )


@router.get("/{id}/biomarkers", response_model=List[Biomarker])
def get_crew_biomarkers(
    id: str = Path(..., pattern=r"^C00[1-4]$", description="Astronaut ID"),
    panel: Optional[str] = Query(None, description="Biomarker panel name or 'all'"),
    names: Optional[str] = Query(None, description="Comma-separated analyte names (max 20)"),
) -> List[Biomarker]:
    """Retrieve real NASA OSDR blood biomarkers for this astronaut across mission timepoints."""
    if panel is not None and panel not in KNOWN_PANELS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid panel '{panel}'. Must be one of: {sorted(KNOWN_PANELS)}",
        )

    name_list: Optional[List[str]] = None
    if names is not None:
        raw_names = [n.strip() for n in names.split(",") if n.strip()]
        if len(raw_names) > 20:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At most 20 analyte names may be requested at once.",
            )
        for n in raw_names:
            if not ANALYTE_NAME_REGEX.match(n):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Invalid analyte name '{n}'. Must match ^[A-Za-z0-9 _.-]{{1,40}}$",
                )
        name_list = raw_names

    try:
        return get_biomarkers(id, panel=panel, names=name_list)
    except DataUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service is unavailable",
        )
