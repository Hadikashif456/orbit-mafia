"""Precompute copilot explanations for crew C001-C004 across sols 140-145.

Generates validated copilot responses for all 24 crew-sol pairs using Groq API
when available with 7s pacing and repeated 429 circuit breaking, or deterministic
templated fallback conforming to NASA HRP countermeasures.

Outputs cache to backend/knowledge/copilot_cache.json with mode='cached' and locked=false.
Copies C002:144 and C001:140 to frontend/src/mocks/copilot_cached.json.
"""

import argparse
import asyncio
import json
import logging
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# Ensure standard output handles UTF-8 cleanly across platforms
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
    DISCLAIMER_TEXT,
    SYSTEM_PROMPT,
)
from app.services.knowledge import load_knowledge, top_k
from app.services.data_access import get_vitals_history
from app.services.anomaly import compute_rolling_baseline, zscore_flags

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
            templated_resp = _build_templated_response(crew_id, sol, drivers, snippets, cri_to=cri_to, cri_status=cri_status)

            allowed_sources = [s["source"] for s in snippets if s.get("source")]
            if not is_safe_copilot_response(templated_resp, allowed_sources, status=cri_status):
                raise ValueError(f"Safety filter rejected precomputed response for {crew_id} at Sol {sol}")

            key = f"{crew_id}_{sol}"
            entry = templated_resp.model_dump()
            entry["mode"] = "cached"
            entry["locked"] = False
            cache_entries[key] = entry

    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(cache_entries, f, indent=2)

    return cache_entries


async def fetch_live_copilot(
    crew_id: str,
    sol: int,
    client: httpx.AsyncClient,
    consecutive_429_tracker: List[int],
) -> Optional[CopilotResponse]:
    """Generates a copilot response via Groq API, applying production validation and safety filter."""
    if not settings.groq_key_present:
        return None

    cri_from, cri_to, cri_status, drivers, window_hours = _compute_server_side_metrics(crew_id, sol)
    snippets = top_k(drivers, k=3)

    vitals = get_vitals_history(crew_id, sol, window=14)
    rolling_base = compute_rolling_baseline([v for v in vitals if sol - 14 <= v.sol < sol] or vitals)
    current_pt = [v for v in vitals if v.sol == sol][-1]
    z_flags = zscore_flags(current_pt, rolling_base)

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
        f"- State crew member {crew_id} and Sol {sol} in summary to maintain operational clarity.\n"
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

        # Attempt up to 2 retries for transient errors
        for attempt in range(2):
            try:
                response = await client.post(api_url, headers=headers, json=payload)
            except (httpx.TimeoutException, httpx.RequestError) as exc:
                logger.warning("Groq request exception for %s:%d (attempt %d, model %s): %s", crew_id, sol, attempt + 1, model, exc)
                await asyncio.sleep(2.0)
                continue

            if response.status_code == 429:
                consecutive_429_tracker[0] += 1
                logger.warning("Groq rate limit 429 for %s:%d (consecutive: %d)", crew_id, sol, consecutive_429_tracker[0])
                if consecutive_429_tracker[0] >= 2:
                    logger.error("Repeated 429 encountered; halting live Groq attempts.")
                    return None
                await asyncio.sleep(8.0)
                continue
            elif response.status_code in (500, 502, 503, 504):
                logger.warning("Groq status %d for %s:%d. Retrying...", response.status_code, crew_id, sol)
                await asyncio.sleep(2.0)
                continue
            elif response.status_code != 200:
                logger.warning("Groq non-200 status %d: %s", response.status_code, response.text[:200])
                break

            # Succeeded with 200 OK -> reset 429 tracker
            consecutive_429_tracker[0] = 0

            try:
                data = response.json()
                choices = data.get("choices", [])
                if not choices:
                    break
                content = choices[0].get("message", {}).get("content", "")
                parsed = json.loads(content)
            except Exception as exc:
                logger.warning("Failed to decode JSON from Groq for %s:%d: %s", crew_id, sol, exc)
                break

            valid_snippet_ids = {s["id"] for s in load_knowledge()}
            grounded_ids = []
            if "groundedIn" in parsed and isinstance(parsed["groundedIn"], list):
                for g in parsed["groundedIn"]:
                    gid = g.split("#")[-1] if "#" in g else g
                    if gid in valid_snippet_ids:
                        grounded_ids.append(f"countermeasures.md#{gid}")
            if not grounded_ids:
                grounded_ids = [f"countermeasures.md#{s['id']}" for s in snippets] if snippets else ["countermeasures.md#mood-workload-pacing"]
            parsed["groundedIn"] = grounded_ids
            parsed["disclaimer"] = DISCLAIMER_TEXT
            parsed["mode"] = "cached"

            # 1. Pydantic validation
            try:
                copilot_resp = CopilotResponse(**parsed)
            except Exception as exc:
                logger.warning("Pydantic validation failed for %s:%d: %s", crew_id, sol, exc)
                break

            # 2. Safety filter
            allowed_sources = [s["source"] for s in snippets if s.get("source")]
            if not is_safe_copilot_response(copilot_resp, allowed_sources, status=cri_status, z_flags=z_flags):
                logger.warning("Safety filter rejected response for %s:%d", crew_id, sol)
                break

            return copilot_resp

    return None


def check_entry_warnings(
    key: str,
    entry: Dict[str, Any],
    crew_id: str,
    sol: int,
    cri_from: float,
    cri_to: float,
    cri_status: str,
    vitals_pt: Any,
    seen_summaries: Set[str],
    valid_sources: Set[str],
    valid_snippet_ids: Set[str],
    z_flags: Optional[Dict[str, bool]] = None,
) -> List[str]:
    """Validates entry against all consistency and domain rules, returning warning messages."""
    warnings: List[str] = []
    summary = entry.get("summary", "")
    drivers = entry.get("drivers", [])
    actions = entry.get("suggestedActions", [])
    grounded_in = entry.get("groundedIn", [])

    # 1. Check occurrence of "VitalOrbit"
    full_text = json.dumps(entry)
    if "vitalorbit" in full_text.lower():
        warnings.append("Mentions 'VitalOrbit'")

    # 2. Duplicated summaries
    if summary in seen_summaries:
        warnings.append("Duplicated summary")
    seen_summaries.add(summary)

    # 3. Green crew forbidden words
    if cri_status == "green":
        has_z = z_flags and any(z_flags.values())
        if not has_z:
            combined = (
                summary
                + " "
                + " ".join(drivers)
                + " "
                + " ".join(a.get("title", "") + " " + a.get("protocol", "") for a in actions)
            ).lower()
            for w in ["elevated", "depressed", "deficit", "strain"]:
                if w in combined:
                    warnings.append(f"Forbidden word for green crew: '{w}'")

    # 4. Sources and groundedIn in countermeasures.md
    for action in actions:
        src = action.get("source", "").strip().lower()
        if src not in valid_sources:
            warnings.append(f"Invalid source: '{action.get('source')}'")
    for gid in grounded_in:
        raw_id = gid.split("#")[-1] if "#" in gid else gid
        if raw_id not in valid_snippet_ids and raw_id != "general":
            warnings.append(f"Invalid groundedIn: '{gid}'")

    # 5. Number matching
    combined_content = summary + " " + " ".join(drivers)

    # Check CRI quotes
    cri_matches = re.findall(r"CRI[:\s]+(\d+\.?\d*)", combined_content, re.IGNORECASE)
    for m in cri_matches:
        val = float(m)
        if abs(val - cri_to) > 1.0 and abs(val - cri_from) > 1.0:
            warnings.append(f"CRI mismatch: quoted {val}, expected ~{cri_to:.1f}")

    # Check HR quotes
    hr_matches = re.findall(r"HR\s*:?\s*(\d+\.?\d*)", combined_content, re.IGNORECASE)
    hr_matches += re.findall(r"(\d+\.?\d*)\s*bpm", combined_content, re.IGNORECASE)
    for m in hr_matches:
        val = float(m)
        if abs(val - vitals_pt.hr) > 0.1:
            warnings.append(f"HR mismatch: quoted {val}, DB has {vitals_pt.hr:.1f}")

    # Check HRV quotes
    hrv_matches = re.findall(r"HRV\s*:?\s*(\d+\.?\d*)", combined_content, re.IGNORECASE)
    hrv_matches += re.findall(r"(\d+\.?\d*)\s*ms\b", combined_content, re.IGNORECASE)
    for m in hrv_matches:
        val = float(m)
        if abs(val - vitals_pt.hrv) > 0.1:
            warnings.append(f"HRV mismatch: quoted {val}, DB has {vitals_pt.hrv:.1f}")

    # Check Radiation quotes
    rad_matches = re.findall(r"(\d+\.?\d*)\s*mSv", combined_content, re.IGNORECASE)
    for m in rad_matches:
        val = float(m)
        if abs(val - vitals_pt.radiationMsv) > 0.1:
            warnings.append(f"Radiation mismatch: quoted {val}, DB has {vitals_pt.radiationMsv:.2f}")

    # Check Sleep quotes (exclude window hours like 48h / 48-hour)
    sleep_matches = re.findall(r"(?<!\d-)(?<!\d\s)(\d+\.\d+)\s*h\b", combined_content, re.IGNORECASE)
    for m in sleep_matches:
        val = float(m)
        if abs(val - vitals_pt.sleepHours) > 0.1:
            warnings.append(f"Sleep mismatch: quoted {val}, DB has {vitals_pt.sleepHours:.1f}")

    return warnings


async def main() -> None:
    parser = argparse.ArgumentParser(description="Precompute Orbit Mafia Copilot cache.")
    parser.add_argument("--refresh-all", action="store_true", help="Regenerate all 24 entries.")
    parser.add_argument("--yes", "-y", action="store_true", help="Skip interactive confirmation.")
    parser.add_argument("--output", type=str, default=None, help="Custom cache output path.")
    args = parser.parse_args()

    if args.refresh_all and not args.yes:
        try:
            confirm = input("Type YES to confirm refresh all entries: ")
            if confirm.strip() != "YES":
                print("Aborted.")
                sys.exit(0)
        except EOFError:
            pass

    backend_cache_path = Path(args.output) if args.output else backend_dir / "knowledge" / "copilot_cache.json"
    frontend_mock_path = backend_dir.parent / "frontend" / "src" / "mocks" / "copilot_cached.json"

    # Pre-load knowledge snippets and allowed sources
    snippets_all = load_knowledge()
    valid_snippet_ids = {s["id"] for s in snippets_all}
    valid_sources = {s["source"].strip().lower() for s in snippets_all if s.get("source")}
    valid_sources.add("nasa hrp: behavioral health & performance in deep space habitats")

    consecutive_429 = [0]
    groq_available = bool(settings.groq_key_present)
    cache: Dict[str, Any] = {}
    table_rows: List[Dict[str, str]] = []
    seen_summaries: Set[str] = set()

    timeout = float(settings.GROQ_TIMEOUT_SECONDS) if hasattr(settings, "GROQ_TIMEOUT_SECONDS") else 12.0
    async with httpx.AsyncClient(timeout=timeout) as client:
        for crew_id in TARGET_CREW:
            for sol in TARGET_SOLS:
                key = f"{crew_id}:{sol}"
                cri_from, cri_to, cri_status, drivers, window_hours = _compute_server_side_metrics(crew_id, sol)
                snippets = top_k(drivers, k=3)

                vitals = get_vitals_history(crew_id, sol, window=14)
                rolling_base = compute_rolling_baseline([v for v in vitals if sol - 14 <= v.sol < sol] or vitals)
                current_pt = [v for v in vitals if v.sol == sol][-1]
                z_flags = zscore_flags(current_pt, rolling_base)

                resp: Optional[CopilotResponse] = None
                mode_used = "cached"

                # Try live Groq API if available and not blocked by repeated 429
                if groq_available and consecutive_429[0] < 2:
                    logger.info("Calling Groq live API for %s...", key)
                    resp = await fetch_live_copilot(crew_id, sol, client, consecutive_429)
                    if resp is not None:
                        mode_used = "live"
                    # Pace Groq calls 7 seconds apart as required
                    await asyncio.sleep(7.0)
                else:
                    if consecutive_429[0] >= 2 and groq_available:
                        logger.warning("Skipping live call for %s due to repeated 429 circuit break.", key)

                # Fallback to deterministic templated response if live generation was unavailable or rejected
                if resp is None:
                    resp = _build_templated_response(crew_id, sol, drivers, snippets, cri_to=cri_to, cri_status=cri_status)
                    mode_used = "templated"

                entry_dict = resp.model_dump()
                entry_dict["mode"] = "cached"
                entry_dict["locked"] = False
                entry_dict["disclaimer"] = DISCLAIMER_TEXT
                cache[key] = entry_dict

                # Perform comprehensive warning checks
                warnings = check_entry_warnings(
                    key=key,
                    entry=entry_dict,
                    crew_id=crew_id,
                    sol=sol,
                    cri_from=cri_from,
                    cri_to=cri_to,
                    cri_status=cri_status,
                    vitals_pt=current_pt,
                    seen_summaries=seen_summaries,
                    valid_sources=valid_sources,
                    valid_snippet_ids=valid_snippet_ids,
                    z_flags=z_flags,
                )

                first120 = entry_dict["summary"][:120].replace("\n", " ")
                table_rows.append({
                    "key": key,
                    "cri": f"{cri_from:.1f} -> {cri_to:.1f}",
                    "mode": mode_used,
                    "first120": first120,
                    "warnings": "; ".join(warnings) if warnings else "None",
                })

    # Save backend copilot_cache.json
    backend_cache_path.parent.mkdir(parents=True, exist_ok=True)
    with open(backend_cache_path, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2)
    logger.info("Saved %d total entries to %s", len(cache), backend_cache_path)

    # Copy C002:144 and C001:140 into frontend/src/mocks/copilot_cached.json
    frontend_mock_data = {}
    if "C002:144" in cache:
        frontend_mock_data["C002:144"] = cache["C002:144"]
    if "C001:140" in cache:
        frontend_mock_data["C001:140"] = cache["C001:140"]

    if frontend_mock_data:
        frontend_mock_path.parent.mkdir(parents=True, exist_ok=True)
        with open(frontend_mock_path, "w", encoding="utf-8") as f:
            json.dump(frontend_mock_data, f, indent=2)
        logger.info("Updated frontend mock file %s with keys %s", frontend_mock_path, list(frontend_mock_data.keys()))

    # Print required verification table
    print("\n" + "=" * 120)
    print(f"{'key':<10} | {'CRI from -> to':<16} | {'mode':<10} | {'first 120 chars':<55} | {'warnings'}")
    print("-" * 120)
    for row in table_rows:
        print(f"{row['key']:<10} | {row['cri']:<16} | {row['mode']:<10} | {row['first120']:<55} | {row['warnings']}")
    print("=" * 120 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
