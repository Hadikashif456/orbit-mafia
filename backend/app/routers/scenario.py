"""Scenario router providing mission timeline replay states (Sol 140–145)."""

from fastapi import APIRouter, Query, Request
from app.models import ScenarioStateResponse, CrewSummary, Alert, ScenarioEvent
from app.security.rate_limit import limiter

router = APIRouter(prefix="/scenario", tags=["Scenario"])


@router.get("/state", response_model=ScenarioStateResponse)
@limiter.limit("120/minute")
def get_scenario_state(
    request: Request,
    sol: int = Query(..., ge=140, le=145, description="Mission Sol counter for replay"),
) -> ScenarioStateResponse:
    """Retrieve deterministic scenario state snapshot for Sol 140–145."""
    return ScenarioStateResponse(
        sol=sol,
        crew=[
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
                cri=61.2 if sol >= 144 else 82.0,
                status="amber" if sol >= 144 else "green",
                topDriver="Radiation event" if sol >= 143 else "Normal operations",
                sparkline=[84.0, 83.2, 82.0, 80.1, 61.2],
                provenance="SYNTHETIC",
            ),
        ],
        alerts=[
            Alert(
                id=f"alt-{sol}-c002",
                crewId="C002",
                severity="warning" if sol >= 144 else "watch",
                criFrom=82.0,
                criTo=61.2,
                drivers=["Solar particle event", "Sleep deficit"],
                predictedWindowHours=48,
                message="CRI drop detected for C002 following radiation event.",
                provenance="SYNTHETIC",
            )
        ] if sol >= 143 else [],
        events=[
            ScenarioEvent(
                sol=141,
                crewId="C002",
                type="SLEEP_DISRUPTION",
                text="Sleep disruption begins (C002)",
            ),
            ScenarioEvent(
                sol=143,
                crewId="C002",
                type="RADIATION_SPIKE",
                text="Solar particle event detected: radiation spike",
                magnitude=9.0,
            ),
            ScenarioEvent(
                sol=144,
                crewId="C002",
                type="CRI_DROP",
                text="CRI drop detected for C002",
            ),
            ScenarioEvent(
                sol=144,
                crewId="C002",
                type="COPILOT_RECOMMENDATION",
                text="Copilot recommendation issued",
            ),
        ],
    )
