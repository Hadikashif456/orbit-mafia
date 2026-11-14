"""Crew resilience service module.

Pure logic layer on top of data_access providing CRI calculations, series,
and driver classifications for crew members.
"""

from typing import Dict, List

from app.models import CRIResult
from app.services.cri_engine import compute_cri, get_baseline, compute_inflammation_score
from app.services.data_access import get_vitals_history, get_biomarkers

CALLSIGNS: Dict[str, str] = {
    "C001": "Cmdr A",
    "C002": "Cmdr B",
    "C003": "Cmdr C",
    "C004": "Cmdr D",
}

DRIVER_LABELS: Dict[str, str] = {
    "radiation": "Radiation exposure",
    "sleep": "Sleep deficit",
    "cardio": "Cardiovascular strain",
    "mood": "Mood / isolation stress",
    "inflammation": "Inflammation markers",
}


def compute_cri_for(crew_id: str, sol: int) -> CRIResult:
    """Computes CRI for a given astronaut and sol using data_access historical data."""
    vitals_history = get_vitals_history(crew_id, sol)
    baseline = get_baseline(vitals_history)
    vitals_window = [v for v in vitals_history if sol - 2 <= v.sol <= sol]
    biomarkers = get_biomarkers(crew_id)
    inflammation = compute_inflammation_score(biomarkers)

    return compute_cri(
        vitals_window=vitals_window,
        baseline=baseline,
        inflammation_score=inflammation,
        crew_id=crew_id,
        sol=sol,
    )


def cri_series(crew_id: str, sol: int, n: int = 5) -> List[float]:
    """CRI at each of the last n sols ending at sol, each computed using data up to that sol."""
    start_sol = max(1, sol - n + 1)
    sols = list(range(start_sol, sol + 1))
    return [compute_cri_for(crew_id, s).cri for s in sols]


def top_driver_label(result: CRIResult) -> str:
    """Maps largest stress contribution to human-readable label or 'Baseline stable'."""
    if not result.contributions:
        return "Baseline stable"
    top_driver, top_points = max(result.contributions.items(), key=lambda x: x[1])
    if result.status == "green" and top_points < 5.0:
        return "Baseline stable"
    return DRIVER_LABELS.get(top_driver, "Baseline stable")
