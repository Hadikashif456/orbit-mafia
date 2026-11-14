"""Routers package."""

from app.routers.crew import router as crew_router
from app.routers.scenario import router as scenario_router
from app.routers.copilot import router as copilot_router
from app.routers.provenance import router as provenance_router

__all__ = [
    "crew_router",
    "scenario_router",
    "copilot_router",
    "provenance_router",
]
