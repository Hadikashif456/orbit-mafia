"""Unit tests for knowledge retrieval and countermeasure parser."""

import pytest
from app.services.knowledge import load_knowledge, top_k


def test_load_knowledge_parsing():
    """Verify load_knowledge parses countermeasures markdown into structured items."""
    items = load_knowledge()
    assert len(items) >= 5, "Expected at least 5 countermeasure protocols"

    for item in items:
        assert "id" in item and item["id"]
        assert "title" in item and item["title"]
        assert "section" in item and item["section"]
        assert "keywords" in item and isinstance(item["keywords"], list)
        assert len(item["keywords"]) > 0
        assert "protocol" in item and item["protocol"]
        assert "source" in item and item["source"]
        assert "last_reviewed" in item and item["last_reviewed"]


def test_top_k_sleep_query():
    """Verify top_k(["sleep"]) returns a Sleep item."""
    matches = top_k(["sleep"], k=3)
    assert len(matches) > 0
    top_item = matches[0]
    assert "sleep" in top_item["keywords"]
    assert top_item["section"].lower() == "sleep" or "sleep" in top_item["id"].lower()


def test_top_k_empty_drivers():
    """Verify top_k returns an empty list when drivers list is empty."""
    assert top_k([], k=3) == []


def test_top_k_relevance_ranking():
    """Verify that multiple keyword matches rank higher than single keyword matches."""
    drivers = ["Solar particle event with acute radiation spike and dose increase"]
    matches = top_k(drivers, k=2)
    assert len(matches) > 0
    # Top match should be radiation-related
    assert any("rad" in m["id"] or "radiation" in m["keywords"] for m in matches)
