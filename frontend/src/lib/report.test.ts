import { describe, it, expect } from 'vitest';
import {
  filterScenarioEventsUpToSol,
  filterAlertsForCrew,
  buildIncidentReportData,
} from './report';
import type { ScenarioEvent, Alert, CRIResult } from '../api/types';

describe('Printable Incident Report helpers', () => {
  const mockEvents: ScenarioEvent[] = [
    { sol: 50, type: 'RADIATION', text: 'Minor flare detected', crewId: null, magnitude: 1.2 },
    { sol: 100, type: 'SLEEP', text: 'Workload crunch', crewId: 'C001', magnitude: 2.5 },
    { sol: 120, type: 'CARDIAC', text: 'HR elevation', crewId: 'C002', magnitude: 1.0 },
    { sol: 150, type: 'SYSTEM', text: 'Life support test', crewId: null, magnitude: null },
  ];

  const mockAlerts: Alert[] = [
    {
      id: 'a1',
      crewId: 'C001',
      severity: 'warning',
      criFrom: 78,
      criTo: 64,
      drivers: ['Sleep Debt', 'Cardio Strain'],
      predictedWindowHours: 48,
      message: 'C001 sleep debt cumulative spike',
      provenance: 'SYNTHETIC',
    },
    {
      id: 'a2',
      crewId: 'C002',
      severity: 'watch',
      criFrom: 85,
      criTo: 79,
      drivers: ['Cardio Strain'],
      predictedWindowHours: 48,
      message: 'C002 elevated resting HR',
      provenance: 'SYNTHETIC',
    },
  ];

  const mockCRI: CRIResult = {
    crewId: 'C001',
    sol: 100,
    cri: 64.2,
    status: 'amber',
    contributions: {
      radiation: 4.5,
      sleep: 16.3,
      cardio: 10.0,
      mood: 3.0,
      inflammation: 2.0,
    },
    weights: {
      radiation: 0.3,
      sleep: 0.25,
      cardio: 0.25,
      mood: 0.1,
      inflammation: 0.1,
    },
    formulaVersion: 'v1',
    provenance: 'SYNTHETIC',
  };

  it('filters events up to the selected sol and matches crew or global', () => {
    const upTo100 = filterScenarioEventsUpToSol(mockEvents, 100, 'C001');
    expect(upTo100.length).toBe(2);
    expect(upTo100[0].sol).toBe(100);
    expect(upTo100[1].sol).toBe(50);

    const upTo40 = filterScenarioEventsUpToSol(mockEvents, 40, 'C001');
    expect(upTo40.length).toBe(0);
  });

  it('filters alerts by crew ID', () => {
    const c001Alerts = filterAlertsForCrew(mockAlerts, 'C001');
    expect(c001Alerts.length).toBe(1);
    expect(c001Alerts[0].id).toBe('a1');

    const c003Alerts = filterAlertsForCrew(mockAlerts, 'C003');
    expect(c003Alerts.length).toBe(0);
  });

  it('builds full incident report data with top 3 levers sorted descending', () => {
    const report = buildIncidentReportData({
      crewId: 'C001',
      sol: 100,
      criResult: mockCRI,
      allEvents: mockEvents,
      alerts: mockAlerts,
    });

    expect(report.crewId).toBe('C001');
    expect(report.sol).toBe(100);
    expect(report.cri).toBe(64.2);
    expect(report.status).toBe('amber');
    expect(report.alerts.length).toBe(1);
    expect(report.events.length).toBe(2);
    expect(report.topLevers.length).toBe(3);
    // Highest points first
    expect(report.topLevers[0].points).toBeGreaterThanOrEqual(report.topLevers[1].points);
    expect(report.topLevers[1].points).toBeGreaterThanOrEqual(report.topLevers[2].points);
    expect(report.topLevers[0].factor).toBe('sleep');
  });
});
