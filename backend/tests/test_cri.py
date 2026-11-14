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
            hr=80.0,  # z_hr >= 3.0
            hrv=40.0,  # -z_hrv >= 3.0
            sleepHours=3.5,  # (7.5 - 3.5)/3.5 = 1.0
            radiationMsv=9.0,  # max spike -> R = 1.0
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
    # Deduction 25.0: S=1.0 (sleep=4.0 -> deduction 100*0.25*1.0 = 25.0)
    w_75 = [
        VitalPoint(crewId="C001", sol=s, hr=62.0, hrv=65.0, sleepHours=4.0, radiationMsv=1.84, exerciseMin=45.0, mood=4, provenance="SYNTHETIC")
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
    # Deduction 50.0: S=1.0 (25.0) + C=1.0 (25.0: hr=71.0 (+3*std), hrv=47.0 (-3*std))
    w_50 = [
        VitalPoint(crewId="C001", sol=s, hr=71.0, hrv=47.0, sleepHours=4.0, radiationMsv=1.84, exerciseMin=45.0, mood=4, provenance="SYNTHETIC")
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

