import { z } from 'zod';
import { apiClient } from './client';
import {
  CrewSummarySchema,
  CRIResultSchema,
  TrendPointSchema,
  VitalPointSchema,
  BiomarkerSchema,
  ScenarioStateSchema,
  CopilotResponseSchema,
  ProvenanceResponseSchema,
} from './schemas';
import type {
  CrewSummary,
  CRIResult,
  TrendPoint,
  VitalPoint,
  Biomarker,
  ScenarioState,
  CopilotRequest,
  CopilotResponse,
  ProvenanceResponse,
} from './types';

export async function getCrew(sol?: number): Promise<CrewSummary[]> {
  const query = sol !== undefined ? `?sol=${sol}` : '';
  return apiClient(`/crew${query}`, z.array(CrewSummarySchema));
}

export async function getCri(id: string, sol?: number): Promise<CRIResult> {
  const query = sol !== undefined ? `?sol=${sol}` : '';
  return apiClient(`/crew/${id}/cri${query}`, CRIResultSchema);
}

export async function getCriRange(
  id: string,
  fromSol: number,
  toSol: number
): Promise<CRIResult[]> {
  return apiClient(
    `/crew/${id}/cri/range?from=${fromSol}&to=${toSol}`,
    z.array(CRIResultSchema)
  );
}

export async function getTrend(
  id: string,
  window: 7 | 30 = 7,
  sol?: number
): Promise<TrendPoint[]> {
  const solParam = sol !== undefined ? `&sol=${sol}` : '';
  return apiClient(`/crew/${id}/trend?window=${window}${solParam}`, z.array(TrendPointSchema));
}

export async function getVitals(
  id: string,
  window: 7 | 30 = 7,
  sol?: number
): Promise<VitalPoint[]> {
  const solParam = sol !== undefined ? `&sol=${sol}` : '';
  return apiClient(`/crew/${id}/vitals?window=${window}${solParam}`, z.array(VitalPointSchema));
}

export async function getBiomarkers(
  id: string,
  names?: string[],
  panel?: string
): Promise<Biomarker[]> {
  const params = new URLSearchParams();
  if (names && names.length > 0) {
    params.set('names', names.join(','));
  }
  if (panel) {
    params.set('panel', panel);
  }
  const queryStr = params.toString();
  const query = queryStr ? `?${queryStr}` : '';
  return apiClient(`/crew/${id}/biomarkers${query}`, z.array(BiomarkerSchema));
}

export async function getScenario(sol: number): Promise<ScenarioState> {
  return apiClient(`/scenario/state?sol=${sol}`, ScenarioStateSchema);
}

export async function explainRisk(payload: { crewId: string; sol: number }): Promise<CopilotResponse> {
  const body: CopilotRequest = {
    crewId: payload.crewId,
    sol: payload.sol,
  };
  return apiClient('/copilot/explain', CopilotResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getProvenance(): Promise<ProvenanceResponse> {
  return apiClient('/provenance', ProvenanceResponseSchema);
}
