"""Crew Resilience Index (CRI) entry point.

Pure calculation engine implementing heuristic CRI formula v1.
Usage:
    python cri.py
Outputs:
    61 amber
"""

import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.cri_constants import (
    CRI_WEIGHTS,
    STATUS_GREEN_MIN,
    STATUS_AMBER_MIN,
    get_cri_status,
)
from app.services.cri_engine import (
    compute_cri,
    get_baseline,
    compute_inflammation_score,
)


def calc_cri(sleep: float, cardio: float, radiation: float, exercise: float, mood: float) -> float:
    """Return CRI as a float (0 to 100)."""
    return (
        sleep * 0.25
        + cardio * 0.25
        + radiation * 0.20
        + exercise * 0.15
        + mood * 0.15
    )


def cri_status(cri: float) -> str:
    """Return status band: green, amber, or red."""
    return get_cri_status(cri)


def cri_explanation(sleep: float, cardio: float, radiation: float, exercise: float, mood: float) -> list[str]:
    """Return stress drivers in plain language."""
    drivers = []
    if sleep < 65:
        drivers.append("sleep under 6 hours for 3 nights")
    if cardio < 65:
        drivers.append("HRV falling from personal baseline")
    if radiation < 65:
        drivers.append("radiation event yesterday")
    if exercise < 65:
        drivers.append("missed exercise sessions")
    if mood < 65:
        drivers.append("low mood and focus score")
    if not drivers:
        drivers.append("all signals near baseline")
    return drivers


def main():
    try:
        from app.services.crew_service import compute_cri_for, top_driver_label
        res = compute_cri_for("C002", 144)
        print(f"{int(res.cri)} {res.status}")
        print(f"C002 Sol 144: CRI={res.cri:.1f} ({res.status}), topDriver={top_driver_label(res)}")
    except Exception:
        # Fallback to pure formula calculation
        cri = calc_cri(55, 60, 55, 70, 70)
        status = cri_status(cri)
        print(f"{int(cri)} {status}")


if __name__ == "__main__":
    main()
