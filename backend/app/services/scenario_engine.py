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

    for cid in CREW_IDS:
        callsign = CALLSIGNS.get(cid, f"Cmdr {cid}")
        current_cri_res = compute_cri_for(cid, sol)
        sparkline = cri_series(cid, sol, n=5)
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
            prev_sol = max(1, sol - 1)
            prev_cri_res = compute_cri_for(cid, prev_sol)
            cri_from = prev_cri_res.cri
            cri_to = current_cri_res.cri

            if current_cri_res.cri < 50.0 or current_cri_res.status == "red":
                severity = "critical"
            elif current_cri_res.cri < 60.0 or (cri_from - cri_to) >= 10.0:
                severity = "warning"
            else:
                severity = "watch"

            # Compute anomaly flags and risk_flag drivers
            vitals_history = get_vitals_history(cid, sol, window=14)
            rolling_window = [v for v in vitals_history if sol - 14 <= v.sol < sol]
            rolling_base = compute_rolling_baseline(rolling_window if rolling_window else vitals_history)
            current_pts = [v for v in vitals_history if v.sol == sol]
            current_pt = current_pts[-1] if current_pts else vitals_history[-1]
            z_flags = zscore_flags(current_pt, rolling_base)

            recent_cri_vals = [
                compute_cri_for(cid, s).cri
                for s in (max(1, sol - 2), max(1, sol - 1), sol)
            ]
            r_flag = risk_flag(
                cri_history=recent_cri_vals,
                anomaly_flags=z_flags,
                contributions=current_cri_res.contributions,
                crew_id=cid,
                sol=sol,
            )

            flag_drivers = r_flag.get("drivers", [])
            if not flag_drivers:
                flag_drivers = [top_driver] if top_driver != "Baseline stable" else ["Physiological strain"]

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
