"""Unit tests for input validators (crewId, sol, window)."""

import pytest
from app.security.validators import validate_crew_id, validate_sol, validate_window


@pytest.mark.parametrize("valid_id", ["C001", "C002", "C003", "C004"])
def test_validate_crew_id_valid(valid_id: str):
    """Ensure valid crew IDs C001..C004 pass validation."""
    assert validate_crew_id(valid_id) is True


@pytest.mark.parametrize("invalid_id", ["C000", "C005", "C999", "astro-1", "c001", "", None])
def test_validate_crew_id_invalid(invalid_id):
    """Ensure invalid crew IDs are rejected."""
    assert validate_crew_id(invalid_id) is False


@pytest.mark.parametrize("valid_sol", [1, 50, 144, 200])
def test_validate_sol_valid(valid_sol: int):
    """Ensure sol within 1..200 passes validation."""
    assert validate_sol(valid_sol) is True


@pytest.mark.parametrize("invalid_sol", [0, -1, 201, 500, "100", None])
def test_validate_sol_invalid(invalid_sol):
    """Ensure sol outside 1..200 is rejected."""
    assert validate_sol(invalid_sol) is False


@pytest.mark.parametrize("valid_window", [7, 30])
def test_validate_window_valid(valid_window: int):
    """Ensure valid window values 7 and 30 pass validation."""
    assert validate_window(valid_window) is True


@pytest.mark.parametrize("invalid_window", [1, 14, 60, 999, 0, -7])
def test_validate_window_invalid(invalid_window: int):
    """Ensure invalid window values are rejected."""
    assert validate_window(invalid_window) is False
