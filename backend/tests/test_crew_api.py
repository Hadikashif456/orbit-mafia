"""API integration tests for /api/v1/crew endpoints backed by SQLite database."""

import sqlite3
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from scripts.generate_synthetic import generate_synthetic
from scripts.ingest_osdr import ingest_osdr


@pytest.fixture(scope="module")
def temp_db(tmp_path_factory):
    """Build a temporary database once for API integration tests."""
    temp_dir = tmp_path_factory.mktemp("crew_api_db")
    db_file = temp_dir / "orbit_mafia_crew_test.db"
    ingest_osdr(db_path=db_file)
    generate_synthetic(db_path=db_file)
    return db_file


@pytest.fixture(autouse=True)
def point_to_temp_db(temp_db, monkeypatch):
    """Ensure settings.DB_PATH points to the temporary database."""
    monkeypatch.setattr(settings, "DB_PATH", str(temp_db))


@pytest.fixture
def client():
    return TestClient(app)


def test_crew_list_returns_four_different_crew(client):
    """GET /crew returns 4 different crew members with callsigns, statuses, and sparklines."""
    response = client.get("/api/v1/crew")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 4

    crew_ids = {c["id"] for c in data}
    assert crew_ids == {"C001", "C002", "C003", "C004"}

    callsigns = {c["callsign"] for c in data}
    assert len(callsigns) == 4
    for c in data:
        assert c["provenance"] == "SYNTHETIC"
        assert "cri" in c
        assert "status" in c
        assert "topDriver" in c
        assert len(c["sparkline"]) == 5


@pytest.mark.parametrize("sol", [100, 144])
def test_crew_cri_matches_individual_endpoint(client, sol):
    """For every crew the /crew CRI equals /crew/{id}/cri to 0.1 at Sol 144 and Sol 100."""
    resp_crew = client.get(f"/api/v1/crew?sol={sol}")
    assert resp_crew.status_code == 200
    crew_list = resp_crew.json()

    for crew_member in crew_list:
        cid = crew_member["id"]
        resp_ind = client.get(f"/api/v1/crew/{cid}/cri?sol={sol}")
        assert resp_ind.status_code == 200
        ind_data = resp_ind.json()

        assert abs(crew_member["cri"] - ind_data["cri"]) <= 0.1
        # The last sparkline value must equal CRI
        assert abs(crew_member["sparkline"][-1] - crew_member["cri"]) <= 0.1


def test_c002_sol_144_is_amber_between_55_and_65(client):
    """C002 Sol 144 is amber between 55 and 65."""
    response = client.get("/api/v1/crew/C002/cri?sol=144")
    assert response.status_code == 200
    data = response.json()
    assert 55.0 <= data["cri"] <= 65.0
    assert data["status"] == "amber"


@pytest.mark.parametrize("window", [7, 30])
def test_vitals_returns_window_rows(client, window):
    """GET /crew/{id}/vitals returns exactly 7 and 30 rows."""
    response = client.get(f"/api/v1/crew/C002/vitals?window={window}&sol=144")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == window
    assert [p["sol"] for p in data] == list(range(144 - window + 1, 145))


def test_biomarkers_differ_per_crew(client):
    """GET /crew/{id}/biomarkers differs per crew where real NASA data differs."""
    resp_c001 = client.get("/api/v1/crew/C001/biomarkers")
    resp_c003 = client.get("/api/v1/crew/C003/biomarkers")
    assert resp_c001.status_code == 200
    assert resp_c003.status_code == 200
    bio1 = resp_c001.json()
    bio3 = resp_c003.json()

    # C003 is missing L-44 in Alamar panel, so row counts and values differ
    assert len(bio1) != len(bio3) or bio1 != bio3

    for b in bio1:
        assert b["crewId"] == "C001"
        assert b["provenance"] == "REAL_OSDR"

    for b in bio3:
        assert b["crewId"] == "C003"
        assert b["provenance"] == "REAL_OSDR"


def test_missing_db_gives_503_without_path(client, monkeypatch):
    """Missing database gives 503 with no file path in the response body."""
    monkeypatch.setattr(settings, "DB_PATH", "fake/path/missing_test.db")
    for url in [
        "/api/v1/crew",
        "/api/v1/crew/C001/cri?sol=144",
        "/api/v1/crew/C001/vitals?window=7&sol=144",
        "/api/v1/crew/C001/biomarkers",
    ]:
        resp = client.get(url)
        assert resp.status_code == 503
        body_text = resp.text
        assert "missing_test.db" not in body_text
        assert "fake/path" not in body_text
        err = resp.json()
        assert "error" in err or "detail" in err


def test_no_hardcoded_numbers(client, temp_db):
    """Changing a value in the SQLite DB directly alters the API output."""
    resp_vitals_orig = client.get("/api/v1/crew/C001/vitals?window=7&sol=144").json()
    orig_hr = resp_vitals_orig[-1]["hr"]
    orig_hrv = resp_vitals_orig[-1]["hrv"]
    orig_rad = resp_vitals_orig[-1]["radiationMsv"]

    resp_cri_orig = client.get("/api/v1/crew/C001/cri?sol=144").json()
    orig_cri = resp_cri_orig["cri"]

    # Modify vitals row in the database
    conn = sqlite3.connect(temp_db)
    try:
        conn.execute(
            "UPDATE vitals SET hr = 125.0, hrv = 10.0, radiation_msv = 15.0 WHERE crew_id = 'C001' AND sol = 144"
        )
        conn.commit()
    finally:
        conn.close()

    try:
        resp_vitals_new = client.get("/api/v1/crew/C001/vitals?window=7&sol=144").json()
        assert resp_vitals_new[-1]["hr"] == 125.0
        assert resp_vitals_new[-1]["hr"] != orig_hr

        resp_cri_new = client.get("/api/v1/crew/C001/cri?sol=144").json()
        assert resp_cri_new["cri"] != orig_cri
    finally:
        # Restore original vitals row
        conn = sqlite3.connect(temp_db)
        try:
            conn.execute(
                "UPDATE vitals SET hr = ?, hrv = ?, radiation_msv = ? WHERE crew_id = 'C001' AND sol = 144",
                (orig_hr, orig_hrv, orig_rad),
            )
            conn.commit()
        finally:
            conn.close()


def test_biomarkers_query_filters_and_normalization(client):
    """Test Task D2 biomarker query parameters: default short list, panel filter, names filter, and normalization."""
    # 1. Default (no params): short list with CRP, Fibrinogen, plus CMP panel (~141 rows, not 2,086)
    resp_def = client.get("/api/v1/crew/C001/biomarkers")
    assert resp_def.status_code == 200
    data_def = resp_def.json()
    assert 50 <= len(data_def) <= 200
    panels_def = {b["panel"] for b in data_def}
    assert panels_def.issubset({"CMP", "CARDIO_EVE"})
    names_def = {b["name"].upper() for b in data_def}
    assert "CRP" in names_def
    assert "FIBRINOGEN" in names_def

    # 2. panel=all returns full legacy set
    resp_all = client.get("/api/v1/crew/C001/biomarkers?panel=all")
    assert resp_all.status_code == 200
    data_all = resp_all.json()
    assert len(data_all) > 1500

    # 3. panel filter
    resp_cmp = client.get("/api/v1/crew/C001/biomarkers?panel=CMP")
    assert resp_cmp.status_code == 200
    for b in resp_cmp.json():
        assert b["panel"] == "CMP"

    # 4. Normalized names: Il 6 = Il6 = IL-6
    resp_sp = client.get("/api/v1/crew/C001/biomarkers?names=Il 6")
    resp_no_sp = client.get("/api/v1/crew/C001/biomarkers?names=Il6")
    resp_hyphen = client.get("/api/v1/crew/C001/biomarkers?names=IL-6")
    assert resp_sp.status_code == 200
    assert resp_no_sp.status_code == 200
    assert resp_hyphen.status_code == 200
    assert resp_sp.json() == resp_no_sp.json() == resp_hyphen.json()
    assert len(resp_hyphen.json()) > 0
    for b in resp_hyphen.json():
        assert b["name"] == "IL-6"

    # 5. Invalid inputs return 422
    assert client.get("/api/v1/crew/C001/biomarkers?panel=NONEXISTENT").status_code == 422
    assert client.get("/api/v1/crew/C001/biomarkers?names=bad$name!").status_code == 422
    too_many = ",".join(f"Marker{i}" for i in range(25))
    assert client.get(f"/api/v1/crew/C001/biomarkers?names={too_many}").status_code == 422


def test_cri_default_markers_found_all_crew():
    """Verify that CRI receives CRP, FIBRINOGEN, and IL-6 for all 4 crew with consistent units."""
    from app.services.data_access import get_biomarkers
    for cid in ["C001", "C002", "C003", "C004"]:
        bio = get_biomarkers(cid, for_cri=True)
        names = {b.name.strip().upper() for b in bio}
        assert "CRP" in names, f"CRP missing for {cid}"
        assert "FIBRINOGEN" in names, f"FIBRINOGEN missing for {cid}"
        assert "IL-6" in names, f"IL-6 missing for {cid}"

        # No row mixes units for any of the canonical markers
        for m in ["CRP", "FIBRINOGEN", "IL-6"]:
            m_units = {b.unit for b in bio if b.name.strip().upper() == m}
            assert len(m_units) == 1, f"Multiple units for {m} in {cid}: {m_units}"


def test_trend_endpoint_windows_and_consistency(client):
    """Test Task D3 GET /api/v1/crew/{id}/trend: window=7 and 30, CRI consistency, and validation."""
    # 1. Default window=7, default sol=144
    resp_7 = client.get("/api/v1/crew/C002/trend")
    assert resp_7.status_code == 200
    data_7 = resp_7.json()
    assert len(data_7) == 7
    assert data_7[-1]["sol"] == 144
    assert [p["sol"] for p in data_7] == list(range(138, 145))

    # 2. Window=30
    resp_30 = client.get("/api/v1/crew/C002/trend?window=30&sol=144")
    assert resp_30.status_code == 200
    data_30 = resp_30.json()
    assert len(data_30) == 30
    assert data_30[-1]["sol"] == 144

    # 3. Sol 144 CRI matches /crew/{id}/cri?sol=144
    resp_cri = client.get("/api/v1/crew/C002/cri?sol=144").json()
    assert abs(data_7[-1]["cri"] - resp_cri["cri"]) <= 0.1
    assert data_7[-1]["status"] == resp_cri["status"]

    # 4. Bad window gives 422
    assert client.get("/api/v1/crew/C002/trend?window=14").status_code == 422
    assert client.get("/api/v1/crew/C002/trend?window=0").status_code == 422

    # 5. Bad sol gives 422
    assert client.get("/api/v1/crew/C002/trend?sol=0").status_code == 422
    assert client.get("/api/v1/crew/C002/trend?sol=250").status_code == 422

    # 6. Bad crew ID gives 422
    assert client.get("/api/v1/crew/C999/trend").status_code == 422
