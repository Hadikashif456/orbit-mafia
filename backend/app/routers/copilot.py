"""AI Copilot router providing risk explanation and suggested NASA countermeasures."""

from fastapi import APIRouter, Request
from app.models import CopilotRequest, CopilotResponse, SuggestedAction
from app.security.rate_limit import limiter

router = APIRouter(prefix="/copilot", tags=["Copilot"])


@router.post("/explain", response_model=CopilotResponse)
@limiter.limit("10/minute")
def explain_risk(
    request: Request,
    payload: CopilotRequest,
) -> CopilotResponse:
    """Retrieve operational risk explanation and suggested countermeasures for astronaut."""
    return CopilotResponse(
        summary=f"Cmdr B (crewId: {payload.crewId}) experienced cumulative sleep disruption and an acute solar particle event at Sol 143, triggering cardiovascular elevation.",
        drivers=[
            "Solar particle event (9.0 mSv dose)",
            "Sleep duration under 6h for 3 consecutive sols",
            "Heart rate elevated by 10 bpm over personal baseline",
        ],
        suggestedActions=[
            SuggestedAction(
                title="Radiation Storm Shelter Protocol",
                protocol="Remain inside habitat storm shelter until dosimeter baseline is restored (<2.0 mSv/day). Defer scheduled EVA spacewalks.",
                source="NASA HRP: Space Radiation Bio-Protection Standards",
            ),
            SuggestedAction(
                title="Sleep Recovery Protocol",
                protocol="Schedule 30-minute light therapy upon waking; enforce 8.5-hour quiet sleep opportunity in private quarters.",
                source="NASA HRP: Behavioral Health & Performance Countermeasures",
            ),
        ],
        disclaimer="Risk flags and suggested countermeasures only. Not a medical diagnosis.",
        groundedIn=["countermeasures.md#radiation", "countermeasures.md#sleep"],
        mode="cached",
    )
