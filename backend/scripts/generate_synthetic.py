"""Synthetic Daily Vitals Generator Script.

Generates realistic physiological time series for 4 crew members across Sol 1–145,
incorporating the Sol 141–143 sleep disruption and Sol 143 solar particle event.

Rules & Requirements (from TRD Section 4):
- Seeded generation (`seed=42`), Sol 1–145, 4 crew members (`C001`..`C004`).
- Healthy Baseline Distributions:
    * Resting Heart Rate: HR ~ N(62, 3) bpm
    * Heart Rate Variability: HRV ~ N(65, 6) ms
    * Sleep Duration: Sleep ~ N(7.2, 0.5) hours
    * Background Radiation: Radiation ~ 1.84 mSv/day +/- 0.15 (approximate Mars transit dosage)
    * Exercise Duration: Exercise ~ 45 +/- 10 minutes
    * Subjective Mood: Mood ~ 4 +/- 0.5 (integer scale 1..5)
- Scripted Scenario for C002 (Cmdr B):
    * Sol 141–143: Cumulative sleep restriction (5.2–5.8 hours/night).
    * Sol 143: Acute solar particle event (SPE) radiation spike (~9.0 mSv).
    * Sol 143–145: Autonomic strain response (HR +8..12 bpm, HRV -15..25 ms, mood dips to 2..3).
- Other Crew Profiles:
    * C001 (Cmdr A): Remains in green/stable zone throughout.
    * C003 (Cmdr C): Minor sleep dip, remains safe.
    * C004 (Cmdr D): Consistently optimal resilience.
- Every record must include provenance='SYNTHETIC'.
- Outputs to SQLite table `vitals`.
"""

import sys


def main() -> None:
    """Generates synthetic physiological vitals and writes to SQLite database."""
    print("TODO: Synthetic vitals generation logic will be implemented in Milestone Hours 2-8.")


if __name__ == "__main__":
    main()
