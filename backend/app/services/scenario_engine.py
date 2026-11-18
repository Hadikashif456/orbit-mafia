"""Scenario engine for mission timeline replay (Sol 140–145).

Builds deterministic mission state snapshots containing crew summaries, active alerts,
and scheduled solar/mission events computed directly from crew_service, data_access, and anomaly.
"""

from typing import List
from app.models import (
    ScenarioStateResponse,
    CrewSummary,
    Alert,
    ScenarioEvent,
)
from app.services.crew_service import (
    CALLSIGNS,
    DRIVER_LABELS,
    compute_cri_for,
    cri_series,
    top_driver_label,
)
from app.services.data_access import get_vitals_history
from app.services.anomaly import risk_flag, zscore_flags, compute_rolling_baseline

CREW_IDS: List[str] = ["C001", "C002", "C003", "C004"]


def get_scenario_state(sol: int) -> ScenarioStateResponse:
    """Builds deterministic mission state for Sol 140–145.

    Returns:
    - All 4 crew members with CRI, status, topDriver, sparkline from crew_service.
    - Alerts for non-green (amber or red) crew members.
    - Scripted timeline events up to the requested sol with real magnitude taken from data.
    """
    if sol < 140 or sol > 145:
        raise ValueError(f"Scenario sol must be between 140 and 145 inclusive, got {sol}")

    crew_summaries: List[CrewSummary] = []
    alerts: List[Alert] = []
    cri_cache = {}

    def _cri(c_id: str, s_val: int):
        key = (c_id, s_val)
        if key not in cri_cache:
            cri_cache[key] = compute_cri_for(c_id, s_val)
        return cri_cache[key]

    for cid in CREW_IDS:
        callsign = CALLSIGNS.get(cid, f"Cmdr {cid}")
        spark_start = max(1, sol - 4)
        for s_val in range(spark_start, sol + 1):
            _cri(cid, s_val)
        current_cri_res = _cri(cid, sol)
        sparkline = [_cri(cid, s_val).cri for s_val in range(spark_start, sol + 1)]
        top_driver = top_driver_label(current_cri_res)

        crew_summaries.append(
            CrewSummary(
                id=cid,
                callsign=callsign,
                cri=current_cri_res.cri,
                status=current_cri_res.status,
                topDriver=top_driver,
                sparkline=sparkline,
                provenance="SYNTHETIC",
            )
        )

        # Alerts only for non-green (amber or red) crew members
        if current_cri_res.status in ("amber", "red"):
            # criFrom = the HIGHEST CRI among the 3 sols BEFORE the current sol (e.g. Sol 144 -> max of Sol 141-143 = 86.6)
            sols_before = list(range(max(1, sol - 3), sol))
            cri_from = max(_cri(cid, s).cri for s in sols_before) if sols_before else current_cri_res.cri
            cri_to = current_cri_res.cri

            # Initial severity determination
            sev_rank = {"watch": 1, "warning": 2, "critical": 3}
            rank_to_sev = {1: "watch", 2: "warning", 3: "critical"}

            if current_cri_res.cri < 50.0 or current_cri_res.status == "red":
                cur_rank = 3
            elif current_cri_res.cri < 60.0 or (cri_from - cri_to) >= 10.0:
                cur_rank = 2
            else:
                cur_rank = 1

            # Severity must never go down while the risk flag stays raised and CRI is falling (no warning -> watch -> warning flip)
            for s_prev in range(max(140, sol - 1), sol):
                prev_cri = _cri(cid, s_prev).cri
                if prev_cri >= current_cri_res.cri:
                    prev_sols_before = list(range(max(1, s_prev - 3), s_prev))
                    prev_from = max(_cri(cid, s).cri for s in prev_sols_before) if prev_sols_before else prev_cri
                    if prev_cri < 50.0:
                        p_sev = 3
                    elif prev_cri < 60.0 or (prev_from - prev_cri) >= 10.0:
                        p_sev = 2
                    else:
                        p_sev = 1
                    if p_sev > cur_rank:
                        cur_rank = p_sev

            severity = rank_to_sev[cur_rank]

            # Compute anomaly flags and risk_flag drivers
            vitals_history = get_vitals_history(cid, sol, window=14)
            rolling_window = [v for v in vitals_history if sol - 14 <= v.sol < sol]
            rolling_base = compute_rolling_baseline(rolling_window if rolling_window else vitals_history)
            current_pts = [v for v in vitals_history if v.sol == sol]
            current_pt = current_pts[-1] if current_pts else vitals_history[-1]
            z_flags = zscore_flags(current_pt, rolling_base)

            recent_cri_vals = [
                _cri(cid, s).cri
                for s in (max(1, sol - 2), max(1, sol - 1), sol)
            ]
            r_flag = risk_flag(
                cri_history=recent_cri_vals,
                anomaly_flags=z_flags,
                contributions=current_cri_res.contributions,
                crew_id=cid,
                sol=sol,
            )

            # Use the same driver labels as crew_service.top_driver_label ("Cardiovascular strain", never "Cardio")
            flag_drivers = []
            sorted_contribs = sorted(current_cri_res.contributions.items(), key=lambda x: x[1], reverse=True)
            for term, points in sorted_contribs:
                if points >= 5.0 and term in DRIVER_LABELS:
                    flag_drivers.append(DRIVER_LABELS[term])
            if not flag_drivers:
                top_lbl = top_driver_label(current_cri_res)
                flag_drivers = [top_lbl] if top_lbl != "Baseline stable" else ["Cardiovascular strain"]

            pred_window = r_flag.get("predictedWindowHours", 48)

            alerts.append(
                Alert(
                    id=f"alt-{sol}-{cid.lower()}",
                    crewId=cid,
                    severity=severity,
                    criFrom=cri_from,
                    criTo=cri_to,
                    drivers=flag_drivers,
                    predictedWindowHours=pred_window,
                    message=f"CRI drop detected for {cid} following mission stressors.",
                    provenance="SYNTHETIC",
                )
            )

    # Extract SPE radiation magnitude from data for C002 at Sol 143
    c002_vitals_143 = [v for v in get_vitals_history("C002", 143, window=1) if v.sol == 143]
    spe_magnitude = round(c002_vitals_143[-1].radiationMsv, 1) if c002_vitals_143 else 9.0

    # Scripted scenario events filtered by sol <= requested sol
    scripted_events: List[ScenarioEvent] = [
        ScenarioEvent(
            sol=141,
            crewId="C002",
            type="SLEEP_DISRUPTION",
            text="Sleep disruption begins (C002)",
        ),
        ScenarioEvent(
            sol=143,
            crewId="C002",
            type="RADIATION_SPIKE",
            text="Solar particle event detected: radiation spike",
            magnitude=spe_magnitude,
        ),
        ScenarioEvent(
            sol=144,
            crewId="C002",
            type="CRI_DROP",
            text="CRI drop detected for C002",
        ),
        ScenarioEvent(
            sol=144,
            crewId="C002",
            type="COPILOT_RECOMMENDATION",
            text="Copilot recommendation issued",
        ),
    ]

    filtered_events = [e for e in scripted_events if e.sol <= sol]

    return ScenarioStateResponse(
        sol=sol,
        crew=crew_summaries,
        alerts=alerts,
        events=filtered_events,
    )
