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
