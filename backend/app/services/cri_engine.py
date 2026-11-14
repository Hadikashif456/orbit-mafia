"""Crew Resilience Index (CRI) calculation engine.

Pure calculation engine implementing heuristic CRI formula v1.
No database, no network calls, and no external I/O.
Input data is passed as pure Python lists of Pydantic models.
"""

from typing import List, NamedTuple, Optional, Sequence
import math

from app.models import VitalPoint, Biomarker, CRIResult
from app.services.cri_constants import (
    CRI_WEIGHTS,
    STATUS_GREEN_MIN,
    STATUS_AMBER_MIN,
    get_cri_status,
    RADIATION_BASELINE,
    RADIATION_WINDOW_MAX,
    RADIATION_SPIKE_MAX,
    RADIATION_SPIKE_FACTOR,
    SLEEP_BASELINE_HOURS,
    SLEEP_RANGE_DIVISOR,
    CARDIO_Z_SCALE,
    CARDIO_HR_WEIGHT,
    CARDIO_HRV_WEIGHT,
    MOOD_BASELINE,
    MOOD_RANGE_DIVISOR,
    INFLAMMATION_Z_SCALE,
    PRE_FLIGHT_TIMEPOINTS,
    DEFAULT_INFLAMMATION_MARKERS,
    FORMULA_VERSION,
    PROVENANCE_CRI,
)


class Baseline(NamedTuple):
    """Resting physiological baseline representing an astronaut's healthy norm."""
    hr_mean: float
    hr_std: float
    hrv_mean: float
    hrv_std: float

    @property
    def hr(self) -> float:
        return self.hr_mean

    @property
    def hrv(self) -> float:
        return self.hrv_mean


def clip(value: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    """Clamps a floating-point value to [min_val, max_val]."""
    return max(min_val, min(max_val, value))


def get_baseline(vitals_rows: Sequence[VitalPoint]) -> Baseline:
    """Computes resting baseline (mean and std of HR and HRV) over the first 14 sols.

    Args:
        vitals_rows: Sequence of VitalPoint objects for an astronaut.

    Returns:
        Baseline NamedTuple containing hr_mean, hr_std, hrv_mean, and hrv_std.
    """
    if not vitals_rows:
        return Baseline(hr_mean=62.0, hr_std=3.0, hrv_mean=65.0, hrv_std=6.0)

    # Filter vitals for the first 14 sols (sol <= 14)
    baseline_window = [v for v in vitals_rows if 1 <= v.sol <= 14]
    if not baseline_window:
        baseline_window = list(vitals_rows[:14])

    n = len(baseline_window)
    hrs = [v.hr for v in baseline_window]
    hrvs = [v.hrv for v in baseline_window]

    hr_mean = sum(hrs) / n
    hrv_mean = sum(hrvs) / n

    if n > 1:
        hr_var = sum((x - hr_mean) ** 2 for x in hrs) / (n - 1)
        hrv_var = sum((x - hrv_mean) ** 2 for x in hrvs) / (n - 1)
        hr_std = math.sqrt(hr_var)
        hrv_std = math.sqrt(hrv_var)
    else:
        hr_std = 3.0
        hrv_std = 6.0

    # Prevent zero-division and clamp to physiological variability floors
    hr_std = max(hr_std, 2.5)
    hrv_std = max(hrv_std, 4.0)

    return Baseline(
        hr_mean=round(hr_mean, 2),
        hr_std=round(hr_std, 2),
        hrv_mean=round(hrv_mean, 2),
        hrv_std=round(hrv_std, 2),
    )


def stress_radiation(vitals_window: Sequence[VitalPoint]) -> float:
    """Calculates radiation stress score R in [0, 1] per TRD Section 5 table.
    
    Formula:
        R_mean = clip((dose_3sol_mean - 1.84) / (12.0 - 1.84), 0, 1)
        R_spike = clip((dose_today - 1.84) / (9.0 - 1.84), 0, 1) * 0.5
        R = clip(max(R_mean, R_spike), 0, 1)
    """
    if not vitals_window:
        return 0.0

    doses = [v.radiationMsv for v in vitals_window]
    dose_3sol_mean = sum(doses) / len(doses)
    dose_today = vitals_window[-1].radiationMsv

    r_mean = clip(
        (dose_3sol_mean - RADIATION_BASELINE) / (RADIATION_WINDOW_MAX - RADIATION_BASELINE),
        0.0,
        1.0,
    )

    r_spike = clip(
        (dose_today - RADIATION_BASELINE) / (RADIATION_SPIKE_MAX - RADIATION_BASELINE),
        0.0,
        1.0,
    ) * RADIATION_SPIKE_FACTOR

    return clip(max(r_mean, r_spike), 0.0, 1.0)


def stress_sleep(vitals_window: Sequence[VitalPoint]) -> float:
    """Calculates sleep stress score S in [0, 1] per TRD Section 5 table.
    
    Formula:
        S = clip((7.5 - sleep_3sol_mean) / 3.5, 0, 1)
    """
    if not vitals_window:
        return 0.0

    sleep_hours = [v.sleepHours for v in vitals_window]
    sleep_mean = sum(sleep_hours) / len(sleep_hours)

    return clip((SLEEP_BASELINE_HOURS - sleep_mean) / SLEEP_RANGE_DIVISOR, 0.0, 1.0)


def stress_cardio(vitals_window: Sequence[VitalPoint], baseline: Baseline) -> float:
    """Calculates cardiovascular / autonomic stress score C in [0, 1] per TRD Section 5 table.
    
    Formula:
        C = 0.5 * clip(z_hr / 3, 0, 1) + 0.5 * clip(-z_hrv / 3, 0, 1)
        where z vs astronaut's own 14-sol baseline.
    """
    if not vitals_window:
        return 0.0

    hrs = [v.hr for v in vitals_window]
    hrvs = [v.hrv for v in vitals_window]

    hr_mean = sum(hrs) / len(hrs)
    hrv_mean = sum(hrvs) / len(hrvs)

    hr_std = baseline.hr_std if baseline.hr_std > 1e-6 else 1.0
    hrv_std = baseline.hrv_std if baseline.hrv_std > 1e-6 else 1.0

    z_hr = (hr_mean - baseline.hr_mean) / hr_std
    z_hrv = (hrv_mean - baseline.hrv_mean) / hrv_std

    c_score = (
        CARDIO_HR_WEIGHT * clip(z_hr / CARDIO_Z_SCALE, 0.0, 1.0)
        + CARDIO_HRV_WEIGHT * clip(-z_hrv / CARDIO_Z_SCALE, 0.0, 1.0)
    )
    return clip(c_score, 0.0, 1.0)


def stress_mood(vitals_window: Sequence[VitalPoint]) -> float:
    """Calculates mood / psychological stress score M in [0, 1] per TRD Section 5 table.
    
    Formula:
        M = clip((4.0 - mood_3sol_mean) / 3.0, 0, 1)
    """
    if not vitals_window:
        return 0.0

    moods = [v.mood for v in vitals_window]
    mood_mean = sum(moods) / len(moods)

    return clip((MOOD_BASELINE - mood_mean) / MOOD_RANGE_DIVISOR, 0.0, 1.0)


# Function aliases for convenience
stress_r = stress_radiation
stress_s = stress_sleep
stress_c = stress_cardio
stress_m = stress_mood
compute_r = stress_radiation
compute_s = stress_sleep
compute_c = stress_cardio
compute_m = stress_mood
compute_radiation_stress = stress_radiation
compute_sleep_stress = stress_sleep
compute_cardio_stress = stress_cardio
compute_mood_stress = stress_mood


def compute_inflammation_score(
    biomarker_rows: Sequence[Biomarker],
    marker_names: Optional[Sequence[str]] = None,
) -> float:
    """Computes normalized inflammation score I in [0, 1] from blood biomarkers.

    Replay Assumption:
        In the prototype demo, real NASA OSDR biomarker timepoints (e.g. L-92, L-44, L-3, R+1)
        are replayed against the synthetic Mars-transit timeline for mission simulation purposes.
        This heuristic calculation z-scores each selected marker's latest available timepoint
        against that crew member's pre-flight baseline timepoints (L-92, L-44, L-3),
        clips each to [0, 1] via clip(z/3, 0, 1), and averages them across markers.

    Args:
        biomarker_rows: Sequence of Biomarker models for this astronaut.
        marker_names: Biomarkers to evaluate (default: CRP, Fibrinogen, IL-6).

    Returns:
        Average inflammation score normalized in [0, 1]. Returns 0.0 if no matching markers.
    """
    if not biomarker_rows:
        return 0.0

    target_markers = [m.strip().upper() for m in (marker_names or DEFAULT_INFLAMMATION_MARKERS)]
    pre_flight_set = {t.strip().upper() for t in PRE_FLIGHT_TIMEPOINTS}
    marker_scores: List[float] = []

    for marker_name in target_markers:
        rows = [b for b in biomarker_rows if b.name.strip().upper() == marker_name]
        if not rows:
            continue

        pre_flight_rows = [b for b in rows if b.timepoint.strip().upper() in pre_flight_set]
        if not pre_flight_rows:
            continue

        pre_values = [b.value for b in pre_flight_rows]
        mean_pre = sum(pre_values) / len(pre_values)

        if len(pre_values) > 1:
            var = sum((x - mean_pre) ** 2 for x in pre_values) / (len(pre_values) - 1)
            std_pre = math.sqrt(var)
        else:
            std_pre = max(abs(mean_pre) * 0.15, 1.0)

        std_pre = max(std_pre, 1e-4)

        # Identify latest available sample (prefer non-preflight / post-flight or last recorded)
        post_rows = [b for b in rows if b.timepoint.strip().upper() not in pre_flight_set]
        latest_row = post_rows[-1] if post_rows else rows[-1]
        latest_val = latest_row.value

        z = (latest_val - mean_pre) / std_pre
        marker_scores.append(clip(z / INFLAMMATION_Z_SCALE, 0.0, 1.0))

    if not marker_scores:
        return 0.0

    return clip(sum(marker_scores) / len(marker_scores), 0.0, 1.0)


def compute_cri(
    vitals_window: Sequence[VitalPoint],
    baseline: Baseline,
    inflammation_score: float = 0.0,
    crew_id: Optional[str] = None,
    sol: Optional[int] = None,
) -> CRIResult:
    """Computes the Crew Resilience Index (0–100) and stress term contributions.

    Heuristic, not clinical.
    Formula v1:
        CRI = 100 - 100 * (0.30*R + 0.25*S + 0.25*C + 0.10*M + 0.10*I)
        Clamped to [0, 100].

    Args:
        vitals_window: 1 to 3 VitalPoints ending at current sol.
        baseline: Pre-computed 14-sol resting baseline for this crew member.
        inflammation_score: Normalized inflammation score in [0, 1].
        crew_id: Optional explicit crew ID (defaults to vitals_window[-1].crewId or 'C001').
        sol: Optional explicit sol (defaults to vitals_window[-1].sol or 144).

    Returns:
        CRIResult with score, contributions, weights, and traffic-light status.
    """
    if vitals_window:
        final_crew_id = crew_id or vitals_window[-1].crewId
        final_sol = sol if sol is not None else vitals_window[-1].sol
    else:
        final_crew_id = crew_id or "C001"
        final_sol = sol if sol is not None else 144

    # Compute stress scores R, S, C, M, I in [0, 1]
    r = stress_radiation(vitals_window)
    s = stress_sleep(vitals_window)
    c = stress_cardio(vitals_window, baseline)
    m = stress_mood(vitals_window)
    i = clip(float(inflammation_score), 0.0, 1.0)

    # Weights from frozen cri_constants.py
    w_r = CRI_WEIGHTS["radiation"]
    w_s = CRI_WEIGHTS["sleep"]
    w_c = CRI_WEIGHTS["cardio"]
    w_m = CRI_WEIGHTS["mood"]
    w_i = CRI_WEIGHTS["inflammation"]

    # Raw deductions from 100
    deduction_r = 100.0 * w_r * r
    deduction_s = 100.0 * w_s * s
    deduction_c = 100.0 * w_c * c
    deduction_m = 100.0 * w_m * m
    deduction_i = 100.0 * w_i * i

    total_deduction = deduction_r + deduction_s + deduction_c + deduction_m + deduction_i
    raw_cri = 100.0 - total_deduction
    cri = round(clip(raw_cri, 0.0, 100.0), 1)

    # Points deducted from 100
    points_to_subtract = round(100.0 - cri, 1)

    contributions = {
        "radiation": round(deduction_r, 1),
        "sleep": round(deduction_s, 1),
        "cardio": round(deduction_c, 1),
        "mood": round(deduction_m, 1),
        "inflammation": round(deduction_i, 1),
    }

    # Ensure contribution invariant: sum(contributions.values()) == points_to_subtract
    diff = round(points_to_subtract - sum(contributions.values()), 1)
    if diff != 0.0:
        max_term = max(contributions, key=lambda k: contributions[k])
        contributions[max_term] = round(contributions[max_term] + diff, 1)

    # Status determination (thresholds 75/50 from cri_constants.py)
    status_str = get_cri_status(cri)

    return CRIResult(
        crewId=final_crew_id,
        sol=final_sol,
        cri=cri,
        status=status_str,
        contributions=contributions,
        weights=dict(CRI_WEIGHTS),
        formulaVersion=FORMULA_VERSION,
        provenance=PROVENANCE_CRI,
    )
