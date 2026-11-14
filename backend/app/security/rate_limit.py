"""Rate limiting configuration using slowapi."""

from slowapi import Limiter
from slowapi.util import get_remote_address
from app.config import settings

# Default limiter tracking client IP addresses
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])


def get_copilot_rate_limit() -> str:
    """Returns combined per-minute and daily rate limit string for copilot endpoint."""
    return f"{settings.RATE_LIMIT_COPILOT}; {settings.RATE_LIMIT_COPILOT_DAILY}"

