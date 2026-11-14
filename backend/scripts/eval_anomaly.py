"""Evaluation script for Anomaly Detection and 48-Hour Risk Flag Engine.

Evaluates performance on synthetic crew telemetry served via data_access (TRD Section 4 & 6):
1. Lead time for C002: how many sols before CRI enters the amber/red range the risk flag first fires.
2. False-positive rate on healthy crew members (C001, C003, C004) across Sol 101-139.

All outputs are explicitly marked "[ON SYNTHETIC DATA]".
"""

import sys
import os
from pathlib import Path
from typing import List, Dict, Tuple, Any

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.models import VitalPoint
from app.services.data_access import get_vitals_history, get_biomarkers
from app.services.anomaly import (
    train,
    score,
    zscore_flags,
    risk_flag,
    compute_rolling_baseline,
    reset_risk_flag_latch,
)
from app.services.cri_engine import compute_cri, get_baseline, compute_inflammation_score
from app.services.cri_constants import STATUS_GREEN_MIN, STATUS_AMBER_MIN


def load_telemetry() -> Dict[str, List[VitalPoint]]:
    """Loads physiological vitals for 4 crew members across Sol 1-145 directly from data_access."""
    crew_ids = ["C001", "C002", "C003", "C004"]
    return {cid: get_vitals_history(cid, sol=145, window=145) for cid in crew_ids}


def generate_synthetic_telemetry(seed: int = 42) -> Dict[str, List[VitalPoint]]:
    """Backwards-compatible wrapper returning data_access telemetry."""
    return load_telemetry()


def run_evaluation() -> None:
    """Executes evaluation of anomaly detection and 48-hour risk forecasting."""
    print("=" * 80)
    print("ORBIT MAFIA ANOMALY & RISK FLAG EVALUATION (TRD Section 6)")
    print("=" * 80)
    print("Dataset Provenance: SYNTHETIC (Loaded via app.services.data_access)")
    print("Crew Profiles: C001 (Cmdr A), C002 (Cmdr B), C003 (Cmdr C), C004 (Cmdr D)")
    print("Mission Timeline: Sol 1 to Sol 145\n")

    telemetry = load_telemetry()

    # 1. Compute personal 14-sol baseline, inflammation, and CRI trajectory for all crew
    cri_trajectories: Dict[str, Dict[int, float]] = {cid: {} for cid in telemetry}
    contrib_trajectories: Dict[str, Dict[int, Dict[str, float]]] = {cid: {} for cid in telemetry}
    status_trajectories: Dict[str, Dict[int, str]] = {cid: {} for cid in telemetry}
    models: Dict[str, Any] = {}

    for cid, vitals_list in telemetry.items():
        # Baseline from Sol 1-14
        personal_baseline = get_baseline(vitals_list[:14])

        # Train IsolationForest on Sol 1-100
        models[cid] = train(vitals_list[:100])

        # Calculate personal inflammation score from NASA OSDR biomarker data
        inflam = compute_inflammation_score(get_biomarkers(cid))

        # Pre-compute CRI for each sol using a 3-sol rolling window
        for s in range(3, 146):
            window = [v for v in vitals_list if s - 2 <= v.sol <= s]
            cri_res = compute_cri(
                vitals_window=window,
                baseline=personal_baseline,
                inflammation_score=inflam,
                crew_id=cid,
                sol=s,
            )
            cri_trajectories[cid][s] = cri_res.cri
            contrib_trajectories[cid][s] = cri_res.contributions
            status_trajectories[cid][s] = cri_res.status

    # 2. Evaluate Anomaly Detection & Risk Flagging across Sols 101-145 with latch history
    flags_fired: Dict[str, Dict[int, bool]] = {cid: {} for cid in telemetry}
    risk_outputs: Dict[str, Dict[int, Dict[str, Any]]] = {cid: {} for cid in telemetry}

    for cid, vitals_list in telemetry.items():
        vitals_by_sol = {v.sol: v for v in vitals_list}
        history_records: List[Dict[str, Any]] = []

        for s in range(101, 146):
            current_pt = vitals_by_sol[s]
            # 14-sol rolling baseline preceding current sol
            rolling_window = [vitals_by_sol[ws] for ws in range(s - 14, s) if ws in vitals_by_sol]
            rolling_base = compute_rolling_baseline(rolling_window)

            # Z-score flags for current sol
            z_flags = zscore_flags(current_pt, rolling_base)

            # Recent 3 CRI values
            recent_cri = [cri_trajectories[cid][cs] for cs in (s - 2, s - 1, s) if cs in cri_trajectories[cid]]

            # Risk flag evaluation with chronological history passing
            r_flag = risk_flag(
                cri_history=recent_cri,
                anomaly_flags=z_flags,
                contributions=contrib_trajectories[cid][s],
                crew_id=cid,
                history=history_records,
                sol=s,
            )
            flags_fired[cid][s] = r_flag["flag"]
            risk_outputs[cid][s] = r_flag

            history_records.append({
                "sol": s,
                "cri": cri_trajectories[cid][s],
                "cri_history": recent_cri,
                "anomaly_flags": z_flags,
                "contributions": contrib_trajectories[cid][s],
            })

    # --------------------------------------------------------------------------
    # METRIC 1: C002 Early Warning Lead Time
    # --------------------------------------------------------------------------
    print("-" * 80)
    print("METRIC 1: C002 RISK FLAG LEAD TIME (Early Warning)")
    print("-" * 80)

    # First sol where C002 CRI dropped into amber (< 75.0) or red (< 50.0)
    c002_amber_sols = [s for s in range(101, 146) if cri_trajectories["C002"][s] < STATUS_GREEN_MIN]
    first_amber_sol = min(c002_amber_sols) if c002_amber_sols else None

    # First sol where risk flag fired for C002 during the scenario window (139-145)
    c002_flag_sols = [s for s in range(139, 146) if flags_fired["C002"][s]]
    first_flag_sol = min(c002_flag_sols) if c002_flag_sols else None

    # First sol where C002 CRI dropped under 60
    c002_under_60_sols = [s for s in range(101, 146) if cri_trajectories["C002"][s] < 60.0]
    first_under_60_sol = min(c002_under_60_sols) if c002_under_60_sols else None

    if first_amber_sol and first_flag_sol:
        lead_sols = first_amber_sol - first_flag_sol
        lead_hours = lead_sols * 24
        print(f"[ON SYNTHETIC DATA] C002 Risk Flag First Fired : Sol {first_flag_sol}")
        print(f"[ON SYNTHETIC DATA] C002 CRI Entered Amber     : Sol {first_amber_sol} (CRI: {cri_trajectories['C002'][first_amber_sol]:.1f})")
        if first_under_60_sol:
            lead_under_60 = first_under_60_sol - first_flag_sol
            print(f"[ON SYNTHETIC DATA] C002 CRI Dropped Under 60  : Sol {first_under_60_sol} (CRI: {cri_trajectories['C002'][first_under_60_sol]:.1f})")
            print(f"[ON SYNTHETIC DATA] Early Warning vs Under 60  : {lead_under_60} sols (~{lead_under_60 * 24} hours ahead)")
        print(f"[ON SYNTHETIC DATA] Early Warning Lead Time    : {lead_sols} sols (~{lead_hours} hours ahead of amber)")
        print(f"[ON SYNTHETIC DATA] Flag Drivers at Sol {first_flag_sol}  : {', '.join(risk_outputs['C002'][first_flag_sol]['drivers'])}")
        print(f"[ON SYNTHETIC DATA] Extrapolated CRI at Sol+2   : {risk_outputs['C002'][first_flag_sol]['predicted_cri']}")
    else:
        print("[ON SYNTHETIC DATA] C002 warning event could not be calculated.")

    print("\n[ON SYNTHETIC DATA] C002 Scenario Progression (Sols 139 to 145):")
    print(f"{'Sol':<6} {'CRI':<8} {'Status':<10} {'Risk Flag':<14} {'Drivers':<35}")
    print("-" * 75)
    for s in range(139, 146):
        cri_val = cri_trajectories["C002"].get(s, 0.0)
        status_val = status_trajectories["C002"].get(s, "unknown")
        flag_val = "FLAG RAISED" if flags_fired["C002"].get(s, False) else "clear"
        drivers_val = ", ".join(risk_outputs["C002"].get(s, {}).get("drivers", [])) or "None"
        print(f"{s:<6} {cri_val:<8.1f} {status_val:<10} {flag_val:<14} {drivers_val:<35}")

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

    overall_fpr = (total_false_positives / total_healthy_sols) * 100.0 if total_healthy_sols > 0 else 0.0
    print("-" * 80)
    print(f"[ON SYNTHETIC DATA] Overall Healthy FPR (Sol 101-139): {overall_fpr:.2f}% ({total_false_positives} / {total_healthy_sols} crew-sols)")
    print("=" * 80)
    print("[ON SYNTHETIC DATA] Evaluation complete. All figures validated on synthetic mission telemetry.")


if __name__ == "__main__":
    run_evaluation()
