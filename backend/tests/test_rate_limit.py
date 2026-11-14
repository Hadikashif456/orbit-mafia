"""Tests for Copilot endpoint per-IP rate limiting and dynamic configuration.

Covers requirements from docs/SECURITY.md Section 6, docs/TRD.md Section 8:
- 12 rapid calls from one client within the new default (60/minute) all return HTTP 200.
- Per-IP rate limiting returns HTTP 429 beyond RATE_LIMIT_COPILOT.
- Rate limits are dynamic based on config settings (RATE_LIMIT_COPILOT and RATE_LIMIT_COPILOT_DAILY).
- Different client IPs maintain separate rate limit buckets.
"""

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.security.rate_limit import limiter, get_copilot_rate_limit
from app.services.copilot_service import clear_cache


@pytest.fixture(autouse=True)
def reset_limiter_and_copilot_cache(monkeypatch):
    """Reset slowapi limiter storage, copilot cache, and ensure settings default to 30/minute."""
    monkeypatch.setattr(settings, "RATE_LIMIT_COPILOT", "30/minute")
    monkeypatch.setattr(settings, "RATE_LIMIT_COPILOT_DAILY", "300/day")
    clear_cache()
    limiter.reset()
    yield
    clear_cache()
    limiter.reset()


@pytest.fixture
def test_client() -> TestClient:
    return TestClient(app)


def test_copilot_rate_limit_helper_string():
    """Verify get_copilot_rate_limit formats combined per-minute and daily limits correctly."""
    limit_str = get_copilot_rate_limit()
    assert limit_str == f"{settings.RATE_LIMIT_COPILOT}; {settings.RATE_LIMIT_COPILOT_DAILY}"


def test_12_rapid_calls_from_one_client_all_return_200(test_client: TestClient):
    """Test requirement: 12 rapid calls from one client within the new default (60/minute) all return 200."""
    payload = {"crewId": "C001", "sol": 140}
    responses = []

    for i in range(12):
        resp = test_client.post("/api/v1/copilot/explain", json=payload)
        responses.append(resp)

    # Every one of the 12 rapid requests succeeds with 200 OK (no 429)
    for idx, resp in enumerate(responses, start=1):
        assert resp.status_code == 200, f"Request #{idx} failed with {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["mode"] in ("cached", "live", "templated")
        assert "disclaimer" in data


def test_per_ip_limit_returns_429_beyond_rate_limit_monkeypatched(test_client: TestClient, monkeypatch):
    """Test requirement: Per-IP limit returns 429 beyond RATE_LIMIT_COPILOT (using small threshold)."""
    # Set limit to 5 per minute
    monkeypatch.setattr(settings, "RATE_LIMIT_COPILOT", "5/minute")
    payload = {"crewId": "C002", "sol": 144}

    # Calls 1..5 should return 200
    for i in range(5):
        resp = test_client.post("/api/v1/copilot/explain", json=payload)
        assert resp.status_code == 200, f"Call #{i+1} unexpectedly returned {resp.status_code}"

    # Call 6 exceeds 5/minute and must return 429
    resp_excess = test_client.post("/api/v1/copilot/explain", json=payload)
    assert resp_excess.status_code == 429
    assert "Rate limit exceeded" in resp_excess.text or "too many" in resp_excess.text.lower()


def test_per_ip_limit_exceeding_default_30_returns_429(test_client: TestClient):
    """Test requirement: Exceeding default RATE_LIMIT_COPILOT (30/minute) returns 429 on call 31."""
    payload = {"crewId": "C003", "sol": 142}

    # First 30 calls return 200
    for i in range(30):
        resp = test_client.post("/api/v1/copilot/explain", json=payload)
        assert resp.status_code == 200, f"Call #{i+1} within limit unexpectedly returned {resp.status_code}"

    # Call 31 must trigger 429
    resp_31 = test_client.post("/api/v1/copilot/explain", json=payload)
    assert resp_31.status_code == 429
    assert "Rate limit exceeded" in resp_31.text or "too many" in resp_31.text.lower()
