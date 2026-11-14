"""Unit tests for CRI Calculation Engine (TRD Section 5 & PRD FR-2.3)."""

import pytest
from app.models import VitalPoint, Biomarker
from app.services.cri_constants import (
    CRI_WEIGHTS,
    STATUS_GREEN_MIN,
    STATUS_AMBER_MIN,
    get_cri_status,
)
from app.services.cri_engine import (
    Baseline,
    get_baseline,
    compute_cri,
    compute_inflammation_score,
    stress_radiation,
    stress_sleep,
    stress_cardio,
    stress_mood,
)


@pytest.fixture
def standard_baseline() -> Baseline:
    """Standard healthy astronaut baseline."""
    return Baseline(hr_mean=62.0, hr_std=3.0, hrv_mean=65.0, hrv_std=6.0)


@pytest.fixture
def healthy_vitals_window() -> list[VitalPoint]:
    """3 sols of optimal physiological vitals at baseline."""
    return [
        VitalPoint(
            crewId="C001",
            sol=s,
            hr=62.0,
            hrv=65.0,
            sleepHours=7.5,
            radiationMsv=1.84,
            exerciseMin=45.0,
            mood=4,
            provenance="SYNTHETIC",
        )
        for s in (142, 143, 144)
    ]


@pytest.fixture
def c002_stressed_vitals_window() -> list[VitalPoint]:
    """Hand-made C002-like window: acute radiation spike, restricted sleep, HR elevated, HRV down."""
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
            radiationMsv=9.0,  # Acute SPE spike
            exerciseMin=30.0,
            mood=2,
            provenance="SYNTHETIC",
        ),
        VitalPoint(
            crewId="C002",
            sol=144,
            hr=74.0,
            hrv=45.0,
            sleepHours=5.5,
            radiationMsv=4.5,
            exerciseMin=30.0,
            mood=2,
            provenance="SYNTHETIC",
        ),
    ]


def test_weights_sum_to_one():
    """Verify that CRI formula weights sum to exactly 1.00."""
    total_weights = sum(CRI_WEIGHTS.values())
    assert total_weights == pytest.approx(1.0, abs=1e-6)


def test_cri_all_zero_stress_gives_100(healthy_vitals_window, standard_baseline):
    """Verify that all-zero stress yields CRI = 100.0, status = 'green', and 0 contributions."""
    result = compute_cri(healthy_vitals_window, standard_baseline, inflammation_score=0.0)
    assert result.cri == 100.0
    assert result.status == "green"
    for term, points in result.contributions.items():
        assert points == 0.0, f"Expected 0 deduction for {term}, got {points}"


def test_cri_all_one_stress_gives_zero(standard_baseline):
    """Verify that maximum stress yields CRI = 0.0, status = 'red', and 100 total deduction."""
    max_stress_window = [
        VitalPoint(
            crewId="C002",
            sol=s,
            hr=80.0,  # z_hr >= 6.0
            hrv=29.0,  # -z_hrv >= 6.0
            sleepHours=3.0,  # (7.5 - 3.0)/4.5 = 1.0
            radiationMsv=12.0,  # max window -> R = 1.0
            exerciseMin=10.0,
            mood=1,  # (4.0 - 1.0)/3.0 = 1.0
            provenance="SYNTHETIC",
        )
        for s in (142, 143, 144)
    ]
    result = compute_cri(max_stress_window, standard_baseline, inflammation_score=1.0)
    assert result.cri == 0.0
    assert result.status == "red"
    assert sum(result.contributions.values()) == pytest.approx(100.0, abs=0.1)


def test_contributions_sum_invariant(c002_stressed_vitals_window, standard_baseline):
    """Verify invariant: sum(contributions) == 100.0 - cri (+- 0.1)."""
    result = compute_cri(c002_stressed_vitals_window, standard_baseline, inflammation_score=0.3)
    expected_reduction = round(100.0 - result.cri, 1)
    actual_reduction = round(sum(result.contributions.values()), 1)
    assert actual_reduction == pytest.approx(expected_reduction, abs=0.1)


def test_status_boundaries(standard_baseline):
    """Verify boundary conditions for green/amber/red (75/74/50/49)."""
    # Direct threshold function verification
    assert get_cri_status(75.0) == "green"
    assert get_cri_status(74.9) == "amber"
    assert get_cri_status(74.0) == "amber"
    assert get_cri_status(50.0) == "amber"
    assert get_cri_status(49.9) == "red"
    assert get_cri_status(49.0) == "red"

    # End-to-end engine verification via compute_cri:
    # 1. CRI == 75.0 -> green (FR-1.2: green >= 75)
    # Deduction 25.0: S=1.0 (sleep=3.0 -> deduction 100*0.25*1.0 = 25.0)
    w_75 = [
        VitalPoint(crewId="C001", sol=s, hr=62.0, hrv=65.0, sleepHours=3.0, radiationMsv=1.84, exerciseMin=45.0, mood=4, provenance="SYNTHETIC")
        for s in (1, 2, 3)
    ]
    res_75 = compute_cri(w_75, standard_baseline, inflammation_score=0.0)
    assert res_75.cri == 75.0
    assert res_75.status == "green"

    # 2. CRI == 74.0 -> amber (FR-1.2: amber 50-74)
    # Deduction 26.0: S=1.0 (25.0) + inflammation=0.1 (1.0) -> deduction 26.0 -> CRI = 74.0
    res_74 = compute_cri(w_75, standard_baseline, inflammation_score=0.1)
    assert res_74.cri == 74.0
    assert res_74.status == "amber"

    # 3. CRI == 50.0 -> amber (FR-1.2: amber 50-74)
    # Deduction 50.0: S=1.0 (25.0) + C=1.0 (25.0: hr=80.0 (+6*std), hrv=29.0 (-6*std))
    w_50 = [
        VitalPoint(crewId="C001", sol=s, hr=80.0, hrv=29.0, sleepHours=3.0, radiationMsv=1.84, exerciseMin=45.0, mood=4, provenance="SYNTHETIC")
        for s in (1, 2, 3)
    ]
    res_50 = compute_cri(w_50, standard_baseline, inflammation_score=0.0)
    assert res_50.cri == 50.0
    assert res_50.status == "amber"

    # 4. CRI == 49.0 -> red (FR-1.2: red < 50)
    # Deduction 51.0: S=1.0 (25.0) + C=1.0 (25.0) + inflammation=0.1 (1.0) -> deduction 51.0 -> CRI = 49.0
    res_49 = compute_cri(w_50, standard_baseline, inflammation_score=0.1)
    assert res_49.cri == 49.0
    assert res_49.status == "red"


def test_c002_like_window_scores_at_least_15_points_below_healthy(
    healthy_vitals_window, c002_stressed_vitals_window, standard_baseline
):
    """Verify that a C002-like stressed window scores at least 15 points below a healthy baseline window."""
    healthy_res = compute_cri(healthy_vitals_window, standard_baseline, inflammation_score=0.0)
    stressed_res = compute_cri(c002_stressed_vitals_window, standard_baseline, inflammation_score=0.2)

    diff = healthy_res.cri - stressed_res.cri
    assert diff >= 15.0, f"Expected drop >= 15 points, got {diff:.1f} (from {healthy_res.cri} to {stressed_res.cri})"


def test_get_baseline_14_sols():
    """Verify that get_baseline computes HR and HRV mean/std over first 14 sols."""
    vitals = [
        VitalPoint(
            crewId="C001",
            sol=s,
            hr=60.0 + (s % 3),
            hrv=65.0 - (s % 3),
            sleepHours=7.2,
            radiationMsv=1.84,
            exerciseMin=45.0,
            mood=4,
            provenance="SYNTHETIC",
        )
        for s in range(1, 21)
    ]
    baseline = get_baseline(vitals)
    assert baseline.hr_mean > 59.0
    assert baseline.hr_std >= 0.5
    assert baseline.hrv_mean > 60.0
    assert baseline.hrv_std >= 0.5
    assert baseline.hr == baseline.hr_mean
    assert baseline.hrv == baseline.hrv_mean


def test_compute_inflammation_score():
    """Verify z-scoring against pre-flight timepoints (L-92, L-44, L-3)."""
    biomarkers = [
        Biomarker(crewId="C001", timepoint="L-92", panel="CARDIO_EVE", name="CRP", value=1000.0, unit="pg/mL", provenance="REAL_OSDR"),
        Biomarker(crewId="C001", timepoint="L-44", panel="CARDIO_EVE", name="CRP", value=1100.0, unit="pg/mL", provenance="REAL_OSDR"),
        Biomarker(crewId="C001", timepoint="L-3", panel="CARDIO_EVE", name="CRP", value=1050.0, unit="pg/mL", provenance="REAL_OSDR"),
        # Acute elevated post/in-flight timepoint
        Biomarker(crewId="C001", timepoint="R+1", panel="CARDIO_EVE", name="CRP", value=1500.0, unit="pg/mL", provenance="REAL_OSDR"),
    ]
    score = compute_inflammation_score(biomarkers, marker_names=["CRP"])
    assert 0.0 < score <= 1.0


def test_stress_functions_range(healthy_vitals_window, standard_baseline):
    """Verify that individual stress functions return values in [0, 1]."""
    r = stress_radiation(healthy_vitals_window)
    s = stress_sleep(healthy_vitals_window)
    c = stress_cardio(healthy_vitals_window, standard_baseline)
    m = stress_mood(healthy_vitals_window)

    for val in (r, s, c, m):
        assert 0.0 <= val <= 1.0


def test_api_get_crew_cri_endpoint():
    """Verify GET /api/v1/crew/{id}/cri returns valid CRIResult matching API contract."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    response = client.get("/api/v1/crew/C002/cri?sol=144")
    assert response.status_code == 200
    data = response.json()

    assert data["crewId"] == "C002"
    assert data["sol"] == 144
    assert isinstance(data["cri"], (int, float))
    assert data["status"] in ("green", "amber", "red")
    assert data["formulaVersion"] == "v1"
    assert data["provenance"] == "SYNTHETIC+REAL_OSDR"

    contributions = data["contributions"]
    assert "radiation" in contributions
    assert "sleep" in contributions
    assert "cardio" in contributions
    assert "mood" in contributions
    assert "inflammation" in contributions

    expected_sum = round(100.0 - data["cri"], 1)
    actual_sum = round(sum(contributions.values()), 1)
    assert actual_sum == pytest.approx(expected_sum, abs=0.1)


def test_api_get_crew_cri_validation():
    """Verify validation rules: invalid crew ID or invalid sol returns 422."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    # Invalid crew ID (regex pattern failure)
    resp_bad_id = client.get("/api/v1/crew/C999/cri?sol=144")
    assert resp_bad_id.status_code == 422

    # Invalid sol out of range (> 200)
    resp_bad_sol = client.get("/api/v1/crew/C001/cri?sol=250")
    assert resp_bad_sol.status_code == 422

    # Invalid sol (< 1)
    resp_zero_sol = client.get("/api/v1/crew/C001/cri?sol=0")
    assert resp_zero_sol.status_code == 422


def test_c002_sol_144_is_amber():
    """Verify C002 Sol 144 CRI is in amber range (55-70) on both eval generator and data_access."""
    from scripts.eval_anomaly import generate_synthetic_telemetry
    from app.services.data_access import get_vitals_history, get_biomarkers

    # 1. On eval generator scenario
    telemetry = generate_synthetic_telemetry()
    c002_eval = telemetry["C002"]
    b_eval = get_baseline(c002_eval)
    w_eval = [v for v in c002_eval if 142 <= v.sol <= 144]
    bio_eval = get_biomarkers("C002")
    inf_eval = compute_inflammation_score(bio_eval)
    res_eval = compute_cri(w_eval, b_eval, inf_eval, "C002", 144)
    assert 55.0 <= res_eval.cri <= 70.0, f"Expected 55-70 on eval generator, got {res_eval.cri}"
    assert res_eval.status == "amber"

    # 2. On data_access vitals history
    vitals_history = get_vitals_history("C002", 144)
    b_hist = get_baseline(vitals_history)
    w_hist = [v for v in vitals_history if 142 <= v.sol <= 144]
    res_hist = compute_cri(w_hist, b_hist, inf_eval, "C002", 144)
    assert 55.0 <= res_hist.cri <= 70.0, f"Expected 55-70 on data_access, got {res_hist.cri}"
    assert res_hist.status == "amber"


def test_healthy_baseline_stays_green():
    """Verify healthy crew members stay green (CRI >= 75.0) across all sols."""
    from scripts.eval_anomaly import generate_synthetic_telemetry

    telemetry = generate_synthetic_telemetry()
    for cid in ["C001", "C003", "C004"]:
        vitals = telemetry[cid]
        b = get_baseline(vitals)
        for s in range(1, 146):
            w = [x for x in vitals if s - 2 <= x.sol <= s]
            res = compute_cri(w, b, inflammation_score=0.0, crew_id=cid, sol=s)
            assert res.cri >= 75.0, f"{cid} on Sol {s} dropped below 75 (got {res.cri})"
            assert res.status == "green"


def test_monotonicity_of_stress_terms(standard_baseline):
    """Verify that each stress term is monotonic in its respective inputs."""
    # Radiation: higher dose -> higher stress
    r_low = stress_radiation([VitalPoint(crewId="C001", sol=1, hr=60, hrv=60, sleepHours=8, radiationMsv=2.0, exerciseMin=30, mood=4, provenance="SYNTHETIC")])
    r_mid = stress_radiation([VitalPoint(crewId="C001", sol=1, hr=60, hrv=60, sleepHours=8, radiationMsv=5.0, exerciseMin=30, mood=4, provenance="SYNTHETIC")])
    r_high = stress_radiation([VitalPoint(crewId="C001", sol=1, hr=60, hrv=60, sleepHours=8, radiationMsv=9.0, exerciseMin=30, mood=4, provenance="SYNTHETIC")])
    assert r_low < r_mid < r_high

    # Sleep: less sleep -> higher stress
    s_low = stress_sleep([VitalPoint(crewId="C001", sol=1, hr=60, hrv=60, sleepHours=7.5, radiationMsv=1.84, exerciseMin=30, mood=4, provenance="SYNTHETIC")])
    s_mid = stress_sleep([VitalPoint(crewId="C001", sol=1, hr=60, hrv=60, sleepHours=5.5, radiationMsv=1.84, exerciseMin=30, mood=4, provenance="SYNTHETIC")])
    s_high = stress_sleep([VitalPoint(crewId="C001", sol=1, hr=60, hrv=60, sleepHours=3.5, radiationMsv=1.84, exerciseMin=30, mood=4, provenance="SYNTHETIC")])
    assert s_low < s_mid < s_high

    # Cardio: higher HR and lower HRV -> higher stress
    c_low = stress_cardio([VitalPoint(crewId="C001", sol=1, hr=62, hrv=65, sleepHours=8, radiationMsv=1.84, exerciseMin=30, mood=4, provenance="SYNTHETIC")], standard_baseline)
    c_mid = stress_cardio([VitalPoint(crewId="C001", sol=1, hr=70, hrv=55, sleepHours=8, radiationMsv=1.84, exerciseMin=30, mood=4, provenance="SYNTHETIC")], standard_baseline)
    c_high = stress_cardio([VitalPoint(crewId="C001", sol=1, hr=80, hrv=40, sleepHours=8, radiationMsv=1.84, exerciseMin=30, mood=4, provenance="SYNTHETIC")], standard_baseline)
    assert c_low < c_mid < c_high

    # Mood: lower mood -> higher stress
    m_low = stress_mood([VitalPoint(crewId="C001", sol=1, hr=60, hrv=60, sleepHours=8, radiationMsv=1.84, exerciseMin=30, mood=4, provenance="SYNTHETIC")])
    m_mid = stress_mood([VitalPoint(crewId="C001", sol=1, hr=60, hrv=60, sleepHours=8, radiationMsv=1.84, exerciseMin=30, mood=3, provenance="SYNTHETIC")])
    m_high = stress_mood([VitalPoint(crewId="C001", sol=1, hr=60, hrv=60, sleepHours=8, radiationMsv=1.84, exerciseMin=30, mood=1, provenance="SYNTHETIC")])
    assert m_low < m_mid < m_high


def test_cri_bounded_zero_to_hundred(standard_baseline):
    """Verify CRI output is strictly clamped in [0, 100] across extreme vitals inputs."""
    extreme_doses = [-10.0, 0.0, 1.84, 9.0, 50.0, 100.0]
    extreme_sleeps = [-5.0, 0.0, 3.0, 7.5, 12.0, 24.0]
    extreme_hrs = [20.0, 60.0, 100.0, 220.0]

    for dose in extreme_doses:
        for sleep in extreme_sleeps:
            for hr in extreme_hrs:
                window = [
                    VitalPoint(crewId="C001", sol=1, hr=hr, hrv=50.0, sleepHours=sleep, radiationMsv=dose, exerciseMin=0.0, mood=1, provenance="SYNTHETIC")
                ]
                res = compute_cri(window, standard_baseline, inflammation_score=2.0)
                assert 0.0 <= res.cri <= 100.0


