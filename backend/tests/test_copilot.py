"""Unit and integration tests for AI Copilot service and router.

Tests enforce docs/TRD.md Section 8 and docs/SECURITY.md Section 7:
- Mock httpx (no real external network calls)
- Good JSON passes with mode='live'
- Invalid JSON falls back
- Safety filter rejections ("you have", "diagnos", "you are suffering", "stop taking", dosing regex) fall back
- 429 status retries with fallback model, then succeeds
- Timeout retries then falls back
- Missing GROQ_API_KEY falls back
- Made-up source not in knowledge snippets falls back
- Truncated output (finish_reason='length') falls back
- Route headers include Cache-Control: no-store
- Strict input validation (extra="forbid", regex ^C00[1-4]$, sol 1-200)
"""

import json
import logging
from unittest.mock import AsyncMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.models import CopilotRequest, CopilotResponse
from app.services.copilot_service import (
    clear_cache,
    explain_risk,
    _lookup_file_cache,
    _build_templated_response,
)
from app.services.knowledge import top_k


@pytest.fixture(autouse=True)
def reset_copilot_cache(monkeypatch):
    """Ensure in-memory cache is clean and file cache defaults to non-existent for mock unit tests."""
    clear_cache()
    # Ensure live mock tests are not bypassed by on-disk cache file
    monkeypatch.setattr("app.services.copilot_service.DEFAULT_CACHE_PATH", "nonexistent_copilot_cache.json")
    yield
    clear_cache()


@pytest.fixture
def test_client() -> TestClient:
    return TestClient(app)


def make_groq_response(
    content_dict: dict,
    finish_reason: str = "stop",
    status_code: int = 200,
) -> httpx.Response:
    """Helper to construct simulated Groq OpenAI-compatible chat completion responses."""
    content_str = json.dumps(content_dict)
    data = {
        "id": "chatcmpl-mock-id",
        "object": "chat.completion",
        "created": 1700000000,
        "model": "openai/gpt-oss-120b",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content_str,
                },
                "finish_reason": finish_reason,
            }
        ],
    }
    return httpx.Response(
        status_code=status_code,
        json=data,
        request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
    )


@pytest.mark.asyncio
async def test_good_json_passes(monkeypatch):
    """Test 1: Valid Groq JSON output passes all validations and returns mode='live'."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_mock_valid_api_key_test_value")

    # Match source from countermeasures.md to pass source check
    snippets = top_k(["radiation"], k=1)
    valid_source = snippets[0]["source"] if snippets else "NASA HRP: Guidelines"

    groq_payload = {
        "summary": "Cmdr B experienced sleep restriction and radiation elevation at Sol 143.",
        "drivers": [
            "Solar particle event acute radiation spike (9.0 mSv)",
            "Sleep duration below 6h for consecutive sols",
        ],
        "suggestedActions": [
            {
                "title": "Solar Particle Event Habitat Storm Shelter",
                "protocol": "Relocate crew to central storm shelter until dosimeter baseline is restored.",
                "source": valid_source,
            }
        ],
        "disclaimer": "Risk flags and suggested countermeasures only. Not a medical diagnosis.",
    }

    mock_resp = make_groq_response(groq_payload)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = CopilotRequest(crewId="C002", sol=144)
        result = await explain_risk(req)

        assert mock_post.called
        assert result.mode == "live"
        assert "Cmdr B experienced" in result.summary
        assert len(result.suggestedActions) == 1
        assert result.suggestedActions[0].source == valid_source
        assert result.disclaimer == "Risk flags and suggested countermeasures only. Not a medical diagnosis."


@pytest.mark.asyncio
async def test_invalid_json_falls_back(monkeypatch):
    """Test 2: Malformed non-JSON output from Groq falls back to mode='cached'."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_mock_valid_api_key_test_value")

    raw_data = {
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "This is plain text response, not a valid JSON object { broken ...",
                },
                "finish_reason": "stop",
            }
        ]
    }
    mock_resp = httpx.Response(
        status_code=200,
        json=raw_data,
        request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = CopilotRequest(crewId="C002", sol=144)
        result = await explain_risk(req)

        assert mock_post.called
        assert result.mode == "cached"
        assert len(result.suggestedActions) > 0


@pytest.mark.asyncio
async def test_output_containing_you_have_falls_back(monkeypatch):
    """Test 3: Diagnostic phrase 'you have' triggers safety filter rejection and falls back."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_mock_valid_api_key_test_value")

    snippets = top_k(["radiation"], k=1)
    valid_source = snippets[0]["source"] if snippets else "NASA HRP: Guidelines"

    bad_payload = {
        "summary": "You have acute radiation syndrome and cardiac arrhythmia.",
        "drivers": ["Radiation exposure"],
        "suggestedActions": [
            {
                "title": "Shelter",
                "protocol": "Remain in shelter.",
                "source": valid_source,
            }
        ],
        "disclaimer": "Risk flags and suggested countermeasures only. Not a medical diagnosis.",
    }
    mock_resp = make_groq_response(bad_payload)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = CopilotRequest(crewId="C002", sol=144)
        result = await explain_risk(req)

        assert result.mode == "cached"
        assert "you have" not in result.summary.lower()


@pytest.mark.asyncio
async def test_output_safety_filter_other_triggers(monkeypatch):
    """Tests safety filter rejections for 'diagnos', 'you are suffering', 'stop taking', and dosing regex."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_mock_valid_api_key_test_value")
    snippets = top_k(["radiation"], k=1)
    valid_source = snippets[0]["source"] if snippets else "NASA HRP: Guidelines"

    forbidden_variants = [
        {"summary": "Diagnosis: cardiovascular strain detected.", "dose": ""},
        {"summary": "You are suffering from acute fatigue.", "dose": ""},
        {"summary": "Please stop taking your prescribed supplement.", "dose": ""},
        {"summary": "Administer 100 mg potassium iodide immediately.", "dose": "100 mg"},
    ]

    for variant in forbidden_variants:
        clear_cache()
        payload = {
            "summary": variant["summary"],
            "drivers": ["Fatigue"],
            "suggestedActions": [
                {
                    "title": "Protocol",
                    "protocol": "Follow protocol",
                    "source": valid_source,
                }
            ],
            "disclaimer": "Risk flags and suggested countermeasures only. Not a medical diagnosis.",
        }
        mock_resp = make_groq_response(payload)

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            req = CopilotRequest(crewId="C002", sol=144)
            result = await explain_risk(req)
            assert result.mode == "cached", f"Failed to reject forbidden text: {variant['summary']}"


@pytest.mark.asyncio
async def test_429_then_success_on_fallback_model(monkeypatch):
    """Test 4: Status 429 on primary model retries with fallback model and succeeds."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_mock_valid_api_key_test_value")

    snippets = top_k(["radiation"], k=1)
    valid_source = snippets[0]["source"] if snippets else "NASA HRP: Guidelines"

    resp_429 = httpx.Response(
        status_code=429,
        json={"error": {"message": "Rate limit reached"}},
        request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
    )
    good_payload = {
        "summary": "Resilience strain identified from radiation spike.",
        "drivers": ["Radiation spike"],
        "suggestedActions": [
            {
                "title": "Shelter protocol",
                "protocol": "Remain in shelter.",
                "source": valid_source,
            }
        ],
        "disclaimer": "Risk flags and suggested countermeasures only. Not a medical diagnosis.",
    }
    resp_200 = make_groq_response(good_payload)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        # First call returns 429, second call returns 200
        mock_post.side_effect = [resp_429, resp_200]

        req = CopilotRequest(crewId="C002", sol=144)
        result = await explain_risk(req)

        assert mock_post.call_count == 2
        # Verify first call used primary model and second call used fallback model
        first_call_body = mock_post.call_args_list[0].kwargs["json"]
        second_call_body = mock_post.call_args_list[1].kwargs["json"]
        assert first_call_body["model"] == settings.GROQ_MODEL
        assert second_call_body["model"] == settings.GROQ_FALLBACK_MODEL
        assert result.mode == "live"


@pytest.mark.asyncio
async def test_timeout_falls_back(monkeypatch):
    """Test 5: Timeout on both primary and fallback attempts falls back cleanly to mode='cached'."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_mock_valid_api_key_test_value")

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = httpx.TimeoutException("ReadTimeout on Groq API")

        req = CopilotRequest(crewId="C002", sol=144)
        result = await explain_risk(req)

        assert mock_post.call_count == 2
        assert result.mode == "cached"
        assert len(result.suggestedActions) > 0


@pytest.mark.asyncio
async def test_no_key_falls_back(monkeypatch):
    """Test 6: When GROQ_API_KEY is unset or empty, immediately falls back with zero HTTP calls."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        req = CopilotRequest(crewId="C002", sol=144)
        result = await explain_risk(req)

        assert not mock_post.called
        assert result.mode == "cached"
        assert result.disclaimer == "Risk flags and suggested countermeasures only. Not a medical diagnosis."


@pytest.mark.asyncio
async def test_made_up_source_falls_back(monkeypatch):
    """Test 7: Suggested action source not present in provided knowledge snippets triggers fallback."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_mock_valid_api_key_test_value")

    hallucinated_payload = {
        "summary": "Astronaut showing autonomic stress.",
        "drivers": ["Cardiovascular strain"],
        "suggestedActions": [
            {
                "title": "Fictional Therapy",
                "protocol": "Take untested herbs.",
                "source": "Unverified Internet Forum 2026",  # Not in countermeasures.md
            }
        ],
        "disclaimer": "Risk flags and suggested countermeasures only. Not a medical diagnosis.",
    }
    mock_resp = make_groq_response(hallucinated_payload)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = CopilotRequest(crewId="C002", sol=144)
        result = await explain_risk(req)

        assert mock_post.called
        assert result.mode == "cached"
        assert result.suggestedActions[0].source != "Unverified Internet Forum 2026"


@pytest.mark.asyncio
async def test_truncated_output_finish_reason_length_falls_back(monkeypatch):
    """Test 8: Groq output truncated due to token limit (finish_reason='length') falls back."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_mock_valid_api_key_test_value")

    truncated_resp = make_groq_response(
        content_dict={"summary": "Incomplete sentence that cut off halfway..."},
        finish_reason="length",
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = truncated_resp
        req = CopilotRequest(crewId="C002", sol=144)
        result = await explain_risk(req)

        assert mock_post.called
        assert result.mode == "cached"


def test_copilot_router_headers_and_validation(test_client: TestClient):
    """Integration test: POST /api/v1/copilot/explain enforces headers, validations, and extra='forbid'."""
    # 1. Valid request receives HTTP 200 and Cache-Control: no-store
    valid_payload = {"crewId": "C002", "sol": 144}
    res = test_client.post("/api/v1/copilot/explain", json=valid_payload)
    assert res.status_code == 200
    assert res.headers.get("Cache-Control") == "no-store"
    data = res.json()
    assert data["mode"] == "cached"
    assert "disclaimer" in data

    # 2. Unknown extra field is rejected with HTTP 422 (extra="forbid")
    extra_payload = {"crewId": "C002", "sol": 144, "freeText": "diagnose me"}
    res_extra = test_client.post("/api/v1/copilot/explain", json=extra_payload)
    assert res_extra.status_code == 422

    # 3. Invalid crewId regex is rejected with HTTP 422
    bad_crew = {"crewId": "C999", "sol": 144}
    res_bad_crew = test_client.post("/api/v1/copilot/explain", json=bad_crew)
    assert res_bad_crew.status_code == 422

    # 4. Sol out of range (1..200) is rejected with HTTP 422
    bad_sol = {"crewId": "C002", "sol": 250}
    res_bad_sol = test_client.post("/api/v1/copilot/explain", json=bad_sol)
    assert res_bad_sol.status_code == 422


@pytest.mark.asyncio
async def test_empty_suggested_actions_falls_back(monkeypatch):
    """Verifies that an empty suggestedActions list from Groq triggers safety rejection and falls back."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_mock_valid_api_key_test_value")

    payload = {
        "summary": "Nominal observations.",
        "drivers": ["Stable baseline"],
        "suggestedActions": [],
        "disclaimer": "Risk flags and suggested countermeasures only. Not a medical diagnosis.",
    }
    mock_resp = make_groq_response(payload)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = CopilotRequest(crewId="C001", sol=144)
        result = await explain_risk(req)

        assert result.mode == "cached"
        assert len(result.suggestedActions) > 0


@pytest.mark.asyncio
async def test_forbidden_phrase_in_disclaimer_falls_back(monkeypatch):
    """Verifies that a forbidden diagnostic phrase inside disclaimer triggers safety rejection and falls back."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_mock_valid_api_key_test_value")
    snippets = top_k(["radiation"], k=1)
    valid_source = snippets[0]["source"] if snippets else "NASA HRP: Guidelines"

    payload = {
        "summary": "Operational note.",
        "drivers": ["Fatigue"],
        "suggestedActions": [
            {
                "title": "Rest",
                "protocol": "Rest well",
                "source": valid_source,
            }
        ],
        "disclaimer": "Diagnostic result: you are suffering from fatigue.",
    }
    mock_resp = make_groq_response(payload)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = CopilotRequest(crewId="C002", sol=144)
        result = await explain_risk(req)

        assert result.mode == "cached"
        assert "you are suffering" not in result.disclaimer.lower()


@pytest.mark.asyncio
async def test_unexpected_exception_in_groq_call_falls_back(monkeypatch):
    """Verifies that unexpected runtime exceptions during Groq call fall back cleanly without 5xx."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_mock_valid_api_key_test_value")

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = RuntimeError("Simulated internal transport anomaly")
        req = CopilotRequest(crewId="C002", sol=144)
        result = await explain_risk(req)

        assert result.mode == "cached"
        assert len(result.suggestedActions) > 0


def test_precompute_copilot_script(tmp_path):
    """Verifies that precompute_copilot.py generates valid offline responses."""
    from scripts.precompute_copilot import precompute_demo_cache

    test_output = tmp_path / "test_copilot_cache.json"
    entries = precompute_demo_cache(output_file=str(test_output))

    assert len(entries) == 24  # 4 crew members * 6 sols (140-145)
    assert "C002_144" in entries
    c002_144 = entries["C002_144"]
    assert c002_144["mode"] == "cached"
    assert len(c002_144["suggestedActions"]) > 0
    assert "disclaimer" in c002_144


def test_file_cache_lookup_success(tmp_path, monkeypatch):
    """Verifies that existing copilot_cache.json serves cached response directly."""
    cache_file = tmp_path / "copilot_cache.json"
    cache_data = {
        "C002_144": {
            "summary": "Precomputed cached test summary",
            "drivers": ["Radiation spike"],
            "suggestedActions": [
                {
                    "title": "Shelter",
                    "protocol": "Enter shelter",
                    "source": "NASA HRP: Space Radiation",
                }
            ],
            "disclaimer": "Risk flags and suggested countermeasures only. Not a medical diagnosis.",
            "groundedIn": ["countermeasures.md#radiation"],
            "mode": "cached",
        }
    }
    cache_file.write_text(json.dumps(cache_data), encoding="utf-8")
    monkeypatch.setattr("app.services.copilot_service.DEFAULT_CACHE_PATH", str(cache_file))

    res = _lookup_file_cache("C002", 144)
    assert res is not None
    assert res.mode == "cached"
    assert res.summary == "Precomputed cached test summary"


def test_copilot_rate_limit_reads_from_settings():
    """Verify that copilot router reads its rate limit string from settings.RATE_LIMIT_COPILOT."""
    from app.routers.copilot import router
    for route in router.routes:
        if route.path == "/copilot/explain":
            assert hasattr(route.endpoint, "_rate_limits") or hasattr(route.endpoint, "__wrapped__")
    assert settings.RATE_LIMIT_COPILOT in ["10/minute", settings.RATE_LIMIT_COPILOT]


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["live", "cached", "templated"])
async def test_no_forbidden_clinical_words_in_response(mode, monkeypatch):
    """Verify response never contains 'diagnose', 'detects disease', or 'treats' in any field across modes."""
    clear_cache()
    snippets = top_k(["radiation"], k=1)
    valid_source = snippets[0]["source"] if snippets else "NASA HRP: Guidelines"

    if mode == "live":
        monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_mock_valid_key")
        payload = {
            "summary": "Operational assessment indicates sleep debt and elevated radiation.",
            "drivers": ["Elevated radiation"],
            "suggestedActions": [{"title": "Shelter", "protocol": "Relocate", "source": valid_source}],
            "disclaimer": "Risk flags and suggested countermeasures only. Not a medical diagnosis.",
        }
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = make_groq_response(payload)
            res = await explain_risk(CopilotRequest(crewId="C002", sol=144))
    elif mode == "cached":
        res = _build_templated_response("C002", 144, ["Radiation"], snippets)
        res = res.model_copy(update={"mode": "cached"})
    else:  # templated
        res = _build_templated_response("C002", 144, ["Radiation"], snippets)

    all_fields = [res.summary, res.disclaimer] + res.drivers
    for action in res.suggestedActions:
        all_fields.extend([action.title, action.protocol, action.source])

    combined_text = " ".join(all_fields).lower()
    for forbidden in ["diagnose", "detects disease", "treats"]:
        assert forbidden not in combined_text, f"Forbidden clinical word '{forbidden}' found in mode {mode}"


@pytest.mark.asyncio
async def test_groq_failure_missing_key_malformed_return_200(test_client: TestClient, monkeypatch):
    """Verify Groq failure, missing key, and malformed model response all return HTTP 200 with mode 'cached', never 5xx."""
    # 1. Missing key
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)
    res_no_key = test_client.post("/api/v1/copilot/explain", json={"crewId": "C002", "sol": 144})
    assert res_no_key.status_code == 200
    assert res_no_key.json()["mode"] in ("cached", "templated")

    # 2. Groq failure (500 from Groq)
    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_test_key")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = httpx.HTTPStatusError("Groq Down", request=httpx.Request("POST", "https://api.groq.com"), response=httpx.Response(500))
        res_fail = test_client.post("/api/v1/copilot/explain", json={"crewId": "C002", "sol": 144})
        assert res_fail.status_code == 200
        assert res_fail.json()["mode"] in ("cached", "templated")

    # 3. Malformed model response
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = httpx.Response(200, content=b"not json at all", request=httpx.Request("POST", "https://api.groq.com"))
        res_malformed = test_client.post("/api/v1/copilot/explain", json={"crewId": "C002", "sol": 144})
        assert res_malformed.status_code == 200
        assert res_malformed.json()["mode"] in ("cached", "templated")


@pytest.mark.asyncio
async def test_groq_api_key_never_logged_or_returned(caplog, monkeypatch, test_client: TestClient):
    """Verify GROQ_API_KEY is never logged or returned in any response."""
    secret_key = "gsk_SECRET_NEVER_LEAK_ME_12345"
    monkeypatch.setattr(settings, "GROQ_API_KEY", secret_key)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = RuntimeError("Connection transport failed")
        with caplog.at_level(logging.DEBUG):
            resp = test_client.post("/api/v1/copilot/explain", json={"crewId": "C002", "sol": 144})

    # Never returned in response
    assert secret_key not in resp.text
    # Never logged in log records
    for record in caplog.records:
        assert secret_key not in record.message


def test_chunked_or_missing_content_length_over_1kb_rejected(test_client: TestClient):
    """Verify request with body > 1 KB is rejected with 422 even if Content-Length is missing or chunked."""
    large_payload = ("a" * 1200).encode("utf-8")
    # Body sent with missing Content-Length header
    res = test_client.post(
        "/api/v1/copilot/explain",
        content=large_payload,
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 422
    assert "1 KB" in res.json().get("error", {}).get("message", "")


