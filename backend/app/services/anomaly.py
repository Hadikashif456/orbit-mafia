"""Anomaly detection and 48-hour risk flag engine.

Combines rolling 14-sol z-score thresholding with scikit-learn IsolationForest
to detect anomalous physiological drift and extrapolate CRI trajectory ~48 hours ahead.
Pure functions over lists of VitalPoint and CRI values (no database, no external I/O).
"""

from typing import List, Dict, Any, Optional, Sequence, Union, Tuple, NamedTuple
import logging
import math

from app.models import VitalPoint
from app.services.cri_constants import STATUS_GREEN_MIN

logger = logging.getLogger("orbitmafia.anomaly")

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
    except (ImportError, ModuleNotFoundError, ValueError, TypeError, RuntimeError) as exc:
        logger.warning(
            "IsolationForest training failed, falling back to rolling baseline: %s",
            type(exc).__name__,
        )
        return compute_rolling_baseline(vitals_rows)
    except Exception as exc:
        logger.warning(
            "Unexpected error during IsolationForest training, falling back to rolling baseline: %s",
            type(exc).__name__,
        )
        return compute_rolling_baseline(vitals_rows)


class ScoreResult(NamedTuple):
    score: float
    method: str


def score(model: Any, vitals_row: VitalPoint) -> ScoreResult:
    """Scores a vitals row using the model. Lower score = more anomalous.
    
    If model has decision_function (IsolationForest), returns float decision_function value
    together with method 'isolation_forest'.
    If sklearn fails or fallback model is used, computes a z-score-based anomaly score
    together with method 'zscore_fallback'.
    """
    if hasattr(model, "decision_function"):
        try:
            x = [extract_features(vitals_row)]
            raw_score = float(model.decision_function(x)[0])
            return ScoreResult(raw_score, "isolation_forest")
        except (ValueError, TypeError, RuntimeError, AttributeError) as exc:
            logger.warning(
                "IsolationForest decision_function failed, falling back to z-score: %s",
                type(exc).__name__,
            )
        except Exception as exc:
            logger.warning(
                "Unexpected error during IsolationForest scoring, falling back to z-score: %s",
                type(exc).__name__,
            )

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
    fallback_score = float((2.5 - max_z) / 10.0)
    return ScoreResult(fallback_score, "zscore_fallback")


def reset_risk_flag_latch(crew_id: Optional[str] = None) -> None:
    """Legacy helper maintained for backwards compatibility.

    The risk_flag engine is now completely pure and stateless.
    Latching and recovery streaks are derived deterministically from inputs
    (either via the optional `history` parameter or the CRI trajectory),
    eliminating all mutable module-level state.
    """
    pass


def _extract_anomalous_metrics(anomaly_flags: Any) -> List[str]:
    """Helper to extract names of anomalous metrics from dict, set, list, or tuple."""
    if isinstance(anomaly_flags, dict):
        return [k for k, v in anomaly_flags.items() if bool(v)]
    elif isinstance(anomaly_flags, (list, tuple, set)):
        return [str(k) for k in anomaly_flags]
    return []


def _normalize_history_entries(
    history: Any,
    crew_id: Optional[str] = None,
    target_sol: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Normalizes various history representations (dicts, lists of dicts, tuples, objects)
    into a uniform chronological list of step dictionaries.
    """
    if not history:
        return []

    raw_items: List[Any] = []
    if isinstance(history, dict):
        try:
            sorted_keys = sorted(history.keys(), key=lambda k: int(k))
        except (ValueError, TypeError):
            sorted_keys = list(history.keys())
        raw_items = [history[k] for k in sorted_keys]
    elif isinstance(history, (list, tuple)):
        raw_items = list(history)
    else:
        raw_items = [history]

    normalized: List[Dict[str, Any]] = []
    for item in raw_items:
        entry: Dict[str, Any] = {}
        if isinstance(item, dict):
            entry = dict(item)
        elif isinstance(item, (list, tuple)):
            if len(item) >= 3:
                entry["sol"] = item[0]
                entry["cri"] = item[1]
                entry["anomaly_flags"] = item[2]
                if len(item) >= 4:
                    entry["contributions"] = item[3]
            elif len(item) == 2:
                entry["cri"] = item[0]
                entry["anomaly_flags"] = item[1]
            elif len(item) == 1:
                entry["cri"] = item[0]
        else:
            entry["sol"] = getattr(item, "sol", None)
            entry["cri"] = getattr(item, "cri", None)
            entry["anomaly_flags"] = getattr(item, "anomaly_flags", getattr(item, "anomalies", None))
            entry["contributions"] = getattr(item, "contributions", None)
            entry["crew_id"] = getattr(item, "crewId", getattr(item, "crew_id", None))

        # Check crew_id match if entry explicitly provides one
        entry_cid = entry.get("crew_id") or entry.get("crewId")
        if crew_id is not None and entry_cid is not None and str(entry_cid) != str(crew_id):
            continue

        # Filter up to target_sol if specified
        entry_sol = entry.get("sol")
        if target_sol is not None and entry_sol is not None:
            try:
                if int(entry_sol) > int(target_sol):
                    continue
            except (ValueError, TypeError):
                pass

        normalized.append(entry)

    return normalized


def risk_flag(
    cri_history: Sequence[Any],
    anomaly_flags: Any,
    contributions: Optional[Dict[str, float]] = None,
    method: Optional[str] = None,
    crew_id: Optional[str] = None,
    history: Optional[Any] = None,
    sol: Optional[int] = None,
) -> Dict[str, Any]:
    """Computes 48-hour risk flag using CRI linear extrapolation and anomaly flags.

    TRD Section 6 rule:
        - Linear extrapolation of the last 3 CRI values to sol+2.
        - Raise 'risk in ~48h' flag if predicted CRI < 60 OR anomaly on >= 2 metrics in the same sol.
        - Stability rule: once raised for a crew member, the flag stays raised until CRI is
          at or above the green threshold (>= 75.0) for 2 consecutive sols.
        - Returns {flag, predictedWindowHours: 48, drivers, method, predicted_cri}.

    Pure Function Guarantees:
        - Fully deterministic and stateless: output depends ONLY on the passed inputs.
        - Free of module-level mutable state; thread-safe and safe for scrubbing/replaying.

    Limitation when history is None:
        When `history` is omitted, the engine derives latching and recovery solely from
        the CRI trajectory in `cri_history` (e.g. past values in the window dropping below 60.0
        and subsequent green streak count) and the current sol's `anomaly_flags`.
        Multi-metric anomaly flags that occurred on earlier sols outside the current sol
        cannot be inferred without `history`; pass `history` (the sequence of past sol
        records up to the requested sol) to preserve cross-sol multi-metric anomaly latching.

    Args:
        cri_history: List of CRI values (floats or CRIResult objects).
        anomaly_flags: Dict of metric -> bool (from zscore_flags) or list/set of flagged metrics.
        contributions: Optional CRI contributions breakdown dict.
        method: Optional method string descriptor.
        crew_id: Optional crew identifier for per-astronaut latch tracking.
        history: Optional sequence or dict of historical sol records up to current sol.
        sol: Optional target sol number for filtering history.

    Returns:
        Dict with keys: flag, predictedWindowHours, drivers, method, predicted_cri.
    """
    # 1. Parse CRI values from current window
    cri_vals: List[float] = []
    for c in cri_history:
        if hasattr(c, "cri"):
            cri_vals.append(float(c.cri))
        elif isinstance(c, (int, float)):
            cri_vals.append(float(c))

    cid = crew_id
    if cid is None and cri_history:
        first = cri_history[-1]
        cid = getattr(first, "crewId", None) or getattr(first, "crew_id", None)

    # 2. Normalize history steps
    steps = _normalize_history_entries(history, crew_id=cid, target_sol=sol)

    # 3. If history is provided, execute deterministic state machine over history steps
    if steps:
        # Check if current call needs to be appended to steps
        # If the last step in steps has a sol < sol, or differs from current inputs, append current call
        current_cri_val = cri_vals[-1] if cri_vals else 100.0
        last_step = steps[-1]
        last_sol = last_step.get("sol")

        if sol is not None and last_sol is not None:
            if int(last_sol) < int(sol):
                steps.append({
                    "sol": sol,
                    "cri_history": cri_vals,
                    "cri": current_cri_val,
                    "anomaly_flags": anomaly_flags,
                    "contributions": contributions,
                })
        else:
            # If last step lacks cri_history or anomaly_flags, populate with current inputs
            if "cri_history" not in last_step and cri_vals:
                last_step["cri_history"] = cri_vals
            if "anomaly_flags" not in last_step and anomaly_flags:
                last_step["anomaly_flags"] = anomaly_flags
            if "contributions" not in last_step and contributions:
                last_step["contributions"] = contributions

        is_latched = False
        green_streak = 0
        last_drivers: List[str] = []
        final_flag = False
        predicted_cri = 100.0
        cri_condition = False
        metric_condition = False
        drivers: List[str] = []
        running_cris: List[float] = []

        for step in steps:
            step_cri = step.get("cri")
            if step_cri is not None:
                running_cris.append(float(step_cri))

            step_cri_hist = step.get("cri_history")
            if step_cri_hist:
                step_vals = [float(x.cri if hasattr(x, "cri") else x) for x in step_cri_hist]
            else:
                step_vals = running_cris[-3:] if len(running_cris) >= 3 else list(running_cris)

            current_cri = step_vals[-1] if step_vals else (float(step_cri) if step_cri is not None else 100.0)

            # Linear extrapolation to sol+2
            if len(step_vals) >= 3:
                y1, y2, y3 = step_vals[-3], step_vals[-2], step_vals[-1]
                m = (y3 - y1) / 2.0
                y_bar = (y1 + y2 + y3) / 3.0
                predicted_cri = y_bar + 3.0 * m
            elif len(step_vals) == 2:
                m = step_vals[-1] - step_vals[-2]
                predicted_cri = step_vals[-1] + 2.0 * m
            elif len(step_vals) == 1:
                predicted_cri = step_vals[0]
            else:
                predicted_cri = 100.0

            step_anomalies = _extract_anomalous_metrics(step.get("anomaly_flags"))
            cri_condition = bool(predicted_cri < 60.0)
            metric_condition = bool(len(step_anomalies) >= 2)
            raw_flag = bool(cri_condition or metric_condition)

            # Latch state transition
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

            # Determine drivers for this step
            step_contribs = step.get("contributions")
            drivers = []
            if step_contribs:
                top_contribs = sorted(
                    [(k, v) for k, v in step_contribs.items() if v > 0],
                    key=lambda item: item[1],
                    reverse=True,
                )
                drivers = [DRIVER_MAP.get(k.lower(), k.capitalize()) for k, _ in top_contribs[:3]]

            if not drivers and step_anomalies:
                drivers = [DRIVER_MAP.get(m.lower(), m) for m in step_anomalies][:3]

            if not drivers and is_latched:
                drivers = list(last_drivers)

            if final_flag and not drivers:
                if cri_condition:
                    drivers.append("Projected CRI decline (<60)")
                if metric_condition:
                    drivers.append("Multiple biometric anomalies")

            if drivers:
                last_drivers = list(drivers)

        effective_method = method or "isolation_forest+zscore+extrapolation"
        return {
            "flag": final_flag,
            "predictedWindowHours": 48,
            "drivers": drivers,
            "method": effective_method,
            "predicted_cri": round(max(0.0, min(100.0, predicted_cri)), 1),
        }

    # 4. Fallback when history is None: compute purely from available window
    if len(cri_vals) >= 3:
        y1, y2, y3 = cri_vals[-3], cri_vals[-2], cri_vals[-1]
        m = (y3 - y1) / 2.0
        y_bar = (y1 + y2 + y3) / 3.0
        predicted_cri = y_bar + 3.0 * m
    elif len(cri_vals) == 2:
        m = cri_vals[-1] - cri_vals[-2]
        predicted_cri = cri_vals[-1] + 2.0 * m
    elif len(cri_vals) == 1:
        predicted_cri = cri_vals[0]
    else:
        predicted_cri = 100.0

    anomalous_metrics = _extract_anomalous_metrics(anomaly_flags)
    cri_condition = bool(predicted_cri < 60.0)
    metric_condition = bool(len(anomalous_metrics) >= 2)
    raw_flag = bool(cri_condition or metric_condition)

    current_cri = cri_vals[-1] if cri_vals else 100.0

    # Latch evaluation from available CRI window:
    # If raw_flag fires -> latched True
    # If raw_flag is False: check if earlier CRI value in window triggered latch (<60)
    # and whether fewer than 2 green sols have elapsed.
    if raw_flag:
        final_flag = True
        is_latched = True
    else:
        is_latched = False
        final_flag = False
        if len(cri_vals) >= 2:
            # Check if previous sol was in warning/critical (<60) and current sol is first green sol
            if cri_vals[-2] < 60.0 and current_cri >= STATUS_GREEN_MIN:
                is_latched = True
                final_flag = True

    # 5. Determine drivers
    drivers = []
    if contributions:
        top_contribs = sorted(
            [(k, v) for k, v in contributions.items() if v > 0],
            key=lambda item: item[1],
            reverse=True,
        )
        drivers = [DRIVER_MAP.get(k.lower(), k.capitalize()) for k, _ in top_contribs[:3]]

    if not drivers and anomalous_metrics:
        drivers = [DRIVER_MAP.get(m.lower(), m) for m in anomalous_metrics][:3]

    if final_flag and not drivers:
        if cri_condition:
            drivers.append("Projected CRI decline (<60)")
        if metric_condition:
            drivers.append("Multiple biometric anomalies")

    effective_method = method or "isolation_forest+zscore+extrapolation"
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
    history: Optional[Any] = None,
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
        score_res = score(active_model, current_point)
        iso_score = score_res.score
        if score_res.method == "isolation_forest":
            method = "extrapolation+isolation_forest"
        else:
            method = "zscore_fallback"
    except (ValueError, TypeError, RuntimeError, AttributeError) as exc:
        logger.warning(
            "Anomaly detection pipeline failed, falling back to z-score: %s",
            type(exc).__name__,
        )
        method = "zscore_fallback"
        score_res = score(baseline, current_point)
        iso_score = score_res.score
    except Exception as exc:
        logger.warning(
            "Unexpected error in anomaly detection pipeline, falling back to z-score: %s",
            type(exc).__name__,
        )
        method = "zscore_fallback"
        score_res = score(baseline, current_point)
        iso_score = score_res.score

    # 4. Risk flag
    history_cri = cri_history if cri_history is not None else []
    target_sol = getattr(current_point, "sol", sol)
    risk = risk_flag(
        history_cri,
        z_flags,
        method=method,
        crew_id=getattr(current_point, "crewId", None),
        history=history,
        sol=target_sol,
    )

    risk["zscore_flags"] = z_flags
    risk["isolation_score"] = round(iso_score, 4)
    return risk
