"""Knowledge retrieval service for NASA countermeasures.

Parses curated countermeasures from backend/knowledge/countermeasures.md
and performs keyword overlap retrieval without external vector DB dependencies.
"""

import os
import re
from typing import Dict, List, Optional, Any

DEFAULT_KNOWLEDGE_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "knowledge", "countermeasures.md")
)

ITEM_HEADER_PATTERN = re.compile(r"^##\s+([^:]+):\s*(.+)$")
SECTION_HEADER_PATTERN = re.compile(r"^#\s+(.+)$")


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
    drivers: List[str],
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
        Returns empty list if drivers is empty or no matches are found.
    """
    if not drivers:
        return []

    items = knowledge_items if knowledge_items is not None else load_knowledge()
    if not items:
        return []

    # Tokenize drivers into lowercase words
    driver_text = " ".join(drivers).lower()
    driver_words = set(re.findall(r"\b[a-z0-9_-]+\b", driver_text))

    scored_items = []
    for item in items:
        score = 0
        keywords = item.get("keywords", [])
        for kw in keywords:
            # Check for keyword occurrence as a whole word or in driver text
            if " " in kw:
                if kw in driver_text:
                    score += 2
            else:
                if kw in driver_words or kw in driver_text:
                    score += 1

        if score > 0:
            scored_items.append((score, item))

    # Sort by score descending
    scored_items.sort(key=lambda x: x[0], reverse=True)

    return [item for _, item in scored_items[:k]]
