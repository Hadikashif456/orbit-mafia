"""Strict end-to-end consistency tests across API endpoints and engines (TRD Section 5 & API Contract).

Verifies that for the same (crew_id, sol):
1. The CRI from /crew, /crew/{id}/cri, /scenario/state, and Copilot's server-side CRI figure are equal within 0.1.
2. /crew/{id}/vitals returns exactly `window` rows (7 and 30).
3. Biomarkers returned by /crew/{id}/biomarkers reflect underlying data differences between astronauts.

Note: As documented in the architecture specification, these tests fail until Backend 1
replaces the initial router stubs in crew.py and data_access.py with live database queries.
Assertions must not be weakened.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.copilot_service import _compute_server_side_metrics
from app.services.data_access import get_biomarkers

client = TestClient(app)


@pytest.mark.parametrize("crew_id,sol", [
    ("C001", 144),
    ("C002", 144),
    ("C003", 144),
    ("C004", 144),
])
def test_cri_consistency_across_endpoints(crew_id: str, sol: int):
    """Assert CRI consistency across /crew, /crew/{id}/cri, /scenario/state, and Copilot engine within 0.1."""
    # 1. /api/v1/crew?sol={sol}
    resp_crew = client.get(f"/api/v1/crew?sol={sol}")
    assert resp_crew.status_code == 200, f"/crew failed: {resp_crew.text}"
    crew_list = resp_crew.json()
    crew_entry = next((c for c in crew_list if c["id"] == crew_id), None)
    assert crew_entry is not None, f"Crew {crew_id} not found in /crew response"
    cri_from_crew = crew_entry["cri"]

    # 2. /api/v1/crew/{id}/cri?sol={sol}
    resp_cri = client.get(f"/api/v1/crew/{crew_id}/cri?sol={sol}")
    assert resp_cri.status_code == 200, f"/crew/{crew_id}/cri failed: {resp_cri.text}"
    cri_from_crew_cri = resp_cri.json()["cri"]

    # 3. /api/v1/scenario/state?sol={sol}
    resp_scenario = client.get(f"/api/v1/scenario/state?sol={sol}")
    assert resp_scenario.status_code == 200, f"/scenario/state failed: {resp_scenario.text}"
    scenario_crew = resp_scenario.json()["crew"]
    scenario_entry = next((c for c in scenario_crew if c["id"] == crew_id), None)
    assert scenario_entry is not None, f"Crew {crew_id} not found in /scenario/state response"
    cri_from_scenario = scenario_entry["cri"]

    # 4. Copilot engine computed CRI figure (cri_to)
    _cri_from, copilot_cri_to, _status, _drivers, _window = _compute_server_side_metrics(crew_id, sol)
    cri_from_copilot = round(copilot_cri_to, 1)

    # Cross-endpoint equality within 0.1 tolerance
    assert abs(cri_from_crew - cri_from_crew_cri) <= 0.1, (
        f"CRI discrepancy between /crew ({cri_from_crew}) and /crew/{crew_id}/cri ({cri_from_crew_cri})"
    )
    assert abs(cri_from_crew_cri - cri_from_scenario) <= 0.1, (
        f"CRI discrepancy between /crew/{crew_id}/cri ({cri_from_crew_cri}) and /scenario/state ({cri_from_scenario})"
    )
    assert abs(cri_from_scenario - cri_from_copilot) <= 0.1, (
        f"CRI discrepancy between /scenario/state ({cri_from_scenario}) and Copilot engine ({cri_from_copilot})"
    )


@pytest.mark.parametrize("window", [7, 30])
def test_crew_vitals_returns_window_rows(window: int):
    """Assert /crew/{id}/vitals returns exactly `window` rows (7 and 30 sols)."""
    resp = client.get(f"/api/v1/crew/C002/vitals?window={window}&sol=144")
    assert resp.status_code == 200, f"/crew/C002/vitals failed: {resp.text}"
    vitals = resp.json()
    assert len(vitals) == window, (
        f"Expected {window} vitals rows for window={window}, but received {len(vitals)}"
    )


def test_crew_biomarkers_differ_when_data_differs():
    """Assert /crew/{id}/biomarkers reflects individual astronaut differences from underlying data."""
    # Data access defines different CRP values for C001 (4950000.0) and C002 (5131700.0) at L-3
    c001_raw = get_biomarkers("C001")
    c002_raw = get_biomarkers("C002")
    c001_raw_crp = next((b.value for b in c001_raw if b.name == "CRP" and b.timepoint == "L-3"), None)
    c002_raw_crp = next((b.value for b in c002_raw if b.name == "CRP" and b.timepoint == "L-3"), None)
    assert c001_raw_crp != c002_raw_crp, "Prerequisite: underlying data should have distinct CRP for C001 and C002"

    resp_c001 = client.get("/api/v1/crew/C001/biomarkers")
    assert resp_c001.status_code == 200
    resp_c002 = client.get("/api/v1/crew/C002/biomarkers")
    assert resp_c002.status_code == 200

    c001_bm = {b["name"]: b["value"] for b in resp_c001.json() if b["timepoint"] == "L-3"}
    c002_bm = {b["name"]: b["value"] for b in resp_c002.json() if b["timepoint"] == "L-3"}

    assert c001_bm.get("CRP") != c002_bm.get("CRP"), (
        f"Expected /crew/C001/biomarkers and /crew/C002/biomarkers to reflect data difference, "
        f"but both returned CRP={c001_bm.get('CRP')}"
    )
