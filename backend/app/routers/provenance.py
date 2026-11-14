"""Provenance router disclosing data origins, synthetic series, and NASA OSDR citations."""

from fastapi import APIRouter
from app.models import ProvenanceResponse, ProvenanceDataset

router = APIRouter(prefix="/provenance", tags=["Provenance"])


@router.get("", response_model=ProvenanceResponse)
def get_provenance() -> ProvenanceResponse:
    """Disclose data sources, synthetic fields, citations, and replay methodology."""
    return ProvenanceResponse(
        datasets=[
            ProvenanceDataset(
                id="OSD-575 / LSDS-8",
                title="NASA GeneLab / OSDR Astronaut Omics & Biomarker Dataset",
                citation="NASA Open Science Data Repository (OSDR) OSD-575",
                accessDate="2026-11-14",
                provenance="REAL_OSDR",
            )
        ],
        syntheticFields=[
            "vitals.hr",
            "vitals.hrv",
            "vitals.sleep_hours",
            "vitals.radiation_msv",
            "vitals.exercise_min",
            "vitals.mood",
        ],
        replayNote="The demo replays real NASA OSDR biomarker timepoints (L-92..R+194) against the synthetic Mars-transit timeline (Sol 1-145) for illustration purposes.",
        policy="Risk flags and suggested countermeasures only. The words 'diagnose', 'detects disease', and 'treats' are strictly forbidden.",
    )
