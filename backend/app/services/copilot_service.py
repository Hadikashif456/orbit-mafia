"""AI Copilot service for risk explanation and countermeasure guidance.

Retrieves NASA-documented protocols from knowledge/countermeasures.md, builds secure prompts,
and enforces strict safety filters (no diagnosis, no pharmaceutical dosing, no 'you have' statements).
Falls back cleanly to cached/templated responses when LLM key is absent or offline.
"""

from typing import Dict, Any
from app.models import CopilotRequest, CopilotResponse


async def explain_risk(request: CopilotRequest) -> CopilotResponse:
    """Generates an operational risk explanation and suggested countermeasures.

    Args:
        request: Validated CopilotRequest containing only {crewId, sol}.

    Returns:
        Validated CopilotResponse with suggested countermeasures and safety disclaimer.

    TODO (Milestone Hours 16-22):
        1. Look up computed CRI, top drivers, and active alerts server-side.
        2. Keyword-match drivers against knowledge/countermeasures.md.
        3. If LLM API key is present:
            - Call Anthropic LLM API (timeout 8s, max_tokens <= 600, temp <= 0.3).
            - Run post-filter rejecting diagnosis terms ('diagnos', 'you have', dosage patterns).
        4. If LLM call fails, times out, or triggers safety filter:
            - Fall back to bundled cached response or templated response (mode='cached').
    """
    raise NotImplementedError("explain_risk will be implemented in Milestone Hours 16-22.")
