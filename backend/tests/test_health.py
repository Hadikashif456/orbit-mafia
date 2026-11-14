"""Health check endpoint unit tests."""

from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)


def test_health_check_returns_ok():
    """Verify that GET /api/v1/health returns HTTP 200 with {'status': 'ok'}."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"


def test_health_deps_returns_booleans_without_secrets():
    """Verify GET /api/v1/health/deps returns booleans without leaking any secret keys."""
    response = client.get("/api/v1/health/deps")
    assert response.status_code == 200
    data = response.json()

    assert "db" in data
    assert "groq_key_present" in data
    assert isinstance(data["db"], bool)
    assert isinstance(data["groq_key_present"], bool)

    # Ensure no secret strings or key fragments appear anywhere in the response text
    raw_text = response.text
    assert "gsk_" not in raw_text
    if settings.GROQ_API_KEY:
        assert settings.GROQ_API_KEY not in raw_text
