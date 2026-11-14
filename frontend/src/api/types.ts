import { z } from 'zod';
import {
  CrewSummarySchema,
  VitalPointSchema,
  CRIResultSchema,
  AlertSchema,
  BiomarkerSchema,
  CopilotResponseSchema,
  ScenarioStateSchema,
  ScenarioEventSchema,
  SuggestedActionSchema,
  ProvenanceEnum,
  StatusEnum,
} from './schemas';

export type Provenance = z.infer<typeof ProvenanceEnum>;
export type Status = z.infer<typeof StatusEnum>;
export type CrewSummary = z.infer<typeof CrewSummarySchema>;
export type VitalPoint = z.infer<typeof VitalPointSchema>;
export type CRIResult = z.infer<typeof CRIResultSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type Biomarker = z.infer<typeof BiomarkerSchema>;
export type SuggestedAction = z.infer<typeof SuggestedActionSchema>;
export type CopilotResponse = z.infer<typeof CopilotResponseSchema>;
export type ScenarioEvent = z.infer<typeof ScenarioEventSchema>;
export type ScenarioState = z.infer<typeof ScenarioStateSchema>;

export interface CopilotRequest {
  crewId: string;
  sol: number;
}
