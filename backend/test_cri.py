"""CRI unit tests. Run: python -m pytest test_cri.py
Hijab owns these tests with Hadi.
"""

from cri import calc_cri, cri_status


def test_day_142_is_61_amber():
    assert round(calc_cri(55, 60, 55, 70, 70)) == 61
    assert cri_status(61) == "amber"


def test_boundaries():
    assert cri_status(75) == "green"
    assert cri_status(74) == "amber"
    assert cri_status(60) == "amber"
    assert cri_status(59) == "red"


def test_best_and_worst():
    assert round(calc_cri(100, 100, 100, 100, 100)) == 100
    assert round(calc_cri(0, 0, 0, 0, 0)) == 0
