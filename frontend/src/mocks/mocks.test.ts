import { describe, it, expect } from 'vitest';
import crewData from './crew.json';
import vitalsData from './vitals_C001.json';
import scenarioData from './scenario.json';
import biomarkersData from './biomarkers_C001.json';
import copilotData from './copilot_cached.json';
import {
  CrewSummarySchema,
  VitalPointSchema,
  ScenarioStateSchema,
  BiomarkerSchema,
  CopilotResponseSchema,
} from '../api/schemas';
import { z } from 'zod';

describe('Mock Data Validation', () => {
  it('validates crew.json matches CrewSummarySchema', () => {
    const parsed = z.array(CrewSummarySchema).safeParse(crewData);
    expect(parsed.success).toBe(true);
  });

  it('validates vitals_C001.json matches VitalPointSchema', () => {
    const parsed = z.array(VitalPointSchema).safeParse(vitalsData);
    expect(parsed.success).toBe(true);
  });

  it('validates scenario.json matches ScenarioStateSchema', () => {
    const parsed = ScenarioStateSchema.safeParse(scenarioData);
    expect(parsed.success).toBe(true);
  });

  it('validates biomarkers_C001.json matches BiomarkerSchema', () => {
    const parsed = z.array(BiomarkerSchema).safeParse(biomarkersData);
    expect(parsed.success).toBe(true);
  });

  it('validates copilot_cached.json matches CopilotResponseSchema', () => {
    const parsed = CopilotResponseSchema.safeParse(copilotData);
    expect(parsed.success).toBe(true);
  });
});
