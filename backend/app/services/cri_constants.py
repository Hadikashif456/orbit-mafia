"""CRI mathematical model constants, weights, and operational status thresholds.

Frozen parameters for Crew Resilience Index (CRI) calculation formula v1.
"""

from typing import Dict, Tuple

# Formula v1 Stress Weights (Must sum to exactly 1.00)
WEIGHT_RADIATION: float = 0.30
WEIGHT_SLEEP: float = 0.25
WEIGHT_CARDIO: float = 0.25
WEIGHT_MOOD: float = 0.10
WEIGHT_INFLAMMATION: float = 0.10

CRI_WEIGHTS: Dict[str, float] = {
    "radiation": WEIGHT_RADIATION,
    "sleep": WEIGHT_SLEEP,
    "cardio": WEIGHT_CARDIO,
    "mood": WEIGHT_MOOD,
    "inflammation": WEIGHT_INFLAMMATION,
}

# Traffic-light Status Thresholds
STATUS_GREEN_MIN: float = 75.0
STATUS_AMBER_MIN: float = 50.0

CRI_STATUS_GREEN_THRESHOLD: float = STATUS_GREEN_MIN
CRI_STATUS_AMBER_THRESHOLD: float = STATUS_AMBER_MIN


def get_cri_status(cri: float) -> str:
    """Returns 'green', 'amber', or 'red' based on CRI score and frozen thresholds."""
    if cri >= STATUS_GREEN_MIN:
        return "green"
    elif cri >= STATUS_AMBER_MIN:
        return "amber"
    return "red"


# Radiation Stress Parameters (mSv/day)
RADIATION_BASELINE: float = 1.84
RADIATION_WINDOW_MAX: float = 6.0
RADIATION_SPIKE_MAX: float = 9.0
RADIATION_SPIKE_FACTOR: float = 0.8

# Sleep Stress Parameters (hours)
SLEEP_BASELINE_HOURS: float = 7.5
SLEEP_RANGE_DIVISOR: float = 3.5

# Cardiovascular / Autonomic Parameters
CARDIO_Z_SCALE: float = 3.0
CARDIO_HR_WEIGHT: float = 0.5
CARDIO_HRV_WEIGHT: float = 0.5

# Mood Parameters (1..5 scale)
MOOD_BASELINE: float = 4.0
MOOD_RANGE_DIVISOR: float = 3.0

# Biomarker Inflammation Parameters
INFLAMMATION_Z_SCALE: float = 3.0
PRE_FLIGHT_TIMEPOINTS: Tuple[str, ...] = ("L-92", "L-44", "L-3")
DEFAULT_INFLAMMATION_MARKERS: Tuple[str, ...] = ("CRP", "FIBRINOGEN", "IL-6")

# Formula Metadata
FORMULA_VERSION: str = "v1"
PROVENANCE_CRI: str = "SYNTHETIC+REAL_OSDR"
