import { z } from 'zod';

export const ProvenanceEnum = z.enum(['SYNTHETIC', 'REAL_OSDR', 'CURATED']);

export const StatusEnum = z.enum(['green', 'amber', 'red']);

export const CrewSummarySchema = z.object({
  id: z.string().regex(/^C00[1-4]$/),
  callsign: z.string(),
  cri: z.number(),
  status: StatusEnum,
  topDriver: z.string(),
  sparkline: z.array(z.number()),
  provenance: ProvenanceEnum.default('SYNTHETIC'),
}).strict();

export const VitalPointSchema = z.object({
  crewId: z.string().regex(/^C00[1-4]$/),
  sol: z.number().int().min(1).max(200),
  hr: z.number(),
  hrv: z.number(),
  sleepHours: z.number(),
  radiationMsv: z.number(),
  exerciseMin: z.number(),
  mood: z.number().int().min(1).max(5),
  provenance: ProvenanceEnum.default('SYNTHETIC'),
}).strict();

export const CRIContributionsSchema = z.object({
  radiation: z.number(),
  sleep: z.number(),
  cardio: z.number(),
  mood: z.number(),
  inflammation: z.number(),
}).strict();

export const CRIWeightsSchema = z.object({
  radiation: z.number(),
  sleep: z.number(),
  cardio: z.number(),
  mood: z.number(),
  inflammation: z.number(),
}).strict();

export const CRIResultSchema = z.object({
  crewId: z.string().regex(/^C00[1-4]$/),
  sol: z.number().int().min(1).max(200),
  cri: z.number(),
  status: StatusEnum,
  contributions: CRIContributionsSchema,
  weights: CRIWeightsSchema,
  formulaVersion: z.string().default('v1'),
  provenance: z.string(),
}).strict();

export const AlertSchema = z.object({
  id: z.string(),
  crewId: z.string().regex(/^C00[1-4]$/),
  severity: z.enum(['watch', 'warning', 'critical']),
  criFrom: z.number(),
  criTo: z.number(),
  drivers: z.array(z.string()),
  predictedWindowHours: z.number().default(48),
  message: z.string(),
  provenance: ProvenanceEnum.default('SYNTHETIC'),
}).strict();

export const BiomarkerSchema = z.object({
  crewId: z.string().regex(/^C00[1-4]$/),
  timepoint: z.string(),
  panel: z.string(),
  name: z.string(),
  value: z.number(),
  unit: z.string(),
  refMin: z.number().nullable().optional(),
  refMax: z.number().nullable().optional(),
  provenance: ProvenanceEnum.default('REAL_OSDR'),
}).strict();

export const SuggestedActionSchema = z.object({
  title: z.string(),
  protocol: z.string(),
  source: z.string(),
}).strict();

export const CopilotResponseSchema = z.object({
  summary: z.string(),
  drivers: z.array(z.string()),
  suggestedActions: z.array(SuggestedActionSchema),
  disclaimer: z.string(),
  groundedIn: z.array(z.string()),
  mode: z.enum(['live', 'cached']).default('cached'),
}).strict();

export const ScenarioEventSchema = z.object({
  sol: z.number().int(),
  crewId: z.string().nullable().optional(),
  type: z.string(),
  text: z.string(),
  magnitude: z.number().nullable().optional(),
}).strict();

export const ScenarioStateSchema = z.object({
  sol: z.number().int(),
  crew: z.array(CrewSummarySchema),
  alerts: z.array(AlertSchema),
  events: z.array(ScenarioEventSchema),
}).strict();

export const TrendPointSchema = z.object({
  sol: z.number().int(),
  cri: z.number(),
  status: StatusEnum,
}).strict();

export const ProvenanceDatasetSchema = z.object({
  id: z.string(),
  title: z.string(),
  citation: z.string(),
  accessDate: z.string(),
  provenance: ProvenanceEnum,
}).strict();

export const ProvenanceResponseSchema = z.object({
  datasets: z.array(ProvenanceDatasetSchema),
  syntheticFields: z.array(z.string()),
  replayNote: z.string(),
  policy: z.string(),
}).strict();

