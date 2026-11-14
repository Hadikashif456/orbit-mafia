"""Crew Resilience Index (CRI), 0 to 100.

CRI = Sleep 25% + Cardiovascular/HRV 25% + Radiation 20% + Exercise 15% + Mood 15%
Each part is scored 0 to 100 against the astronaut's own baseline.
Status: 75-100 green, 60-74 amber, below 60 red.
Orbit Mafia flags risk. It does not diagnose disease.
"""


def calc_cri(sleep, cardio, radiation, exercise, mood):
    """Return CRI as a float. All inputs are 0 to 100."""
    return (
        sleep * 0.25
        + cardio * 0.25
        + radiation * 0.20
        + exercise * 0.15
        + mood * 0.15
    )


def cri_status(cri):
    """Return green, amber, or red for a CRI score."""
    if cri >= 75:
        return "green"
    if cri >= 60:
        return "amber"
    return "red"


def cri_explanation(sleep, cardio, radiation, exercise, mood):
    """Return the drivers that pulled CRI down, in plain words."""
    drivers = []
    if sleep < 65:
        drivers.append("sleep under 6 hours for 3 nights")
    if cardio < 65:
        drivers.append("HRV falling from personal baseline")
    if radiation < 65:
        drivers.append("radiation event yesterday")
    if exercise < 65:
        drivers.append("missed exercise sessions")
    if mood < 65:
        drivers.append("low mood and focus score")
    if not drivers:
        drivers.append("all signals near baseline")
    return drivers


if __name__ == "__main__":
    # Day 142 test. This must print 61 and amber.
    # Inputs are synthetic demo scores, not real astronaut records.
    cri = calc_cri(55, 60, 55, 70, 70)
    print(round(cri), cri_status(cri))
    print(cri_explanation(55, 60, 55, 70, 70))
