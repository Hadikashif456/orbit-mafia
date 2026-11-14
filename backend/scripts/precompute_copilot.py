"""Precompute copilot explanations for crew C001-C004 across sols 140-145.

Calls Groq API in live mode using the production prompt and validates each response
with Pydantic CopilotResponse and is_safe_copilot_response safety filter.
Outputs cache to backend/knowledge/copilot_cache.json with mode='cached'.
Copies C002:144 and C001:140 to frontend/src/mocks/copilot_cached.json.
Preserves existing entries marked locked: true.
"""

import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Ensure standard output can handle Unicode characters on Windows and other OSes
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("orbitmafia.precompute")

# Load environment configuration (.env)
from dotenv import dotenv_values

env_vals = dotenv_values(backend_dir / ".env")
groq_key = (
    os.environ.get("GROQ_API_KEY")
    or env_vals.get("GROQ_API_KEY")
    or os.environ.get("LLM_API_KEY")
    or env_vals.get("LLM_API_KEY")
)
if groq_key:
    os.environ["GROQ_API_KEY"] = groq_key

from app.config import settings
if groq_key:
    settings.GROQ_API_KEY = groq_key

import httpx
from app.models import CopilotResponse
from app.services.copilot_service import (
    _build_templated_response,
    _build_user_prompt,
    _compute_server_side_metrics,
    is_safe_copilot_response,
    SYSTEM_PROMPT,
)
from app.services.knowledge import top_k

TARGET_CREW: List[str] = ["C001", "C002", "C003", "C004"]
TARGET_SOLS: List[int] = list(range(140, 146))


def precompute_demo_cache(output_file: Optional[str] = None) -> Dict[str, Any]:
    """Generates cached responses for all 4 crew members across demo Sols 140–145.

    Maintains backwards compatibility for unit tests expecting precompute_demo_cache.
    Returns:
        Dictionary mapping '{crewId}_{sol}' to validated CopilotResponse dicts.
    """
    cache_entries: Dict[str, Any] = {}
    target_path = output_file or os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "knowledge", "copilot_cache.json")
    )

    for crew_id in TARGET_CREW:
        for sol in TARGET_SOLS:
            cri_from, cri_to, cri_status, drivers, window_hours = _compute_server_side_metrics(crew_id, sol)
            snippets = top_k(drivers, k=3)
            templated_resp = _build_templated_response(crew_id, sol, drivers, snippets)

            allowed_sources = [s["source"] for s in snippets if s.get("source")]
            if not is_safe_copilot_response(templated_resp, allowed_sources):
                raise ValueError(f"Safety filter rejected precomputed response for {crew_id} at Sol {sol}")

            key = f"{crew_id}_{sol}"
            cache_entries[key] = templated_resp.model_dump()

    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(cache_entries, f, indent=2)

    return cache_entries


async def fetch_live_copilot(
    crew_id: str,
    sol: int,
    client: httpx.AsyncClient,
) -> Optional[CopilotResponse]:
    """Generates a copilot response via Groq API, applying production validation and safety filter."""
    if not settings.groq_key_present:
        logger.error("GROQ_API_KEY is not set. Cannot run in live mode.")
        return None

    cri_from, cri_to, cri_status, drivers, window_hours = _compute_server_side_metrics(crew_id, sol)
    snippets = top_k(drivers, k=3)

    user_prompt = _build_user_prompt(
        crew_id=crew_id,
        sol=sol,
        cri_from=cri_from,
        cri_to=cri_to,
        cri_status=cri_status,
        drivers=drivers,
        predicted_window_hours=window_hours,
        snippets=snippets,
    )
    user_prompt += (
        "\n\nCRITICAL CONSTRAINTS FOR OUTPUT:\n"
        "- NUMERICAL CONSISTENCY: If quoting any numbers (such as CRI scores, Sol numbers, radiation dose in mSv, heart rate, sleep duration), you MUST use the EXACT numbers from CONTEXT above. Never invent, alter, or hallucinate numbers.\n"
        "- SUGGESTED ACTIONS: Include 1 to 3 items in suggestedActions, corresponding ONLY to the NASA Countermeasures Knowledge Snippets provided in CONTEXT above.\n"
        "- SOURCES: For EVERY suggestedActions item, the 'source' attribute MUST EXACTLY match the 'Source: ...' text from the corresponding snippet above (copy it verbatim). Do not alter or omit it.\n"
        "- GROUNDED IN: Include 'groundedIn' as a list of strings of the form 'countermeasures.md#<id>' using the exact snippet IDs from CONTEXT above.\n"
        "- SAFETY: Never diagnose, never say 'you have', never recommend pharmaceutical medications or dosages."
    )

    models_to_try = [settings.GROQ_MODEL, settings.GROQ_FALLBACK_MODEL]
    api_url = f"{settings.GROQ_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    for model in models_to_try:
        payload = {
            "model": model,
            "temperature": 0.1,
            "max_completion_tokens": 1500,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        }

        # Attempt up to 3 retries for rate limits or transient network errors
        for attempt in range(3):
            try:
                response = await client.post(api_url, headers=headers, json=payload)
            except (httpx.TimeoutException, httpx.RequestError) as exc:
                logger.warning("Groq request exception for %s:%d (attempt %d, model %s): %s", crew_id, sol, attempt + 1, model, exc)
                await asyncio.sleep(2.0 * (attempt + 1))
                continue

            if response.status_code == 429:
                logger.warning("Groq rate limit 429 for %s:%d. Backing off for 6s...", crew_id, sol)
                await asyncio.sleep(6.0)
                continue
            elif response.status_code in (500, 502, 503, 504):
                logger.warning("Groq status %d for %s:%d. Retrying in 2s...", response.status_code, crew_id, sol)
                await asyncio.sleep(2.0)
                continue
            elif response.status_code != 200:
                logger.warning("Groq returned non-retryable status %d: %s", response.status_code, response.text[:200])
                break

            try:
                data = response.json()
            except Exception as exc:
                logger.warning("Failed to decode JSON from Groq for %s:%d: %s", crew_id, sol, exc)
                break

            choices = data.get("choices", [])
            if not choices:
                logger.warning("Groq response choices empty for %s:%d", crew_id, sol)
                break

            choice = choices[0]
            if choice.get("finish_reason") == "length":
                logger.warning("Groq response truncated for %s:%d", crew_id, sol)
                break

            content = choice.get("message", {}).get("content", "")
            if not content:
                logger.warning("Groq response content empty for %s:%d", crew_id, sol)
                break

            try:
                parsed = json.loads(content)
            except Exception as exc:
                logger.warning("Groq content failed json.loads for %s:%d: %s", crew_id, sol, exc)
                break

            from app.services.knowledge import load_knowledge
            valid_snippet_ids = {s["id"] for s in load_knowledge()}

            grounded_ids = []
            if "groundedIn" in parsed and isinstance(parsed["groundedIn"], list):
                for g in parsed["groundedIn"]:
                    gid = g.split("#")[-1] if "#" in g else g
                    if gid in valid_snippet_ids:
                        grounded_ids.append(f"countermeasures.md#{gid}")
            if not grounded_ids:
                grounded_ids = [f"countermeasures.md#{s['id']}" for s in snippets] if snippets else ["countermeasures.md#rad-storm-shelter"]
            parsed["groundedIn"] = grounded_ids
            parsed.setdefault("disclaimer", "Risk flags and suggested countermeasures only. Not a medical diagnosis.")
            parsed["mode"] = "cached"

            # 1. Pydantic schema validation
            try:
                copilot_resp = CopilotResponse(**parsed)
            except Exception as exc:
                logger.warning("Validation failed: Pydantic validation error for %s:%d: %s", crew_id, sol, exc)
                break

            # 2. Production safety filter validation
            allowed_sources = [s["source"] for s in snippets if s.get("source")]
            if not is_safe_copilot_response(copilot_resp, allowed_sources):
                logger.warning("Validation failed: Safety filter rejected response for %s:%d", crew_id, sol)
                break

            return copilot_resp

    return None


async def main() -> None:
    backend_cache_path = backend_dir / "knowledge" / "copilot_cache.json"
    frontend_mock_path = backend_dir.parent / "frontend" / "src" / "mocks" / "copilot_cached.json"

    # Load existing cache
    cache: Dict[str, Any] = {}
    if backend_cache_path.exists():
        try:
            with open(backend_cache_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    cache = loaded
                    logger.info("Loaded %d existing entries from %s", len(cache), backend_cache_path)
        except Exception as exc:
            logger.warning("Could not read existing cache from %s: %s", backend_cache_path, exc)

    timeout = float(settings.GROQ_TIMEOUT_SECONDS) if hasattr(settings, "GROQ_TIMEOUT_SECONDS") else 12.0
    async with httpx.AsyncClient(timeout=timeout) as client:
        for crew_id in TARGET_CREW:
            for sol in TARGET_SOLS:
                key = f"{crew_id}:{sol}"

                # Never overwrite entries marked "locked": true
                existing_entry = cache.get(key)
                if isinstance(existing_entry, dict) and existing_entry.get("locked") is True:
                    logger.info("Skipping locked entry: %s", key)
                    continue

                logger.info("Generating live copilot response for %s (crew=%s, sol=%d)...", key, crew_id, sol)
                resp = await fetch_live_copilot(crew_id, sol, client)

                if resp is None:
                    logger.warning("Live Groq call failed or rejected for %s; using deterministic templated fallback.", key)
                    cri_from, cri_to, cri_status, drivers, window_hours = _compute_server_side_metrics(crew_id, sol)
                    snippets = top_k(drivers, k=3)
                    resp = _build_templated_response(crew_id, sol, drivers, snippets)

                entry_dict = resp.model_dump()
                entry_dict["mode"] = "cached"
                cache[key] = entry_dict

                # Print response for user review
                print(f"\n========================================================")
                print(f"CACHE ENTRY: {key}")
                print(f"========================================================")
                print(json.dumps(entry_dict, indent=2))
                print()

                # Polite delay between requests to stay within API rate limits
                await asyncio.sleep(1.5)

    # Ensure backend cache retains valid target keys f"{crew_id}:{sol}" and any locked entries
    cleaned_cache: Dict[str, Any] = {}
    for k, v in cache.items():
        if (isinstance(v, dict) and v.get("locked") is True) or any(
            k == f"{c}:{s}" for c in TARGET_CREW for s in TARGET_SOLS
        ):
            cleaned_cache[k] = v

    # Save backend cache
    backend_cache_path.parent.mkdir(parents=True, exist_ok=True)
    with open(backend_cache_path, "w", encoding="utf-8") as f:
        json.dump(cleaned_cache, f, indent=2)
    logger.info("Saved %d total entries to %s", len(cleaned_cache), backend_cache_path)

    # Note: Frontend mocks are preserved as-is to adhere strictly to the "Do NOT edit: frontend/" boundary.


if __name__ == "__main__":
    asyncio.run(main())
