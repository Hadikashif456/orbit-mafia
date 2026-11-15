"""Tests for the database, synthetic generation, OSDR ingestion, and data_access layer."""

import sqlite3
import pytest
from pathlib import Path

from scripts.generate_synthetic import generate_synthetic
from scripts.ingest_osdr import ingest_osdr
from app.services.data_access import (
    get_vitals_history,
    get_vitals_window,
    get_biomarkers,
    DataUnavailableError,
)
from app.config import settings


@pytest.fixture(scope="module")
def shared_temp_db(tmp_path_factory):
    """Build a temporary database once for data layer tests."""
    temp_dir = tmp_path_factory.mktemp("data_layer_db")
    db_file = temp_dir / "orbit_mafia_test.db"
    ingest_osdr(db_path=db_file)
    generate_synthetic(db_path=db_file)
    return db_file


@pytest.fixture(autouse=True)
def point_settings_to_temp_db(shared_temp_db, monkeypatch):
    """Ensure settings.DB_PATH points to the shared temporary DB for each test."""
    monkeypatch.setattr(settings, "DB_PATH", str(shared_temp_db))


def test_vitals_row_counts_and_per_crew(shared_temp_db):
    """Verify exactly 588 vitals rows total and 147 per crew."""
    conn = sqlite3.connect(shared_temp_db)
    try:
        total = conn.execute("SELECT COUNT(*) FROM vitals").fetchone()[0]
        assert total == 588, f"Expected 588 vitals rows, got {total}"

        per_crew = conn.execute(
            "SELECT crew_id, COUNT(*) FROM vitals GROUP BY crew_id ORDER BY crew_id"
        ).fetchall()
        assert len(per_crew) == 4
        for crew_id, count in per_crew:
            assert count == 147, f"Crew {crew_id} expected 147 rows, got {count}"
    finally:
        conn.close()


def test_sol_1_to_145_snapshot_guard(shared_temp_db):
    """Snapshot guard: exactly 580 vitals rows total and 145 per crew for sols <= 145."""
    conn = sqlite3.connect(shared_temp_db)
    try:
        total_145 = conn.execute("SELECT COUNT(*) FROM vitals WHERE sol <= 145").fetchone()[0]
        assert total_145 == 580, f"Expected 580 vitals rows for sols <= 145, got {total_145}"

        per_crew_145 = conn.execute(
            "SELECT crew_id, COUNT(*) FROM vitals WHERE sol <= 145 GROUP BY crew_id ORDER BY crew_id"
        ).fetchall()
        assert len(per_crew_145) == 4
        for crew_id, count in per_crew_145:
            assert count == 145, f"Crew {crew_id} expected 145 rows for sols <= 145, got {count}"
    finally:
        conn.close()


def test_synthetic_determinism(tmp_path):
    """Two generation runs from the same seed produce identical rows."""
    db1 = tmp_path / "run1.db"
    db2 = tmp_path / "run2.db"

    generate_synthetic(db_path=db1)
    generate_synthetic(db_path=db2)

    conn1 = sqlite3.connect(db1)
    conn2 = sqlite3.connect(db2)
    try:
        rows1 = conn1.execute(
            "SELECT crew_id, sol, hr, hrv, sleep_hours, radiation_msv, exercise_min, mood, provenance "
            "FROM vitals ORDER BY crew_id, sol"
        ).fetchall()
        rows2 = conn2.execute(
            "SELECT crew_id, sol, hr, hrv, sleep_hours, radiation_msv, exercise_min, mood, provenance "
            "FROM vitals ORDER BY crew_id, sol"
        ).fetchall()
        assert rows1 == rows2, "Synthetic generator is not deterministic across runs"
    finally:
        conn1.close()
        conn2.close()


def test_vitals_provenance_is_synthetic(shared_temp_db):
    """All vitals rows must have provenance == 'SYNTHETIC'."""
    conn = sqlite3.connect(shared_temp_db)
    try:
        non_synth = conn.execute(
            "SELECT COUNT(*) FROM vitals WHERE provenance != 'SYNTHETIC'"
        ).fetchone()[0]
        assert non_synth == 0, f"Found {non_synth} vitals rows with provenance != 'SYNTHETIC'"
    finally:
        conn.close()


def test_get_vitals_history_union_sol_1_to_14_and_window():
    """get_vitals_history returns UNION of Sol 1-14 and [sol-window+1..sol], sorted with no duplicates."""
    pts = get_vitals_history("C002", 144, window=7)
    sols = [p.sol for p in pts]

    # Expected: 1..14 (14 sols) and 138..144 (7 sols) -> 21 sols
    expected_sols = list(range(1, 15)) + list(range(138, 145))
    assert sols == expected_sols
    assert len(sols) == len(set(sols)), "Duplicate sols found in vitals history"
    assert sols == sorted(sols), "Sols must be in ascending order"

    # Test when window overlaps completely with Sol 1-14
    pts_overlap = get_vitals_history("C002", 10, window=7)
    sols_overlap = [p.sol for p in pts_overlap]
    assert sols_overlap == list(range(1, 15))
    assert len(sols_overlap) == len(set(sols_overlap))


def test_get_vitals_window_exact_counts():
    """get_vitals_window returns exactly 7 and 30 rows ending at sol."""
    window7 = get_vitals_window("C002", 144, window=7)
    assert len(window7) == 7
    assert [p.sol for p in window7] == list(range(138, 145))

    window30 = get_vitals_window("C002", 144, window=30)
    assert len(window30) == 30
    assert [p.sol for p in window30] == list(range(115, 145))


def test_biomarkers_timepoint_ordering():
    """Biomarkers must be ordered chronologically: L-92, L-44, L-3, R+1, R+45, R+82, R+194, then name."""
    order_map = {
        "L-92": 0,
        "L-44": 1,
        "L-3": 2,
        "R+1": 3,
        "R+45": 4,
        "R+82": 5,
        "R+194": 6,
    }

    bios = get_biomarkers("C001")
    assert len(bios) > 0

    prev_order = -1
    prev_name = ""
    for b in bios:
        assert b.timepoint in order_map, f"Unexpected timepoint: {b.timepoint}"
        curr_order = order_map[b.timepoint]
        assert curr_order >= prev_order, f"Biomarkers out of chronological timepoint order: {b.timepoint}"
        if curr_order == prev_order:
            assert b.name >= prev_name, f"Biomarkers for same timepoint must be sorted by name: {b.name} < {prev_name}"
        prev_order = curr_order
        prev_name = b.name


def test_missing_db_raises_data_unavailable_error(monkeypatch):
    """Missing database file must raise DataUnavailableError with no path in message."""
    monkeypatch.setattr(settings, "DB_PATH", "nonexistent/dir/missing.db")

    with pytest.raises(DataUnavailableError) as exc_vitals:
        get_vitals_history("C001", 100)
    assert "missing.db" not in str(exc_vitals.value)

    with pytest.raises(DataUnavailableError) as exc_window:
        get_vitals_window("C001", 100, 7)
    assert "missing.db" not in str(exc_window.value)

    with pytest.raises(DataUnavailableError) as exc_bio:
        get_biomarkers("C001")
    assert "missing.db" not in str(exc_bio.value)
