"""Unit tests for Anomaly Detection and 48-Hour Risk Flag Engine (TRD Section 6)."""

from unittest.mock import patch
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
    risk_flag,
    detect_anomalies,
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
    healthy_score = score(model, healthy_pt)
    stressed_score = score(model, c002_stressed_window[1])  # Sol 143 acute spike

    # Lower score = more anomalous
    assert stressed_score < healthy_score
    assert healthy_score > 0.0
    assert stressed_score < 0.0


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

    # 2. Stressed C002 astronaut
    c002_vitals = healthy_vitals_series[:14] + c002_stressed_window
    c002_res = detect_anomalies(
        vitals_history=c002_vitals,
        cri_history=[82.0, 75.0, 61.2],
        model=model,
    )
    assert c002_res["flag"] is True
    assert len(c002_res["drivers"]) >= 1


def test_fallback_when_isolation_forest_fails(healthy_vitals_series, c002_stressed_window):
    """Verify that if sklearn IsolationForest raises, system falls back to z-score without crashing."""
    with patch("sklearn.ensemble.IsolationForest", side_effect=RuntimeError("Simulated scikit-learn failure")):
        # train should not raise, but return fallback baseline dict
        model = train(healthy_vitals_series)
        assert isinstance(model, dict)

        # score should return fallback score without crashing
        normal_sc = score(model, healthy_vitals_series[-1])
        stressed_sc = score(model, c002_stressed_window[1])
        assert isinstance(normal_sc, float)
        assert isinstance(stressed_sc, float)
        assert stressed_sc < normal_sc

        # detect_anomalies should run cleanly with fallback method
        c002_vitals = healthy_vitals_series[:14] + c002_stressed_window
        res = detect_anomalies(
            vitals_history=c002_vitals,
            cri_history=[82.0, 75.0, 61.2],
            model=model,
        )
        assert res["flag"] is True
        assert "fallback" in res["method"] or "zscore" in res["method"]
