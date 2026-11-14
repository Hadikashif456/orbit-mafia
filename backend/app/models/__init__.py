"""Pydantic v2 domain and response models with extra="forbid" enforcement."""

from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class BaseStrictModel(BaseModel):
    """Base model forbidding all unknown extra fields."""
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ErrorDetail(BaseStrictModel):
    code: str
    message: str


class ErrorResponse(BaseStrictModel):
    error: ErrorDetail


class CrewSummary(BaseStrictModel):
    id: str = Field(..., pattern=r"^C00[1-4]$")
    callsign: str
    cri: float
    status: Literal["green", "amber", "red"]
    topDriver: str
    sparkline: List[float]
    provenance: Literal["SYNTHETIC", "REAL_OSDR", "CURATED"] = "SYNTHETIC"


class VitalPoint(BaseStrictModel):
    crewId: str = Field(..., pattern=r"^C00[1-4]$")
    sol: int = Field(..., ge=1, le=200)
    hr: float
    hrv: float
    sleepHours: float
    radiationMsv: float
    exerciseMin: float
    mood: int = Field(..., ge=1, le=5)
    provenance: Literal["SYNTHETIC", "REAL_OSDR", "CURATED"] = "SYNTHETIC"


class CRIResult(BaseStrictModel):
    crewId: str = Field(..., pattern=r"^C00[1-4]$")
    sol: int = Field(..., ge=1, le=200)
    cri: float
    status: Literal["green", "amber", "red"]
    contributions: Dict[str, float]
    weights: Dict[str, float]
    formulaVersion: str = "v1"
    provenance: str = "SYNTHETIC+REAL_OSDR"


class Alert(BaseStrictModel):
    id: str
    crewId: str = Field(..., pattern=r"^C00[1-4]$")
    severity: Literal["watch", "warning", "critical"]
    criFrom: float
    criTo: float
    drivers: List[str]
    predictedWindowHours: int = 48
    message: str
    provenance: Literal["SYNTHETIC", "REAL_OSDR", "CURATED"] = "SYNTHETIC"


class Biomarker(BaseStrictModel):
    crewId: str = Field(..., pattern=r"^C00[1-4]$")
    timepoint: str
    panel: str
    name: str
    value: float
    unit: str
    refMin: Optional[float] = None
    refMax: Optional[float] = None
    provenance: Literal["SYNTHETIC", "REAL_OSDR", "CURATED"] = "REAL_OSDR"


class CopilotRequest(BaseStrictModel):
    crewId: str = Field(..., pattern=r"^C00[1-4]$")
    sol: int = Field(..., ge=1, le=200)


class SuggestedAction(BaseStrictModel):
    title: str
    protocol: str
    source: str


class CopilotResponse(BaseStrictModel):
    summary: str
    drivers: List[str]
    suggestedActions: List[SuggestedAction]
    disclaimer: str = "Risk flags and suggested countermeasures only. Not a medical diagnosis."
    groundedIn: List[str]
    mode: Literal["live", "cached"] = "cached"


class ScenarioEvent(BaseStrictModel):
    sol: int
    crewId: Optional[str] = None
    type: str
    text: str
    magnitude: Optional[float] = None


class ScenarioStateResponse(BaseStrictModel):
    sol: int
    crew: List[CrewSummary]
    alerts: List[Alert]
    events: List[ScenarioEvent]


class ProvenanceDataset(BaseStrictModel):
    id: str
    title: str
    citation: str
    accessDate: str
    provenance: Literal["REAL_OSDR", "SYNTHETIC", "CURATED"]


class ProvenanceResponse(BaseStrictModel):
    datasets: List[ProvenanceDataset]
    syntheticFields: List[str]
    replayNote: str
    policy: str
