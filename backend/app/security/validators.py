"""Input validation utilities for astronaut identifiers, mission sols, and window intervals."""

import re
from typing import Set

CREW_ID_PATTERN = re.compile(r"^C00[1-4]$")
VALID_WINDOWS: Set[int] = {7, 30}
MIN_SOL = 1
MAX_SOL = 200


def validate_crew_id(crew_id: str) -> bool:
    """Validate that crew_id strictly matches C001..C004."""
    if not isinstance(crew_id, str):
        return False
    return bool(CREW_ID_PATTERN.match(crew_id))


def validate_sol(sol: int) -> bool:
    """Validate that sol is an integer in [1, 200]."""
    if not isinstance(sol, int):
        return False
    return MIN_SOL <= sol <= MAX_SOL


def validate_window(window: int) -> bool:
    """Validate that window is either 7 or 30 sols."""
    return window in VALID_WINDOWS
