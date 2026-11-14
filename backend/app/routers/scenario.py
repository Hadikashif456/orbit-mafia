"""Scenario router providing mission timeline replay states (Sol 140–145)."""

from fastapi import APIRouter, HTTPException, Query, Request, status
from app.models import ScenarioStateResponse
from app.security.rate_limit import limiter
from app.services.scenario_engine import get_scenario_state as build_scenario_state
from app.services.data_access import DataUnavailableError

router = APIRouter(prefix="/scenario", tags=["Scenario"])


@router.get("/state", response_model=ScenarioStateResponse)
@limiter.limit("120/minute")
def get_scenario_state(
    request: Request,
    sol: int = Query(..., ge=140, le=145, description="Mission Sol counter for replay"),
) -> ScenarioStateResponse:
    """Retrieve deterministic scenario state snapshot for Sol 140–145."""
    try:
        return build_scenario_state(sol)
    except DataUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service is unavailable",
        )
