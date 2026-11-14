"""Anomaly detection and 48-hour risk flag engine.

Combines rolling 14-sol z-score thresholding with scikit-learn IsolationForest
to detect anomalous physiological drift and extrapolate CRI trajectory ~48 hours ahead.
Pure functions over lists of VitalPoint and CRI values (no database, no external I/O).
"""

from typing import List, Dict, Any, Optional, Sequence, Union, Tuple
import math

from app.models import VitalPoint
from app.services.cri_constants import STATUS_GREEN_MIN

FEATURES = ["hr", "hrv", "sleep", "radiation", "exercise", "mood"]

DRIVER_MAP = {
    "hr": "Elevated heart rate",
    "hrv": "Suppressed HRV",
    "sleep": "Sleep disruption",
    "radiation": "Radiation spike",
    "exercise": "Reduced exercise",
    "mood": "Depressed mood",
}


def extract_features(point: VitalPoint) -> List[float]:
    """Extracts the 6-feature vector from a VitalPoint: [hr, hrv, sleep, radiation, exercise, mood]."""
    return [
        float(point.hr),
        float(point.hrv),
        float(point.sleepHours),
        float(point.radiationMsv),
        float(point.exerciseMin),
        float(point.mood),
    ]


def get_feature_value(point: VitalPoint, feature: str) -> float:
    """Extracts a named feature value from a VitalPoint."""
    feat = feature.lower()
    if feat == "hr":
        return float(point.hr)
    elif feat == "hrv":
        return float(point.hrv)
    elif feat in ("sleep", "sleephours"):
        return float(point.sleepHours)
    elif feat in ("radiation", "radiationmsv"):
        return float(point.radiationMsv)
    elif feat in ("exercise", "exercisemin"):
        return float(point.exerciseMin)
    elif feat == "mood":
        return float(point.mood)
    raise KeyError(f"Unknown feature: {feature}")


def compute_rolling_baseline(
    vitals_rows: Sequence[VitalPoint],
) -> Dict[str, Tuple[float, float]]:
    """Computes mean and std for each feature across a rolling window (typically 14 sols)."""
    if not vitals_rows:
        return {
            "hr": (62.0, 3.0),
            "hrv": (65.0, 6.0),
            "sleep": (7.2, 0.5),
            "radiation": (1.84, 0.15),
            "exercise": (45.0, 10.0),
            "mood": (4.0, 0.5),
        }

    stats: Dict[str, Tuple[float, float]] = {}
    for feat in FEATURES:
        vals = [get_feature_value(r, feat) for r in vitals_rows]
        mean = sum(vals) / len(vals)
        if len(vals) > 1:
            var = sum((x - mean) ** 2 for x in vals) / (len(vals) - 1)
            std = math.sqrt(var)
        else:
            std = 1.0
        # Prevent division by zero
        std = max(std, 1e-4)
        stats[feat] = (mean, std)
    return stats


def zscore_flags(
    vitals_window: Union[Sequence[VitalPoint], VitalPoint],
    baseline: Optional[Any] = None,
) -> Dict[str, bool]:
    """Evaluates biometric z-scores vs a 14-sol rolling baseline per metric.
    
    Flags |z| > 2.5 per metric.

    Args:
        vitals_window: A VitalPoint or sequence of VitalPoints (latest sol evaluated).
        baseline: Pre-computed rolling baseline (dict of metric -> (mean, std), Baseline NamedTuple,
                  or None to compute from vitals_window).

    Returns:
        Dict mapping metric name to bool (True if |z| > 2.5, False otherwise).
    """
    if isinstance(vitals_window, VitalPoint):
        current_point = vitals_window
        window_pts = [vitals_window]
    elif isinstance(vitals_window, Sequence) and len(vitals_window) > 0:
        current_point = vitals_window[-1]
        window_pts = vitals_window
    else:
        return {feat: False for feat in FEATURES}

    # Resolve baseline stats per metric
    stats: Dict[str, Tuple[float, float]] = {}
    if isinstance(baseline, dict):
        for feat in FEATURES:
            if feat in baseline:
                entry = baseline[feat]
                if isinstance(entry, (tuple, list)) and len(entry) >= 2:
                    stats[feat] = (float(entry[0]), max(float(entry[1]), 1e-4))
    elif hasattr(baseline, "hr_mean") and hasattr(baseline, "hr_std"):
        stats["hr"] = (float(baseline.hr_mean), max(float(baseline.hr_std), 1e-4))
        stats["hrv"] = (float(baseline.hrv_mean), max(float(baseline.hrv_std), 1e-4))

    # Fill in any missing metrics from window_pts or healthy defaults
    missing = [f for f in FEATURES if f not in stats]
    if missing:
        computed = compute_rolling_baseline(window_pts[:-1] if len(window_pts) > 1 else window_pts)
        for f in missing:
            stats[f] = computed.get(f, (get_feature_value(current_point, f), 1.0))

    flags: Dict[str, bool] = {}
    for feat in FEATURES:
        val = get_feature_value(current_point, feat)
        mean, std = stats[feat]
        std = max(std, 1e-4)
        z = (val - mean) / std
        flags[feat] = bool(abs(z) > 2.5)

    return flags


def train(vitals_rows: Sequence[VitalPoint]) -> Any:
    """Trains an IsolationForest model on Sol 1-100 vitals data per crew member.
    
    Hyperparameters (TRD Section 6):
        n_estimators=100, contamination=0.05, random_state=42.
        Features: hr, hrv, sleep, radiation, exercise, mood.

    Returns:
        In-memory model object. If scikit-learn fails or is unavailable,
        returns a fallback baseline dictionary without crashing.
    """
    try:
        from sklearn.ensemble import IsolationForest

        # Filter for Sol 1-100
        train_data = [r for r in vitals_rows if 1 <= r.sol <= 100]
        if not train_data:
            train_data = list(vitals_rows)

        X = [extract_features(r) for r in train_data]
        model = IsolationForest(
            n_estimators=100,
            contamination=0.05,
            random_state=42,
        )
        model.fit(X)
        return model
    except Exception:
        # Fallback to pure statistical baseline if sklearn is unavailable or fails
        return compute_rolling_baseline(vitals_rows)


def score(model: Any, vitals_row: VitalPoint) -> float:
    """Scores a vitals row using the model. Lower score = more anomalous.
    
    If model has decision_function (IsolationForest), returns float decision_function value.
    If sklearn fails or fallback model is used, computes a z-score-based anomaly score.
    """
    if hasattr(model, "decision_function"):
        try:
            x = [extract_features(vitals_row)]
            return float(model.decision_function(x)[0])
        except Exception as exc:
            # Fall back to z-score anomaly scoring if sklearn raises
            _ = exc

    # Fallback anomaly score: lower = more anomalous
    baseline = model if isinstance(model, dict) else compute_rolling_baseline([vitals_row])
    z_scores = []
    for feat in FEATURES:
        val = get_feature_value(vitals_row, feat)
        mean, std = baseline.get(feat, (val, 1.0))
        std = max(std, 1e-4)
        z_scores.append(abs(val - mean) / std)

    max_z = max(z_scores) if z_scores else 0.0
    # Map max_z: if max_z <= 2.5 -> positive score; if max_z > 2.5 -> negative score
    return float((2.5 - max_z) / 10.0)


_crew_latch_state: Dict[str, bool] = {}
_crew_green_streak: Dict[str, int] = {}
_crew_last_drivers: Dict[str, List[str]] = {}


def reset_risk_flag_latch(crew_id: Optional[str] = None) -> None:
    """Resets the risk flag latch state for tests and evaluations."""
    global _crew_latch_state, _crew_green_streak, _crew_last_drivers
    if crew_id is not None:
        _crew_latch_state.pop(crew_id, None)
        _crew_green_streak.pop(crew_id, None)
        _crew_last_drivers.pop(crew_id, None)
    else:
        _crew_latch_state.clear()
        _crew_green_streak.clear()
        _crew_last_drivers.clear()


def risk_flag(
    cri_history: Sequence[Any],
    anomaly_flags: Any,
    contributions: Optional[Dict[str, float]] = None,
    method: Optional[str] = None,
    crew_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Computes 48-hour risk flag using CRI linear extrapolation and anomaly flags.

    TRD Section 6 rule:
        - Linear extrapolation of the last 3 CRI values to sol+2.
        - Raise 'risk in ~48h' flag if predicted CRI < 60 OR anomaly on >= 2 metrics in the same sol.
        - Stability rule: once raised for a crew member, the flag stays raised until CRI is
          at or above the green threshold (>= 75.0) for 2 consecutive sols.
        - Returns {flag, predictedWindowHours: 48, drivers, method}.

    Args:
        cri_history: List of CRI values (floats or CRIResult objects).
        anomaly_flags: Dict of metric -> bool (from zscore_flags) or list/set of flagged metrics.
        contributions: Optional CRI contributions breakdown dict.
        method: Optional method string descriptor.
        crew_id: Optional crew identifier for per-astronaut latch tracking.

    Returns:
        Dict with keys: flag, predictedWindowHours, drivers, method.
    """
    # 1. Parse CRI values
    cri_vals: List[float] = []
    for c in cri_history:
        if hasattr(c, "cri"):
            cri_vals.append(float(c.cri))
        elif isinstance(c, (int, float)):
            cri_vals.append(float(c))

    # Determine crew id from argument or cri_history
    cid = crew_id
    if cid is None and cri_history:
        first = cri_history[-1]
        cid = getattr(first, "crewId", None) or getattr(first, "crew_id", None)

    # 2. Linear extrapolation to sol+2
    if len(cri_vals) >= 3:
        y1, y2, y3 = cri_vals[-3], cri_vals[-2], cri_vals[-1]
        m = (y3 - y1) / 2.0
        y_bar = (y1 + y2 + y3) / 3.0
        # Extrapolate 2 steps ahead: y(sol+2) = y_bar + 3*m
        predicted_cri = y_bar + 3.0 * m
    elif len(cri_vals) == 2:
        m = cri_vals[-1] - cri_vals[-2]
        predicted_cri = cri_vals[-1] + 2.0 * m
    elif len(cri_vals) == 1:
        predicted_cri = cri_vals[0]
    else:
        predicted_cri = 100.0

    # 3. Check anomalous metrics count (>= 2)
    if isinstance(anomaly_flags, dict):
        anomalous_metrics = [k for k, v in anomaly_flags.items() if bool(v)]
    elif isinstance(anomaly_flags, (list, tuple, set)):
        anomalous_metrics = [str(k) for k in anomaly_flags]
    else:
        anomalous_metrics = []

    cri_condition = bool(predicted_cri < 60.0)
    metric_condition = bool(len(anomalous_metrics) >= 2)
    raw_flag = bool(cri_condition or metric_condition)

    # 4. Latch State: Once raised for a crew member, stays raised until CRI >= 75.0 for 2 consecutive sols
    current_cri = cri_vals[-1] if cri_vals else 100.0
    if cid is not None:
        is_latched = _crew_latch_state.get(cid, False)
        green_streak = _crew_green_streak.get(cid, 0)

        if raw_flag:
            is_latched = True
            green_streak = 0
            final_flag = True
        elif is_latched:
            if current_cri >= STATUS_GREEN_MIN:
                green_streak += 1
                if green_streak >= 2:
                    is_latched = False
                    green_streak = 0
                    final_flag = False
                else:
                    final_flag = True
            else:
                green_streak = 0
                final_flag = True
        else:
            final_flag = False
            green_streak = 0

        _crew_latch_state[cid] = is_latched
        _crew_green_streak[cid] = green_streak
    else:
        final_flag = raw_flag
        is_latched = False

    # 5. Determine drivers
    drivers: List[str] = []
    if contributions:
        # Top 2-3 contributions by points subtracted
        top_contribs = sorted(
            [(k, v) for k, v in contributions.items() if v > 0],
            key=lambda item: item[1],
            reverse=True,
        )
        drivers = [DRIVER_MAP.get(k.lower(), k.capitalize()) for k, _ in top_contribs[:3]]

    if not drivers and anomalous_metrics:
        drivers = [DRIVER_MAP.get(m.lower(), m) for m in anomalous_metrics][:3]

    if not drivers and is_latched:
        drivers = list(_crew_last_drivers.get(cid, []))

    if final_flag and not drivers:
        if cri_condition:
            drivers.append("Projected CRI decline (<60)")
        if metric_condition:
            drivers.append("Multiple biometric anomalies")

    if drivers:
        _crew_last_drivers[cid] = drivers

    # 6. Method label
    effective_method = method or ("isolation_forest+zscore+extrapolation")

    return {
        "flag": final_flag,
        "predictedWindowHours": 48,
        "drivers": drivers,
        "method": effective_method,
        "predicted_cri": round(max(0.0, min(100.0, predicted_cri)), 1),
    }


def detect_anomalies(
    vitals_history: Union[Sequence[VitalPoint], str],
    sol: Optional[int] = None,
    cri_history: Optional[Sequence[float]] = None,
    model: Optional[Any] = None,
) -> Dict[str, Any]:
    """High-level anomaly detection and risk evaluation.
    
    Evaluates rolling z-scores, IsolationForest anomaly scoring, and 48-hour CRI risk flag.
    Gracefully handles sklearn failure with z-score only fallback.
    """
    # Backward-compatibility check: if first arg is a crew_id string
    if isinstance(vitals_history, str):
        from app.services.data_access import get_vitals_history
        crew_id = vitals_history
        target_sol = sol if sol is not None else 144
        vitals_rows = get_vitals_history(crew_id, target_sol)
    else:
        vitals_rows = vitals_history

    if not vitals_rows:
        return {
            "flag": False,
            "predictedWindowHours": 48,
            "drivers": [],
            "method": "zscore_fallback",
            "zscore_flags": {feat: False for feat in FEATURES},
            "isolation_score": 0.0,
        }

    # 1. Rolling 14-sol baseline
    current_point = vitals_rows[-1]
    history_window = vitals_rows[:-1][-14:] if len(vitals_rows) > 1 else vitals_rows
    baseline = compute_rolling_baseline(history_window)

    # 2. Z-score flags
    z_flags = zscore_flags(current_point, baseline)

    # 3. IsolationForest model & scoring (with fallback)
    iso_score = 0.0
    method = "zscore_fallback"
    try:
        active_model = model if model is not None else train(vitals_rows)
        if hasattr(active_model, "decision_function"):
            method = "extrapolation+isolation_forest"
        iso_score = score(active_model, current_point)
    except Exception:
        method = "zscore_fallback"

    # 4. Risk flag
    history_cri = cri_history if cri_history is not None else []
    risk = risk_flag(history_cri, z_flags, method=method, crew_id=getattr(current_point, "crewId", None))

    risk["zscore_flags"] = z_flags
    risk["isolation_score"] = round(iso_score, 4)
    return risk
