"""Crew resilience service module.

Pure logic layer on top of data_access providing CRI calculations, series,
and driver classifications for crew members.
"""

from functools import lru_cache
from typing import Any, Dict, List

from app.models import CRIResult
from app.services.cri_engine import compute_cri, get_baseline, compute_inflammation_score
from app.services.data_access import _db_cache_key, get_vitals_history, get_biomarkers

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


@lru_cache(maxsize=64)
def _cached_inflammation_score(db_posix: str, mtime_ns: int, crew_id: str) -> float:
    """Caches biomarker-derived inflammation score per read-only DB snapshot and astronaut."""
    _ = (db_posix, mtime_ns)
    biomarkers = get_biomarkers(crew_id, for_cri=True)
    return compute_inflammation_score(biomarkers)


def _get_inflammation_score(crew_id: str) -> float:
    db_posix, mtime_ns = _db_cache_key()
    return _cached_inflammation_score(db_posix, mtime_ns, crew_id)


def compute_cri_for(crew_id: str, sol: int) -> CRIResult:
    """Computes CRI for a given astronaut and sol using data_access historical data."""
    vitals_history = get_vitals_history(crew_id, sol)
    baseline = get_baseline(vitals_history)
    vitals_window = [v for v in vitals_history if sol - 2 <= v.sol <= sol]
    inflammation = _get_inflammation_score(crew_id)

    return compute_cri(
        vitals_window=vitals_window,
        baseline=baseline,
        inflammation_score=inflammation,
        crew_id=crew_id,
        sol=sol,
    )


def compute_cri_range(crew_id: str, from_sol: int, to_sol: int) -> List[CRIResult]:
    """Computes CRI over a contiguous sol range, sharing baseline & biomarker lookups."""
    span = max(14, to_sol - from_sol + 4)
    vitals_history = get_vitals_history(crew_id, to_sol, window=span)
    baseline = get_baseline(vitals_history)
    inflammation = _get_inflammation_score(crew_id)
    vitals_by_sol = {v.sol: v for v in vitals_history}

    results: List[CRIResult] = []
    for s in range(from_sol, to_sol + 1):
        vitals_window = [vitals_by_sol[k] for k in (s - 2, s - 1, s) if k in vitals_by_sol]
        results.append(
            compute_cri(
                vitals_window=vitals_window,
                baseline=baseline,
                inflammation_score=inflammation,
                crew_id=crew_id,
                sol=s,
            )
        )
    return results


def cri_series(crew_id: str, sol: int, n: int = 5) -> List[float]:
    """CRI at each of the last n sols ending at sol, each computed using data up to that sol."""
    start_sol = max(1, sol - n + 1)
    return [res.cri for res in compute_cri_range(crew_id, start_sol, sol)]


def crew_trend(crew_id: str, sol: int, window: int = 7) -> List[Dict[str, Any]]:
    """Chronological CRI trend series for a crew member over the given window (7 or 30)."""
    start_sol = max(1, sol - window + 1)
    return [
        {
            "sol": res.sol,
            "cri": res.cri,
            "status": res.status,
        }
        for res in compute_cri_range(crew_id, start_sol, sol)
    ]


def top_driver_label(result: CRIResult) -> str:
    """Maps largest stress contribution to human-readable label or 'Baseline stable'."""
    if not result.contributions:
        return "Baseline stable"
    top_driver, top_points = max(result.contributions.items(), key=lambda x: x[1])
    if result.status == "green" and top_points < 5.0:
        return "Baseline stable"
    return DRIVER_LABELS.get(top_driver, "Baseline stable")
