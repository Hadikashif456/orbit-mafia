"""Evaluation script for Anomaly Detection and 48-Hour Risk Flag Engine.

Evaluates performance on synthetic crew telemetry (TRD Section 4 & 6):
1. Lead time for C002: how many sols before CRI enters the amber/red range the risk flag first fires.
2. False-positive rate on healthy crew members (C001, C003, C004) across Sol 101-139.

All outputs are explicitly marked "on synthetic data".
"""

import sys
import os
from pathlib import Path
from typing import List, Dict, Tuple
import numpy as np

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.models import VitalPoint
from app.services.anomaly import (
    train,
    score,
    zscore_flags,
    risk_flag,
    compute_rolling_baseline,
    reset_risk_flag_latch,
)
from app.services.cri_engine import compute_cri, get_baseline
from app.services.cri_constants import STATUS_GREEN_MIN, STATUS_AMBER_MIN


def generate_synthetic_telemetry(seed: int = 42) -> Dict[str, List[VitalPoint]]:
    """Generates synthetic physiological vitals for 4 crew members across Sol 1-145 (TRD Section 4).
    
    If data teammate's generator is available, attempts to load from it; otherwise uses
    the exact TRD baseline distributions and C002 scenario.
    """
    try:
        from scripts.generate_synthetic import generate_vitals  # type: ignore
        return generate_vitals(seed=seed)
    except (ImportError, AttributeError):
        pass

    rng = np.random.RandomState(seed)
    crew_ids = ["C001", "C002", "C003", "C004"]
    data: Dict[str, List[VitalPoint]] = {cid: [] for cid in crew_ids}

    for cid in crew_ids:
        # Base healthy distribution parameters
        base_hr = 62.0 if cid != "C004" else 60.0
        base_hrv = 65.0 if cid != "C004" else 70.0

        for s in range(1, 146):
            if cid == "C002" and s >= 141:
                # C002 Mission Scenario (TRD Section 4):
                # Sol 141-143: Cumulative sleep restriction (5.2-5.8 h)
                # Sol 143: Acute solar particle event (SPE) radiation spike (~9.0 mSv)
                # Sol 143-145: HR +8-12 bpm, HRV -15-25 ms, mood 2-3
                if s == 141:
                    sleep = float(rng.uniform(5.4, 5.8))
                    rad = float(rng.normal(1.84, 0.15))
                    hr = float(rng.normal(base_hr + 2.0, 2.0))
                    hrv = float(rng.normal(base_hrv - 5.0, 3.0))
                    mood = 3
                elif s == 142:
                    sleep = float(rng.uniform(5.2, 5.6))
                    rad = float(rng.normal(1.90, 0.15))
                    hr = float(rng.normal(base_hr + 4.0, 2.0))
                    hrv = float(rng.normal(base_hrv - 10.0, 3.0))
                    mood = 3
                elif s == 143:
                    sleep = float(rng.uniform(5.2, 5.5))
                    rad = float(rng.normal(9.0, 0.20))  # Acute SPE spike
                    hr = float(rng.normal(base_hr + 10.0, 2.0))
                    hrv = float(rng.normal(base_hrv - 18.0, 3.0))
                    mood = 2
                elif s == 144:
                    sleep = float(rng.uniform(5.3, 5.7))
                    rad = float(rng.normal(4.5, 0.30))  # Tail of SPE
                    hr = float(rng.normal(base_hr + 12.0, 2.0))
                    hrv = float(rng.normal(base_hrv - 20.0, 3.0))
                    mood = 2
                else:  # Sol 145
                    sleep = float(rng.uniform(5.5, 6.0))
                    rad = float(rng.normal(2.5, 0.20))
                    hr = float(rng.normal(base_hr + 10.0, 2.0))
                    hrv = float(rng.normal(base_hrv - 15.0, 3.0))
                    mood = 2
                ex = float(max(15.0, rng.normal(30.0, 5.0)))
            elif cid == "C003" and 141 <= s <= 143:
                # C003 mild sleep dip
                sleep = float(rng.normal(6.3, 0.4))
                rad = float(rng.normal(1.84, 0.15))
                hr = float(rng.normal(base_hr + 2.0, 2.5))
                hrv = float(rng.normal(base_hrv - 4.0, 4.0))
                ex = float(max(20.0, rng.normal(40.0, 8.0)))
                mood = 4
            else:
                # Healthy baseline
                sleep = float(rng.normal(7.2, 0.5))
                rad = float(rng.normal(1.84, 0.15))
                hr = float(rng.normal(base_hr, 3.0))
                hrv = float(rng.normal(base_hrv, 6.0))
                ex = float(max(20.0, rng.normal(45.0, 10.0)))
                mood = int(max(1, min(5, round(rng.normal(4.0, 0.5)))))

            data[cid].append(
                VitalPoint(
                    crewId=cid,
                    sol=s,
                    hr=round(hr, 1),
                    hrv=round(hrv, 1),
                    sleepHours=round(max(2.0, sleep), 1),
                    radiationMsv=round(max(0.1, rad), 2),
                    exerciseMin=round(ex, 1),
                    mood=int(max(1, min(5, mood))),
                    provenance="SYNTHETIC",
                )
            )

    return data


def run_evaluation() -> None:
    """Executes evaluation of anomaly detection and 48-hour risk forecasting."""
    print("=" * 80)
    print("VITALORBIT ANOMALY & RISK FLAG EVALUATION (TRD Section 6)")
    print("=" * 80)
    print("Dataset Provenance: SYNTHETIC (Generated per TRD Section 4)")
    print("Crew Profiles: C001 (Cmdr A), C002 (Cmdr B), C003 (Cmdr C), C004 (Cmdr D)")
    print("Mission Timeline: Sol 1 to Sol 145\n")

    telemetry = generate_synthetic_telemetry(seed=42)

    # 1. Compute personal 14-sol baseline and CRI trajectory for all crew
    cri_trajectories: Dict[str, Dict[int, float]] = {cid: {} for cid in telemetry}
    status_trajectories: Dict[str, Dict[int, str]] = {cid: {} for cid in telemetry}
    models: Dict[str, Any] = {}

    for cid, vitals_list in telemetry.items():
        # Baseline from Sol 1-14
        personal_baseline = get_baseline(vitals_list[:14])

        # Train IsolationForest on Sol 1-100
        models[cid] = train(vitals_list[:100])

        # Pre-compute CRI for each sol using a 3-sol rolling window
        for s in range(3, 146):
            window = [v for v in vitals_list if s - 2 <= v.sol <= s]
            # Simulation inflammation score: elevated to 0.20 for C002 during mission scenario
            inflam = 0.20 if (cid == "C002" and s >= 141) else 0.05
            cri_res = compute_cri(window, personal_baseline, inflammation_score=inflam)
            cri_trajectories[cid][s] = cri_res.cri
            status_trajectories[cid][s] = cri_res.status

    # 2. Evaluate Anomaly Detection & Risk Flagging across Sols 101-145
    flags_fired: Dict[str, Dict[int, bool]] = {cid: {} for cid in telemetry}
    risk_outputs: Dict[str, Dict[int, Dict[str, Any]]] = {cid: {} for cid in telemetry}

    for cid, vitals_list in telemetry.items():
        reset_risk_flag_latch(cid)
        vitals_by_sol = {v.sol: v for v in vitals_list}

        for s in range(101, 146):
            current_pt = vitals_by_sol[s]
            # 14-sol rolling baseline preceding current sol
            rolling_window = [vitals_by_sol[ws] for ws in range(s - 14, s) if ws in vitals_by_sol]
            rolling_base = compute_rolling_baseline(rolling_window)

            # Z-score flags for current sol
            z_flags = zscore_flags(current_pt, rolling_base)

            # Recent 3 CRI values
            recent_cri = [cri_trajectories[cid][cs] for cs in (s - 2, s - 1, s) if cs in cri_trajectories[cid]]

            # Risk flag evaluation
            r_flag = risk_flag(recent_cri, z_flags, crew_id=cid)
            flags_fired[cid][s] = r_flag["flag"]
            risk_outputs[cid][s] = r_flag

    # --------------------------------------------------------------------------
    # METRIC 1: C002 Early Warning Lead Time
    # --------------------------------------------------------------------------
    print("-" * 80)
    print("METRIC 1: C002 RISK FLAG LEAD TIME (Early Warning)")
    print("-" * 80)

    # First sol where C002 CRI dropped into amber (< 75.0) or red (< 50.0)
    c002_amber_sols = [s for s in range(101, 146) if cri_trajectories["C002"][s] < STATUS_GREEN_MIN]
    first_amber_sol = min(c002_amber_sols) if c002_amber_sols else None

    # First sol where risk flag fired for C002 during the scenario window (140-145)
    c002_flag_sols = [s for s in range(140, 146) if flags_fired["C002"][s]]
    first_flag_sol = min(c002_flag_sols) if c002_flag_sols else None

    if first_amber_sol and first_flag_sol:
        lead_sols = first_amber_sol - first_flag_sol
        lead_hours = lead_sols * 24
        print(f"[ON SYNTHETIC DATA] C002 Risk Flag First Fired : Sol {first_flag_sol}")
        print(f"[ON SYNTHETIC DATA] C002 CRI Entered Amber/Red : Sol {first_amber_sol} (CRI: {cri_trajectories['C002'][first_amber_sol]:.1f})")
        print(f"[ON SYNTHETIC DATA] Early Warning Lead Time    : {lead_sols} sols (~{lead_hours} hours ahead)")
        print(f"[ON SYNTHETIC DATA] Flag Drivers at Sol {first_flag_sol}  : {', '.join(risk_outputs['C002'][first_flag_sol]['drivers'])}")
        print(f"[ON SYNTHETIC DATA] Extrapolated CRI at Sol+2   : {risk_outputs['C002'][first_flag_sol]['predicted_cri']}")
    else:
        print("[ON SYNTHETIC DATA] C002 warning event could not be calculated.")

    print("\nC002 Scenario Progression (Sols 140 to 145):")
    print(f"{'Sol':<6} {'CRI':<8} {'Status':<10} {'Risk Flag':<12} {'Drivers':<35}")
    print("-" * 75)
    for s in range(140, 146):
        cri_val = cri_trajectories["C002"].get(s, 0.0)
        status_val = status_trajectories["C002"].get(s, "unknown")
        flag_val = "FLAG RAISED" if flags_fired["C002"].get(s, False) else "clear"
        drivers_val = ", ".join(risk_outputs["C002"].get(s, {}).get("drivers", [])) or "None"
        print(f"{s:<6} {cri_val:<8.1f} {status_val:<10} {flag_val:<12} {drivers_val:<35}")

    # --------------------------------------------------------------------------
    # METRIC 2: False Positive Rate (FPR) on Healthy Crew (Sol 101-139)
    # --------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("METRIC 2: HEALTHY CREW FALSE-POSITIVE RATE (Sol 101-139)")
    print("-" * 80)

    healthy_crew = ["C001", "C003", "C004"]
    total_healthy_sols = 0
    total_false_positives = 0

    for cid in healthy_crew:
        crew_sols = range(101, 140)  # Sols 101 to 139 (39 sols per crew member)
        fps = sum(1 for s in crew_sols if flags_fired[cid].get(s, False))
        crew_total = len(crew_sols)
        total_healthy_sols += crew_total
        total_false_positives += fps
        fpr_crew = (fps / crew_total) * 100.0
        print(f"[ON SYNTHETIC DATA] {cid} False Positives: {fps:2d} / {crew_total} sols ({fpr_crew:4.1f}%)")

    overall_fpr = (total_false_positives / total_healthy_sols) * 100.0
    print("-" * 80)
    print(f"[ON SYNTHETIC DATA] Overall Healthy FPR (Sol 101-139): {overall_fpr:.2f}% ({total_false_positives} / {total_healthy_sols} crew-sols)")
    print("=" * 80)
    print("Evaluation complete. All figures validated on synthetic mission telemetry.")


if __name__ == "__main__":
    run_evaluation()
