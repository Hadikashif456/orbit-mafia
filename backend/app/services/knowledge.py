"""Knowledge retrieval service for NASA countermeasures.

Parses curated countermeasures from backend/knowledge/countermeasures.md
and performs keyword overlap retrieval without external vector DB dependencies.
"""

import os
import re
from typing import Dict, List, Optional, Any, Set

DEFAULT_KNOWLEDGE_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "knowledge", "countermeasures.md")
)

ITEM_HEADER_PATTERN = re.compile(r"^##\s+([^:]+):\s*(.+)$")
SECTION_HEADER_PATTERN = re.compile(r"^#\s+(.+)$")

# Curated synonym groups mapping physiological stressors to countermeasure keywords
SYNONYM_GROUPS: List[List[str]] = [
    ["heart", "hr", "hrv", "cardio", "cardiovascular", "cardiac", "tachycardia", "autonomic"],
    ["sleep", "insomnia", "rest", "circadian", "fatigue", "shiftwork", "restriction", "debt"],
    ["radiation", "solar", "particle", "dose", "spe", "storm", "shelter", "dosimeter", "flare", "spacewalk", "eva"],
    ["mood", "isolation", "stress", "morale", "behavioral", "burnout", "cohesion", "depression", "depressed"],
    ["exercise", "fitness", "aerobic", "resistance", "resistive", "endurance", "deconditioning", "muscle", "strength", "physical"],
    ["inflammation", "inflammatory", "immune", "immunology", "crp", "cytokine", "biomarker"],
]

# Fast bidirectional mapping: normalized word -> set of synonyms
SYNONYMS: Dict[str, Set[str]] = {}
for group in SYNONYM_GROUPS:
    group_set = {term.lower() for term in group}
    for term in group_set:
        SYNONYMS.setdefault(term, set()).update(group_set)


def strip_plural(word: str) -> str:
    """Performs simple English plural stripping on a lowercase word."""
    w = word.strip().lower()
    if len(w) <= 3:
        return w
    if w.endswith("ies") and len(w) > 4:
        return w[:-3] + "y"
    if w.endswith(("sses", "shes", "ches", "xes", "zes")):
        return w[:-2]
    if w.endswith("es") and len(w) > 3:
        return w[:-1]
    if w.endswith("s") and not w.endswith("ss"):
        return w[:-1]
    return w


def tokenize_text(text: str) -> List[str]:
    """Lowercases, strips punctuation, and extracts individual word tokens."""
    if not text:
        return []
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return [token for token in cleaned.split() if token]


def get_synonym_cluster(token: str) -> Set[str]:
    """Returns the full cluster of synonyms and word variants for a token."""
    t = token.lower()
    t_stem = strip_plural(t)
    cluster: Set[str] = {t, t_stem}
    for base in (t, t_stem):
        if base in SYNONYMS:
            for s in SYNONYMS[base]:
                cluster.add(s)
                cluster.add(strip_plural(s))
    return cluster


def load_knowledge(filepath: Optional[str] = None) -> List[Dict[str, Any]]:
    """Parses countermeasures markdown into structured protocol dictionaries.

    Args:
        filepath: Optional path to countermeasures.md. Defaults to backend/knowledge/countermeasures.md.

    Returns:
        List of item dictionaries:
            - id: str
            - title: str
            - section: str
            - keywords: List[str]
            - protocol: str
            - source: str
            - last_reviewed: str
    """
    path = filepath or DEFAULT_KNOWLEDGE_PATH
    if not os.path.exists(path):
        return []

    items: List[Dict[str, Any]] = []
    current_section = "General"
    current_item: Optional[Dict[str, Any]] = None

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if not stripped:
                continue

            # Check section header (single #)
            section_match = SECTION_HEADER_PATTERN.match(stripped)
            if section_match:
                title = section_match.group(1).strip()
                if "NASA" not in title:
                    current_section = title
                continue

            # Check item header (## <id>: <title>)
            item_match = ITEM_HEADER_PATTERN.match(stripped)
            if item_match:
                if current_item:
                    items.append(current_item)
                item_id = item_match.group(1).strip()
                item_title = item_match.group(2).strip()
                current_item = {
                    "id": item_id,
                    "title": item_title,
                    "section": current_section,
                    "keywords": [],
                    "protocol": "",
                    "source": "",
                    "last_reviewed": "",
                }
                continue

            # Field lines within an item
            if current_item:
                if stripped.lower().startswith("keywords:"):
                    kw_text = stripped[len("keywords:") :].strip()
                    keywords = [k.strip().lower() for k in kw_text.split(",") if k.strip()]
                    current_item["keywords"] = keywords
                elif stripped.lower().startswith("protocol:"):
                    current_item["protocol"] = stripped[len("protocol:") :].strip()
                elif stripped.lower().startswith("source:"):
                    current_item["source"] = stripped[len("source:") :].strip()
                elif stripped.lower().startswith("last reviewed:"):
                    current_item["last_reviewed"] = stripped[len("last reviewed:") :].strip()

    if current_item:
        items.append(current_item)

    return items


def top_k(
    drivers: Optional[List[str]],
    k: int = 3,
    knowledge_items: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Returns top k matching countermeasures based on keyword overlap with drivers.

    Args:
        drivers: List of operational stressor driver descriptions.
        k: Maximum number of items to return (default 3).
        knowledge_items: Optional pre-loaded items list.

    Returns:
        List of matching item dictionaries, ordered descending by overlap relevance.
        Ties are broken deterministically by item id ascending.
        Returns empty list if drivers is empty, None, or no matches are found.
    """
    if not drivers:
        return []

    valid_drivers = [d.strip() for d in drivers if d and isinstance(d, str) and d.strip()]
    if not valid_drivers:
        return []

    items = knowledge_items if knowledge_items is not None else load_knowledge()
    if not items:
        return []

    # Tokenize drivers into lowercase words
    driver_combined = " ".join(valid_drivers)
    driver_tokens = tokenize_text(driver_combined)
    if not driver_tokens:
        return []

    driver_stems = {strip_plural(t) for t in driver_tokens}
    driver_clean_phrase = " ".join(driver_tokens)

    # Build cluster of driver tokens and their synonyms
    driver_clusters: Set[str] = set()
    for t in driver_tokens:
        driver_clusters.update(get_synonym_cluster(t))

    scored_items: List[tuple[int, Dict[str, Any]]] = []
    for item in items:
        score = 0
        keywords = item.get("keywords", [])

        for kw in keywords:
            kw_tokens = tokenize_text(kw)
            if not kw_tokens:
                continue
            kw_phrase = " ".join(kw_tokens)

            # 1. Whole keyword phrase match in driver text (e.g. "heart rate" in "elevated heart rate")
            if len(kw_tokens) > 1 and kw_phrase in driver_clean_phrase:
                score += 5
            elif len(kw_tokens) == 1 and kw_tokens[0] in driver_tokens:
                score += 4

            # 2. Individual token match / stem match / synonym match
            for kt in kw_tokens:
                kt_stem = strip_plural(kt)
                if kt in driver_tokens or kt_stem in driver_stems:
                    score += 3
                elif kt in driver_clusters or kt_stem in driver_clusters:
                    score += 2

        if score > 0:
            scored_items.append((score, item))

    # Deterministic ordering: highest score descending, ties broken by item id ascending
    scored_items.sort(key=lambda x: (-x[0], x[1]["id"]))

    return [item for _, item in scored_items[:k]]
