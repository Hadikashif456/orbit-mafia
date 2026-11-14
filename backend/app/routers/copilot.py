"""AI Copilot router providing risk explanation and suggested NASA countermeasures."""

from fastapi import APIRouter, Request, Response
from app.models import CopilotRequest, CopilotResponse
from app.security.rate_limit import limiter, get_copilot_rate_limit
from app.services.copilot_service import explain_risk

router = APIRouter(prefix="/copilot", tags=["Copilot"])


@router.post("/explain", response_model=CopilotResponse)
@limiter.limit(get_copilot_rate_limit)
async def explain_risk_endpoint(
    request: Request,
    payload: CopilotRequest,
    response: Response,
) -> CopilotResponse:
    """Retrieve operational risk explanation and suggested countermeasures for astronaut.

    Input constraints:
        - Request model: CopilotRequest (crewId regex ^C00[1-4]$, sol 1-200, extra="forbid")
        - No free-text input accepted
    Headers:
        - Cache-Control: no-store
    Rate limits:
        - 30 per minute and 300 per day per IP
    """
    response.headers["Cache-Control"] = "no-store"
    return await explain_risk(payload)
