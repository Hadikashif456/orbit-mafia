"""Unit tests for the scenario replay endpoint and scenario engine."""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models import VitalPoint
from app.services import scenario_engine, data_access

client = TestClient(app)


def test_scenario_returns_four_crew_members():
    """Verify that /api/v1/scenario/state returns all 4 crew members with 5-sol sparklines."""
    response = client.get("/api/v1/scenario/state?sol=144")
    assert response.status_code == 200
    data = response.json()

    assert data["sol"] == 144
    assert len(data["crew"]) == 4

    crew_ids = [c["id"] for c in data["crew"]]
    assert set(crew_ids) == {"C001", "C002", "C003", "C004"}

    for crew in data["crew"]:
        assert crew["callsign"].startswith("Cmdr ")
        assert isinstance(crew["cri"], float)
        assert 0.0 <= crew["cri"] <= 100.0
        assert crew["status"] in ("green", "amber", "red")
        assert len(crew["sparkline"]) == 5
        assert crew["provenance"] == "SYNTHETIC"
        assert isinstance(crew["topDriver"], str)
        assert len(crew["topDriver"]) > 0


def test_scenario_not_hardcoded_monkeypatch(monkeypatch):
    """Verify scenario results are dynamically computed from data_access, not hardcoded."""
    # Baseline call
    baseline_resp = client.get("/api/v1/scenario/state?sol=144")
    assert baseline_resp.status_code == 200
    baseline_c001 = next(c for c in baseline_resp.json()["crew"] if c["id"] == "C001")
    initial_cri = baseline_c001["cri"]
    assert initial_cri > 75.0

    original_get_vitals = data_access.get_vitals_history

    # Monkeypatch get_vitals_history to inject severe acute stress for C001
    def mock_get_vitals_history(crew_id: str, sol: int, window: int = 14):
        vitals = original_get_vitals(crew_id, sol, window)
        if crew_id == "C001":
            # Modify vitals to reflect high radiation and severe sleep loss
            stressed = []
            for v in vitals:
                stressed.append(
                    VitalPoint(
                        crewId="C001",
                        sol=v.sol,
                        hr=110.0,
                        hrv=20.0,
                        sleepHours=2.0,
                        radiationMsv=11.5,
                        exerciseMin=0.0,
                        mood=1,
                        provenance="SYNTHETIC",
                    )
                )
            return stressed
        return vitals

    monkeypatch.setattr("app.services.crew_service.get_vitals_history", mock_get_vitals_history)
    monkeypatch.setattr("app.services.scenario_engine.get_vitals_history", mock_get_vitals_history)

    modified_resp = client.get("/api/v1/scenario/state?sol=144")
    assert modified_resp.status_code == 200
    modified_c001 = next(c for c in modified_resp.json()["crew"] if c["id"] == "C001")

    # Assert CRI dropped significantly and status/topDriver changed
    assert modified_c001["cri"] < initial_cri
    assert modified_c001["status"] in ("amber", "red")
    assert modified_c001["topDriver"] == "Radiation exposure"


def test_scenario_alert_only_for_non_green():
    """Verify alerts appear only for non-green crew (status != green)."""
    # At Sol 140, all crew are healthy
    sol140_resp = client.get("/api/v1/scenario/state?sol=140")
    assert sol140_resp.status_code == 200
    sol140_data = sol140_resp.json()
    assert all(c["status"] == "green" for c in sol140_data["crew"])
    assert len(sol140_data["alerts"]) == 0

    # At Sol 144, C002 is non-green (amber or red)
    sol144_resp = client.get("/api/v1/scenario/state?sol=144")
    assert sol144_resp.status_code == 200
    sol144_data = sol144_resp.json()

    crew_by_id = {c["id"]: c for c in sol144_data["crew"]}
    assert len(sol144_data["alerts"]) > 0

    for alert in sol144_data["alerts"]:
        target_crew = crew_by_id[alert["crewId"]]
        assert target_crew["status"] in ("amber", "red")
        assert alert["severity"] in ("watch", "warning", "critical")
        assert alert["criTo"] == target_crew["cri"]
        assert isinstance(alert["predictedWindowHours"], int)
        assert len(alert["drivers"]) > 0


def test_scenario_events_filtered_by_sol():
    """Verify events are correctly filtered by sol <= requested sol and SPE magnitude matches data."""
    # Sol 140: No events yet
    resp140 = client.get("/api/v1/scenario/state?sol=140").json()
    assert len(resp140["events"]) == 0

    # Sol 141: Only sleep disruption
    resp141 = client.get("/api/v1/scenario/state?sol=141").json()
    assert len(resp141["events"]) == 1
    assert resp141["events"][0]["type"] == "SLEEP_DISRUPTION"

    # Sol 143: Sleep disruption + Radiation spike with real magnitude
    resp143 = client.get("/api/v1/scenario/state?sol=143").json()
    assert len(resp143["events"]) == 2
    rad_event = next(e for e in resp143["events"] if e["type"] == "RADIATION_SPIKE")
    c002_sol143_vitals = [v for v in data_access.get_vitals_history("C002", 143, 1) if v.sol == 143]
    assert rad_event["magnitude"] == round(c002_sol143_vitals[-1].radiationMsv, 1)

    # Sol 144: All 4 events
    resp144 = client.get("/api/v1/scenario/state?sol=144").json()
    assert len(resp144["events"]) == 4
    event_types = [e["type"] for e in resp144["events"]]
    assert event_types == ["SLEEP_DISRUPTION", "RADIATION_SPIKE", "CRI_DROP", "COPILOT_RECOMMENDATION"]


def test_scenario_sol_range_validation():
    """Verify 422 error for sol values outside 140-145 range."""
    resp_low = client.get("/api/v1/scenario/state?sol=139")
    assert resp_low.status_code == 422

    resp_high = client.get("/api/v1/scenario/state?sol=146")
    assert resp_high.status_code == 422
