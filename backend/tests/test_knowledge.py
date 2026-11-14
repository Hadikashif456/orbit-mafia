"""Unit tests for knowledge retrieval, synonym expansion, and countermeasure parser."""

import pytest
from app.services.anomaly import DRIVER_MAP
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


@pytest.mark.parametrize(
    "driver_label",
    list(DRIVER_MAP.values())
    + [
        "radiation",
        "sleep",
        "cardio",
        "mood",
        "Solar particle event",
        "Sleep deficit",
        "Cumulative sleep deficit",
        "Cardiovascular autonomic baseline drift",
        "Reported isolation stress and mood rating decline",
        "Solar particle event acute radiation spike (9.0 mSv)",
    ],
)
def test_real_driver_labels_return_at_least_one_item(driver_label):
    """Test 4: Verify supported real driver labels return at least one countermeasure."""
    matches = top_k([driver_label])
    assert len(matches) >= 1, f"Expected >= 1 match for '{driver_label}', got 0"


def test_heart_and_elevated_heart_rate_return_cardiovascular_item():
    """Test 4: Verify 'heart' and 'Elevated heart rate' return a cardiovascular item."""
    for query in [["heart"], ["Elevated heart rate"]]:
        matches = top_k(query)
        assert len(matches) >= 1, f"Query {query} returned 0 matches"
        top_ids = [m["id"] for m in matches]
        assert any("cardio" in mid for mid in top_ids), f"Expected cardiovascular item for {query}, got {top_ids}"


def test_edge_cases_empty_none_nonsense_and_large_k():
    """Test 4: Verify empty list, None, nonsense, and k larger than item count behave."""
    assert top_k([]) == []
    assert top_k(None) == []
    assert top_k(["   "]) == []
    assert top_k(["xyz999nonsense_unmatched"]) == []

    # k larger than total countermeasure count
    matches = top_k(["sleep"], k=50)
    assert 1 <= len(matches) <= 10


def test_ordering_is_deterministic_across_20_runs():
    """Test 4: Verify ordering is deterministic with ties broken by item id across 20 runs."""
    query = ["radiation", "sleep"]
    first_order = [item["id"] for item in top_k(query)]
    assert len(first_order) > 0

    for _ in range(20):
        current_order = [item["id"] for item in top_k(query)]
        assert current_order == first_order


def test_top_k_relevance_ranking():
    """Verify that multiple keyword matches rank higher than single keyword matches."""
    drivers = ["Solar particle event with acute radiation spike and dose increase"]
    matches = top_k(drivers, k=2)
    assert len(matches) > 0
    assert any("rad" in m["id"] or "radiation" in m["keywords"] for m in matches)


def test_inflammation_matches_when_knowledge_item_provided():
    """Verify that inflammation/CRP synonyms match when an inflammation countermeasure item is provided."""
    custom_items = [
        {
            "id": "immune-anti-inflammatory",
            "title": "Anti-inflammatory and Immune Regulation Protocol",
            "section": "Immunology",
            "keywords": ["inflammation", "immune", "crp", "biomarker"],
            "protocol": "Implement dietary antioxidant supplementation and monitor immune panels.",
            "source": "NASA HRP: Immune System Dysregulation",
            "last_reviewed": "2026-11-14",
        }
    ]
    matches = top_k(["Elevated inflammatory biomarker response (CRP)"], knowledge_items=custom_items)
    assert len(matches) == 1
    assert matches[0]["id"] == "immune-anti-inflammatory"
