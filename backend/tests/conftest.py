"""Pytest configuration and safety fixtures for Orbit Mafia backend tests.

Enforces offline test isolation:
- Registers the 'live' marker and skips live tests by default unless RUN_LIVE_TESTS=1.
- Autouse fixture neutralizes settings.GROQ_API_KEY to None.
- Points the copilot file-cache path (DEFAULT_CACHE_PATH) to the real copilot_cache.json.
- Blocks real outbound network requests via httpx.AsyncClient and httpx.Client unless marked @pytest.mark.live.
"""

import os
from typing import List
import pytest
import httpx

from app.config import settings

# Canonical absolute path to the curated demo cache file
REAL_CACHE_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "knowledge", "copilot_cache.json")
)


def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers."""
    config.addinivalue_line(
        "markers", "live: mark test as requiring live network / external API"
    )


def pytest_collection_modifyitems(config: pytest.Config, items: List[pytest.Item]) -> None:
    """Skip live tests unless RUN_LIVE_TESTS=1."""
    if os.environ.get("RUN_LIVE_TESTS") != "1":
        skip_live = pytest.mark.skip(
            reason="Live tests skipped by default (set RUN_LIVE_TESTS=1 to run)"
        )
        for item in items:
            if item.get_closest_marker("live") is not None:
                item.add_marker(skip_live)


@pytest.fixture(autouse=True)
def auto_test_env(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch):
    """Enforces test isolation for all tests:
    1. Sets settings.GROQ_API_KEY to None and unsets it from os.environ.
    2. Points copilot file cache path to the real cache.
    3. Blocks real network requests on httpx.AsyncClient and httpx.Client unless marked @pytest.mark.live.
    """
    # 1. Neutralize GROQ_API_KEY on the settings instance the app actually uses
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)

    # 2. Point copilot file-cache path to the real cache
    monkeypatch.setattr("app.services.copilot_service.DEFAULT_CACHE_PATH", REAL_CACHE_PATH)

    # 3. Block real network unless test is marked @pytest.mark.live
    if not request.node.get_closest_marker("live"):
        original_async_send = httpx.AsyncClient.send

        async def blocked_async_send(self, req, *args, **kwargs):
            transport = getattr(self, "_transport", None)
            if transport is not None and not isinstance(transport, httpx.AsyncHTTPTransport):
                return await original_async_send(self, req, *args, **kwargs)
            raise RuntimeError("network blocked in tests")

        monkeypatch.setattr(httpx.AsyncClient, "send", blocked_async_send)

        original_client_send = httpx.Client.send

        def blocked_client_send(self, req, *args, **kwargs):
            transport = getattr(self, "_transport", None)
            if transport is not None and not isinstance(transport, httpx.HTTPTransport):
                return original_client_send(self, req, *args, **kwargs)
            raise RuntimeError("network blocked in tests")

        monkeypatch.setattr(httpx.Client, "send", blocked_client_send)

    yield
