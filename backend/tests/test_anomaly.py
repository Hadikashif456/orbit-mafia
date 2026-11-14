"""Unit tests for Anomaly Detection and 48-Hour Risk Flag Engine (TRD Section 6)."""

from unittest.mock import patch
import logging
import numpy as np
import pytest

from app.models import VitalPoint
from app.services.anomaly import (
    FEATURES,
    extract_features,
    compute_rolling_baseline,
    zscore_flags,
    train,
    score,
    ScoreResult,
    risk_flag,
    detect_anomalies,
    reset_risk_flag_latch,
)


@pytest.fixture
def healthy_vitals_series() -> list[VitalPoint]:
    """100 sols of baseline healthy vitals data with realistic distributions (TRD Section 4)."""
    rng = np.random.RandomState(42)
    return [
        VitalPoint(
            crewId="C001",
            sol=s,
            hr=round(float(rng.normal(62.0, 3.0)), 1),
            hrv=round(float(rng.normal(65.0, 6.0)), 1),
            sleepHours=round(float(rng.normal(7.2, 0.5)), 1),
            radiationMsv=round(float(rng.normal(1.84, 0.15)), 2),
            exerciseMin=round(float(rng.normal(45.0, 10.0)), 1),
            mood=int(max(1, min(5, round(rng.normal(4.0, 0.5))))),
            provenance="SYNTHETIC",
        )
        for s in range(1, 101)
    ]


@pytest.fixture
def healthy_window(healthy_vitals_series) -> list[VitalPoint]:
    """Recent healthy 3-sol window."""
    return healthy_vitals_series[-3:]


@pytest.fixture
def c002_stressed_window() -> list[VitalPoint]:
    """C002-like stressed window: acute radiation spike, restricted sleep, HR elevated, HRV down."""
    return [
        VitalPoint(
            crewId="C002",
            sol=142,
            hr=66.0,
            hrv=55.0,
            sleepHours=5.4,
            radiationMsv=1.90,
            exerciseMin=35.0,
            mood=3,
            provenance="SYNTHETIC",
        ),
        VitalPoint(
            crewId="C002",
            sol=143,
            hr=72.0,
            hrv=48.0,
            sleepHours=5.2,
            radiationMsv=9.0,  # Acute SPE radiation spike
            exerciseMin=30.0,
            mood=2,
            provenance="SYNTHETIC",
        ),
        VitalPoint(
            crewId="C002",
            sol=144,
            hr=74.0,
            hrv=45.0,
            sleepHours=5.3,
            radiationMsv=4.5,
            exerciseMin=30.0,
            mood=2,
            provenance="SYNTHETIC",
        ),
    ]


def test_extract_features():
    """Verify feature vector has 6 items in correct order."""
    pt = VitalPoint(
        crewId="C001",
        sol=1,
        hr=62.0,
        hrv=65.0,
        sleepHours=7.5,
        radiationMsv=1.84,
        exerciseMin=45.0,
        mood=4,
        provenance="SYNTHETIC",
    )
    feats = extract_features(pt)
    assert len(feats) == 6
    assert feats == [62.0, 65.0, 7.5, 1.84, 45.0, 4.0]


def test_zscore_flags_healthy(healthy_vitals_series):
    """Verify that a normal healthy data point generates 0 z-score flags."""
    baseline = compute_rolling_baseline(healthy_vitals_series[:14])
    # A point near the mean
    normal_point = VitalPoint(
        crewId="C001",
        sol=101,
        hr=62.0,
        hrv=65.0,
        sleepHours=7.2,
        radiationMsv=1.84,
        exerciseMin=45.0,
        mood=4,
        provenance="SYNTHETIC",
    )
    flags = zscore_flags(normal_point, baseline)

    assert isinstance(flags, dict)
    assert set(flags.keys()) == set(FEATURES)
    assert all(flag is False for flag in flags.values())


def test_zscore_flags_anomalous(healthy_vitals_series):
    """Verify that extreme deviations (|z| > 2.5) trigger per-metric flags."""
    baseline = compute_rolling_baseline(healthy_vitals_series[:14])
    anomalous_point = VitalPoint(
        crewId="C002",
        sol=143,
        hr=85.0,          # baseline ~62, std ~3.0 -> z > 7.0
        hrv=35.0,         # baseline ~65, std ~6.0 -> |z| > 5.0
        sleepHours=4.0,   # baseline ~7.2, std ~0.5 -> |z| > 6.0
        radiationMsv=9.0, # baseline ~1.84, std ~0.15 -> z > 40.0
        exerciseMin=45.0,
        mood=4,
        provenance="SYNTHETIC",
    )
    flags = zscore_flags(anomalous_point, baseline)
    assert flags["hr"] is True
    assert flags["hrv"] is True
    assert flags["sleep"] is True
    assert flags["radiation"] is True
    assert flags["exercise"] is False


def test_isolation_forest_train_and_score(healthy_vitals_series, c002_stressed_window):
    """Verify IsolationForest trains in-memory and scores healthy > anomalous."""
    model = train(healthy_vitals_series)
    assert model is not None

    healthy_pt = VitalPoint(
        crewId="C001",
        sol=101,
        hr=62.0,
        hrv=65.0,
        sleepHours=7.2,
        radiationMsv=1.84,
        exerciseMin=45.0,
        mood=4,
        provenance="SYNTHETIC",
    )
    healthy_score, healthy_method = score(model, healthy_pt)
    stressed_score, stressed_method = score(model, c002_stressed_window[1])  # Sol 143 acute spike

    # Lower score = more anomalous
    assert stressed_score < healthy_score
    assert healthy_score > 0.0
    assert stressed_score < 0.0
    assert healthy_method == "isolation_forest"
    assert stressed_method == "isolation_forest"


def test_risk_flag_healthy():
    """Verify that stable CRI history and 0 anomalies produce flag=False."""
    cri_history = [85.0, 84.8, 85.0]
    anomaly_flags = {feat: False for feat in FEATURES}
    res = risk_flag(cri_history, anomaly_flags)

    assert res["flag"] is False
    assert res["predictedWindowHours"] == 48
    assert isinstance(res["drivers"], list)
    assert len(res["drivers"]) == 0
    assert "method" in res


def test_risk_flag_trajectory_decline():
    """Verify that linear extrapolation predicting CRI < 60 at sol+2 raises flag=True."""
    # Steep decline: 82.0 -> 72.0 -> 61.0
    # slope = (61 - 82)/2 = -10.5, mean = 71.67
    # extrapolated at sol+2 = 71.67 + 3*(-10.5) = 40.17 < 60.0
    cri_history = [82.0, 72.0, 61.0]
    anomaly_flags = {feat: False for feat in FEATURES}
    res = risk_flag(cri_history, anomaly_flags)

    assert res["flag"] is True
    assert res["predictedWindowHours"] == 48
    assert res["predicted_cri"] < 60.0
    assert len(res["drivers"]) > 0


def test_risk_flag_multiple_metric_anomalies():
    """Verify that >= 2 metric anomalies raise flag=True even if CRI is currently high."""
    cri_history = [84.0, 84.0, 83.0]
    anomaly_flags = {"radiation": True, "sleep": True, "hr": False, "hrv": False, "exercise": False, "mood": False}
    res = risk_flag(cri_history, anomaly_flags)

    assert res["flag"] is True
    assert res["predictedWindowHours"] == 48
    assert any("Radiation" in d for d in res["drivers"])
    assert any("Sleep" in d for d in res["drivers"])


def test_detect_anomalies_healthy_vs_c002(healthy_vitals_series, c002_stressed_window):
    """End-to-end check: detect_anomalies returns flag=False for healthy, flag=True for C002."""
    model = train(healthy_vitals_series)

    # 1. Healthy astronaut
    healthy_res = detect_anomalies(
        vitals_history=healthy_vitals_series,
        cri_history=[85.0, 85.0, 85.0],
        model=model,
    )
    assert healthy_res["flag"] is False
    assert healthy_res["method"] == "extrapolation+isolation_forest"

    # 2. Stressed C002 astronaut
    c002_vitals = healthy_vitals_series[:14] + c002_stressed_window
    c002_res = detect_anomalies(
        vitals_history=c002_vitals,
        cri_history=[82.0, 75.0, 61.2],
        model=model,
    )
    assert c002_res["flag"] is True
    assert c002_res["method"] == "extrapolation+isolation_forest"
    assert len(c002_res["drivers"]) >= 1


def test_fallback_when_isolation_forest_fails(healthy_vitals_series, c002_stressed_window):
    """Verify that if sklearn IsolationForest raises, system falls back to z-score without crashing."""
    with patch("sklearn.ensemble.IsolationForest", side_effect=RuntimeError("Simulated scikit-learn failure")):
        # train should not raise, but return fallback baseline dict
        model = train(healthy_vitals_series)
        assert isinstance(model, dict)

        # score should return fallback score without crashing
        normal_sc, method1 = score(model, healthy_vitals_series[-1])
        stressed_sc, method2 = score(model, c002_stressed_window[1])
        assert isinstance(normal_sc, float)
        assert isinstance(stressed_sc, float)
        assert stressed_sc < normal_sc
        assert method1 == "zscore_fallback"
        assert method2 == "zscore_fallback"

        # detect_anomalies should run cleanly with fallback method
        c002_vitals = healthy_vitals_series[:14] + c002_stressed_window
        res = detect_anomalies(
            vitals_history=c002_vitals,
            cri_history=[82.0, 75.0, 61.2],
            model=model,
        )
        assert res["flag"] is True
        assert res["method"] == "zscore_fallback"


def test_risk_flag_stability_no_flicker():
    """Verify flicker prevention across Sol 141-143: once raised, flag stays raised until 2 consecutive green sols."""
    reset_risk_flag_latch("C002")

    history = [
        {"sol": 140, "cri": 98.8, "anomaly_flags": {}},
        {"sol": 141, "cri": 92.6, "anomaly_flags": {"sleep": True, "mood": True}},
        {"sol": 142, "cri": 85.0, "anomaly_flags": {"sleep": True}},
        {"sol": 143, "cri": 58.8, "anomaly_flags": {"hr": True, "hrv": True, "radiation": True}},
        {"sol": 144, "cri": 80.0, "anomaly_flags": {}},
        {"sol": 145, "cri": 82.0, "anomaly_flags": {}},
    ]

    # Sol 141: 2 metric anomalies trigger flag
    r141 = risk_flag([98.8, 98.8, 92.6], {"sleep": True, "mood": True}, crew_id="C002", history=history, sol=141)
    assert r141["flag"] is True

    # Sol 142: Only 1 metric anomaly, CRI=85.0 (green). Without latching, this would flicker to False.
    r142 = risk_flag([98.8, 92.6, 85.0], {"sleep": True}, crew_id="C002", history=history, sol=142)
    assert r142["flag"] is True, "Flag should remain latched on Sol 142 (no flicker)"

    # Sol 143: Acute spike (amber CRI=58.8), flag stays raised
    r143 = risk_flag([92.6, 85.0, 58.8], {"hr": True, "hrv": True, "radiation": True}, crew_id="C002", history=history, sol=143)
    assert r143["flag"] is True

    # Recovery Sol 1: CRI back to green (80.0), streak = 1 -> flag still latched
    r_rec1 = risk_flag([85.0, 58.8, 80.0], {}, crew_id="C002", history=history, sol=144)
    assert r_rec1["flag"] is True, "Flag should still be latched after only 1 green sol"

    # Recovery Sol 2: 2nd consecutive green sol (82.0), streak = 2 -> latch clears!
    r_rec2 = risk_flag([58.8, 80.0, 82.0], {}, crew_id="C002", history=history, sol=145)
    assert r_rec2["flag"] is False, "Flag should unlatch after 2 consecutive green sols"


def test_risk_flag_order_independence_140_to_145():
    """Task 6(a): Calling sols in order 140..145, 145..140, and random order gives identical results every time."""
    import random

    history = [
        {"sol": 140, "cri": 98.8, "anomaly_flags": {}},
        {"sol": 141, "cri": 92.6, "anomaly_flags": {"sleep": True, "mood": True}},
        {"sol": 142, "cri": 85.0, "anomaly_flags": {"sleep": True}},
        {"sol": 143, "cri": 58.8, "anomaly_flags": {"hr": True, "hrv": True, "radiation": True}},
        {"sol": 144, "cri": 80.0, "anomaly_flags": {}},
        {"sol": 145, "cri": 82.0, "anomaly_flags": {}},
    ]

    def evaluate_sol(s: int) -> dict:
        cri_window = [h["cri"] for h in history if h["sol"] <= s][-3:]
        anomalies = next(h["anomaly_flags"] for h in history if h["sol"] == s)
        return risk_flag(cri_window, anomalies, crew_id="C002", history=history, sol=s)

    # 1. Forward sequential: 140 -> 145
    forward_results = {s: evaluate_sol(s) for s in range(140, 146)}

    # 2. Backward reverse: 145 -> 140
    backward_results = {s: evaluate_sol(s) for s in reversed(range(140, 146))}

    # 3. Multiple random permutations
    rng = random.Random(42)
    random_runs = []
    for _ in range(10):
        sols_shuffled = list(range(140, 146))
        rng.shuffle(sols_shuffled)
        random_runs.append({s: evaluate_sol(s) for s in sols_shuffled})

    # Assert exact identity across all orders
    for s in range(140, 146):
        assert forward_results[s]["flag"] == backward_results[s]["flag"], f"Forward vs backward mismatch at Sol {s}"
        assert forward_results[s]["drivers"] == backward_results[s]["drivers"]
        assert forward_results[s]["predicted_cri"] == backward_results[s]["predicted_cri"]

        for run in random_runs:
            assert run[s]["flag"] == forward_results[s]["flag"], f"Random run mismatch at Sol {s}"
            assert run[s]["drivers"] == forward_results[s]["drivers"]
            assert run[s]["predicted_cri"] == forward_results[s]["predicted_cri"]

    # Verify expected business rules per sol
    assert forward_results[140]["flag"] is False
    assert forward_results[141]["flag"] is True
    assert forward_results[142]["flag"] is True   # Latched from Sol 141
    assert forward_results[143]["flag"] is True   # Acute radiation spike
    assert forward_results[144]["flag"] is True   # Recovery sol 1 (streak=1)
    assert forward_results[145]["flag"] is False  # Recovery sol 2 (streak=2 -> unlatched)


def test_risk_flag_concurrency_50_threads():
    """Task 6(b): 50 threads calling with mixed sols give identical results to sequential calls."""
    from concurrent.futures import ThreadPoolExecutor
    import random

    history = [
        {"sol": 140, "cri": 98.8, "anomaly_flags": {}},
        {"sol": 141, "cri": 92.6, "anomaly_flags": {"sleep": True, "mood": True}},
        {"sol": 142, "cri": 85.0, "anomaly_flags": {"sleep": True}},
        {"sol": 143, "cri": 58.8, "anomaly_flags": {"hr": True, "hrv": True, "radiation": True}},
        {"sol": 144, "cri": 80.0, "anomaly_flags": {}},
        {"sol": 145, "cri": 82.0, "anomaly_flags": {}},
    ]

    def evaluate_sol(s: int) -> dict:
        cri_window = [h["cri"] for h in history if h["sol"] <= s][-3:]
        anomalies = next(h["anomaly_flags"] for h in history if h["sol"] == s)
        return risk_flag(cri_window, anomalies, crew_id="C002", history=history, sol=s)

    baseline = {s: evaluate_sol(s) for s in range(140, 146)}

    # Generate 200 tasks calling random sols across 50 worker threads
    rng = random.Random(123)
    tasks = [rng.choice(list(range(140, 146))) for _ in range(200)]

    with ThreadPoolExecutor(max_workers=50) as executor:
        results = list(executor.map(evaluate_sol, tasks))

    for sol, res in zip(tasks, results):
        assert res["flag"] == baseline[sol]["flag"], f"Concurrency mismatch at sol {sol}"
        assert res["drivers"] == baseline[sol]["drivers"]
        assert res["predicted_cri"] == baseline[sol]["predicted_cri"]


def test_risk_flag_healthy_vs_stressed_window():
    """Task 6(c): Healthy window not flagged; C002-like window flagged."""
    # 1. Healthy window: stable CRI, 0 anomalies
    healthy_cri = [85.0, 84.8, 85.0]
    healthy_anomalies = {feat: False for feat in FEATURES}
    healthy_res = risk_flag(healthy_cri, healthy_anomalies, crew_id="C001")
    assert healthy_res["flag"] is False
    assert len(healthy_res["drivers"]) == 0
    assert healthy_res["predicted_cri"] >= 75.0

    # 2. C002-like stressed window: acute radiation spike, elevated HR, depressed HRV
    stressed_cri = [92.6, 85.0, 58.8]
    stressed_anomalies = {"radiation": True, "hr": True, "hrv": True, "sleep": False, "exercise": False, "mood": False}
    stressed_res = risk_flag(stressed_cri, stressed_anomalies, crew_id="C002")
    assert stressed_res["flag"] is True
    assert len(stressed_res["drivers"]) >= 1
    assert any("Radiation" in d for d in stressed_res["drivers"])


def test_risk_flag_release_after_3_consecutive_green_sols():
    """Task 6(d): Release behaviour after 3 consecutive green sols matches the old semantics."""
    history = [
        {"sol": 140, "cri": 98.8, "anomaly_flags": {}},
        {"sol": 141, "cri": 58.8, "anomaly_flags": {"radiation": True, "hr": True}},  # Triggers latch ON
        {"sol": 142, "cri": 80.0, "anomaly_flags": {}},  # Green 1: CRI 80.0, but extrapolation from 98.8->58.8->80 is <60
        {"sol": 143, "cri": 82.0, "anomaly_flags": {}},  # Green 2: CRI 82.0, streak = 1 -> remains latched
        {"sol": 144, "cri": 84.0, "anomaly_flags": {}},  # Green 3: CRI 84.0, streak = 2 -> latch releases!
    ]

    # Sol 141: Acute drop into amber/red (<60) triggers flag
    r141 = risk_flag([98.8, 58.8], {"radiation": True, "hr": True}, crew_id="C002", history=history, sol=141)
    assert r141["flag"] is True

    # Sol 142 (Green sol 1): CRI 80.0 >= 75.0, 0 anomalies. Extrapolation still <60 -> flag stays True.
    r142 = risk_flag([98.8, 58.8, 80.0], {}, crew_id="C002", history=history, sol=142)
    assert r142["flag"] is True, "Flag must remain latched on 1st green sol"

    # Sol 143 (Green sol 2): CRI 82.0 >= 75.0, 0 anomalies. streak = 1 -> remains latched.
    r143 = risk_flag([58.8, 80.0, 82.0], {}, crew_id="C002", history=history, sol=143)
    assert r143["flag"] is True, "Flag must remain latched on 2nd green sol while streak < 2"

    # Sol 144 (Green sol 3): CRI 84.0 >= 75.0, 0 anomalies. streak = 2 -> latch releases!
    r144 = risk_flag([80.0, 82.0, 84.0], {}, crew_id="C002", history=history, sol=144)
    assert r144["flag"] is False, "Flag must release after 3 consecutive green sols (streak >= 2)"


def test_risk_flag_fewer_than_3_cri_values():
    """Task 6(e): Fewer than 3 CRI values handled gracefully (2, 1, 0 values)."""
    # 1. Two CRI values: steep decline slope y2 + 2*(y2 - y1)
    res_2_decline = risk_flag([85.0, 70.0], {}, crew_id="C001")
    # slope = 70 - 85 = -15 -> predicted = 70 + 2*(-15) = 40.0 < 60
    assert res_2_decline["flag"] is True
    assert res_2_decline["predicted_cri"] == 40.0
    assert res_2_decline["predictedWindowHours"] == 48

    # Two CRI values: stable
    res_2_stable = risk_flag([85.0, 85.0], {}, crew_id="C001")
    assert res_2_stable["flag"] is False
    assert res_2_stable["predicted_cri"] == 85.0

    # 2. One CRI value: predicted_cri equals that single value
    res_1 = risk_flag([55.0], {}, crew_id="C001")
    assert res_1["predicted_cri"] == 55.0
    assert res_1["flag"] is True  # 55.0 < 60.0

    res_1_green = risk_flag([85.0], {}, crew_id="C001")
    assert res_1_green["predicted_cri"] == 85.0
    assert res_1_green["flag"] is False

    # 3. Zero CRI values: defaults safely to predicted_cri=100.0 without error
    res_0 = risk_flag([], {}, crew_id="C001")
    assert res_0["predicted_cri"] == 100.0
    assert res_0["flag"] is False
    assert res_0["predictedWindowHours"] == 48


def test_risk_flag_healthy_crew_never_raises():
    """Verify that a healthy crew member with nominal vitals never raises the risk flag."""
    reset_risk_flag_latch("C001")

    # 10 sols of healthy vitals (CRI 90-95, <= 1 sporadic anomaly)
    healthy_cri_sequence = [95.0, 94.5, 95.2, 94.8, 95.0, 93.9, 94.2, 95.1, 94.7, 95.0]
    for idx in range(2, len(healthy_cri_sequence)):
        window = healthy_cri_sequence[idx - 2 : idx + 1]
        # At most 1 sporadic single anomaly
        anomalies = {"hr": True} if idx == 5 else {}
        res = risk_flag(window, anomalies, crew_id="C001")
        assert res["flag"] is False, f"Healthy crew member raised flag on step {idx}"
        assert res["predictedWindowHours"] == 48


def test_decision_function_runtime_error_reports_zscore_fallback_and_flag_works(
    c002_stressed_window, healthy_vitals_series, caplog
):
    """Test 4.1: A model whose decision_function raises RuntimeError => method is 'zscore_fallback' and flag still works."""
    class CrashingModel:
        def decision_function(self, X):
            raise RuntimeError("Simulated internal scikit-learn tree evaluation crash")

    crashing_model = CrashingModel()

    # 1. Direct score() check: returns fallback score and method='zscore_fallback'
    with caplog.at_level(logging.WARNING):
        score_val, method = score(crashing_model, c002_stressed_window[1])
    assert isinstance(score_val, float)
    assert method == "zscore_fallback"
    # Verify ONE short warning was logged without sensitive payload
    warnings = [r for r in caplog.records if r.levelname == "WARNING" and "decision_function failed" in r.message]
    assert len(warnings) == 1
    assert "RuntimeError" in warnings[0].message
    assert "C002" not in warnings[0].message

    # 2. detect_anomalies check: stressed C002 still triggers flag=True via z-score and reports 'zscore_fallback'
    c002_vitals = healthy_vitals_series[:14] + c002_stressed_window
    res_stressed = detect_anomalies(
        vitals_history=c002_vitals,
        cri_history=[82.0, 75.0, 61.2],
        model=crashing_model,
    )
    assert res_stressed["method"] == "zscore_fallback"
    assert res_stressed["flag"] is True
    assert len(res_stressed["drivers"]) >= 1

    # 3. Healthy data with crashing model: flag is False, method is 'zscore_fallback'
    res_healthy = detect_anomalies(
        vitals_history=healthy_vitals_series,
        cri_history=[85.0, 85.0, 85.0],
        model=crashing_model,
    )
    assert res_healthy["method"] == "zscore_fallback"
    assert res_healthy["flag"] is False


def test_healthy_model_reports_normal_method_string(healthy_vitals_series):
    """Test 4.2: A healthy model => normal method string ('extrapolation+isolation_forest')."""
    model = train(healthy_vitals_series)
    assert hasattr(model, "decision_function")

    # 1. Direct score() check
    score_val, method = score(model, healthy_vitals_series[-1])
    assert isinstance(score_val, float)
    assert method == "isolation_forest"

    # 2. detect_anomalies check
    res = detect_anomalies(
        vitals_history=healthy_vitals_series,
        cri_history=[85.0, 85.0, 85.0],
        model=model,
    )
    assert res["method"] == "extrapolation+isolation_forest"
    assert res["flag"] is False


def test_sklearn_import_failure_simulated_uses_zscore_and_correct_method(
    healthy_vitals_series, c002_stressed_window, caplog
):
    """Test 4.3: sklearn import failure simulated => z-score only and correct method ('zscore_fallback')."""
    with patch.dict("sys.modules", {"sklearn.ensemble": None}):
        with caplog.at_level(logging.WARNING):
            model = train(healthy_vitals_series)
        assert isinstance(model, dict)
        assert not hasattr(model, "decision_function")

        # Verify ONE short warning was logged for fallback event
        train_warnings = [r for r in caplog.records if r.levelname == "WARNING" and "training failed" in r.message]
        assert len(train_warnings) == 1
        assert "ModuleNotFoundError" in train_warnings[0].message

        # Direct score check
        sc_val, sc_method = score(model, healthy_vitals_series[-1])
        assert isinstance(sc_val, float)
        assert sc_method == "zscore_fallback"

        # End-to-end detect_anomalies check
        c002_vitals = healthy_vitals_series[:14] + c002_stressed_window
        res = detect_anomalies(
            vitals_history=c002_vitals,
            cri_history=[82.0, 75.0, 61.2],
            model=model,
        )
        assert res["method"] == "zscore_fallback"
        assert res["flag"] is True
        assert len(res["drivers"]) >= 1


