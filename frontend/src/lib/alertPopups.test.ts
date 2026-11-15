import { describe, it, expect } from 'vitest';
import {
  selectNewAlerts,
  sortAlerts,
  alertsFromCrew,
  severityLabel,
  SEVERITY_RANK,
} from './alertPopups';
import type { Alert, CrewSummary } from '../api/types';

function createMockAlert(
  id: string,
  crewId: string,
  severity: 'watch' | 'warning' | 'critical',
  criFrom = 80,
  criTo = 60
): Alert {
  return {
    id,
    crewId,
    severity,
    criFrom,
    criTo,
    drivers: ['Radiation event'],
    predictedWindowHours: 48,
    message: `${crewId} under stress`,
    provenance: 'SYNTHETIC',
  };
}

describe('alertPopups logic', () => {
  it('first sight is fresh', () => {
    const alert = createMockAlert('a1', 'C001', 'watch');
    const seen = {};
    const { fresh, nextSeen } = selectNewAlerts([alert], seen);

    expect(fresh).toHaveLength(1);
    expect(fresh[0].id).toBe('a1');
    expect(nextSeen).toEqual({ C001: SEVERITY_RANK.watch });
  });

  it('same severity again is not fresh', () => {
    const alert = createMockAlert('a1', 'C001', 'watch');
    const seen = { C001: SEVERITY_RANK.watch };
    const { fresh, nextSeen } = selectNewAlerts([alert], seen);

    expect(fresh).toHaveLength(0);
    expect(nextSeen).toEqual({ C001: SEVERITY_RANK.watch });
  });

  it('escalation watch -> warning -> critical is fresh each time', () => {
    // Step 1: watch
    const alert1 = createMockAlert('a1', 'C002', 'watch');
    const res1 = selectNewAlerts([alert1], {});
    expect(res1.fresh).toHaveLength(1);
    expect(res1.fresh[0].severity).toBe('watch');
    expect(res1.nextSeen).toEqual({ C002: 1 });

    // Step 2: escalates to warning
    const alert2 = createMockAlert('a2', 'C002', 'warning');
    const res2 = selectNewAlerts([alert2], res1.nextSeen);
    expect(res2.fresh).toHaveLength(1);
    expect(res2.fresh[0].severity).toBe('warning');
    expect(res2.nextSeen).toEqual({ C002: 2 });

    // Step 3: escalates to critical
    const alert3 = createMockAlert('a3', 'C002', 'critical');
    const res3 = selectNewAlerts([alert3], res2.nextSeen);
    expect(res3.fresh).toHaveLength(1);
    expect(res3.fresh[0].severity).toBe('critical');
    expect(res3.nextSeen).toEqual({ C002: 3 });
  });

  it('de-escalation never produces a pop-up', () => {
    const alertWarning = createMockAlert('a2', 'C002', 'warning');
    const seenCritical = { C002: SEVERITY_RANK.critical }; // rank 3
    const res = selectNewAlerts([alertWarning], seenCritical); // rank 2

    expect(res.fresh).toHaveLength(0);
    expect(res.nextSeen).toEqual({ C002: SEVERITY_RANK.warning });

    // Further de-escalation to watch
    const alertWatch = createMockAlert('a3', 'C002', 'watch');
    const res2 = selectNewAlerts([alertWatch], res.nextSeen);
    expect(res2.fresh).toHaveLength(0);
    expect(res2.nextSeen).toEqual({ C002: SEVERITY_RANK.watch });
  });

  it('a crew that vanishes is removed from nextSeen and re-shows later', () => {
    // Alert active
    const alert1 = createMockAlert('a1', 'C002', 'critical');
    const res1 = selectNewAlerts([alert1], {});
    expect(res1.nextSeen).toEqual({ C002: 3 });

    // Crew recovers, no alerts present
    const res2 = selectNewAlerts([], res1.nextSeen);
    expect(res2.fresh).toHaveLength(0);
    expect(res2.nextSeen).toEqual({}); // C002 is removed!

    // Later, crew alerts again with lower rank (watch)
    const alert3 = createMockAlert('a3', 'C002', 'watch');
    const res3 = selectNewAlerts([alert3], res2.nextSeen);
    expect(res3.fresh).toHaveLength(1);
    expect(res3.fresh[0].severity).toBe('watch');
    expect(res3.nextSeen).toEqual({ C002: 1 });
  });

  it('sortAlerts orders by severity desc, then (criFrom - criTo) desc', () => {
    const aWatch = createMockAlert('w1', 'C001', 'watch', 80, 70); // drop 10
    const aWarningLow = createMockAlert('warn1', 'C002', 'warning', 80, 70); // drop 10
    const aWarningHigh = createMockAlert('warn2', 'C003', 'warning', 90, 60); // drop 30
    const aCritical = createMockAlert('crit1', 'C004', 'critical', 80, 50); // drop 30

    const sorted = sortAlerts([aWatch, aWarningLow, aCritical, aWarningHigh]);

    expect(sorted.map((a) => a.id)).toEqual(['crit1', 'warn2', 'warn1', 'w1']);
  });

  it('alertsFromCrew handles fallback mapping correctly', () => {
    const crew: CrewSummary[] = [
      {
        id: 'C001',
        callsign: 'Cmdr A',
        cri: 85,
        status: 'green',
        topDriver: 'Optimal',
        sparkline: [85, 86, 85],
        provenance: 'SYNTHETIC',
      },
      {
        id: 'C002',
        callsign: 'Cmdr B',
        cri: 61.2,
        status: 'amber',
        topDriver: 'Radiation event',
        sparkline: [84.0, 83.2, 82.0, 80.1, 61.2],
        provenance: 'SYNTHETIC',
      },
      {
        id: 'C003',
        callsign: 'Cmdr C',
        cri: 45.0,
        status: 'red',
        topDriver: 'Sleep deprivation',
        sparkline: [],
        provenance: 'SYNTHETIC',
      },
    ];

    const alerts = alertsFromCrew(crew);

    // Green is excluded
    expect(alerts).toHaveLength(2);

    // Amber mapped to watch
    const bAlert = alerts.find((a) => a.crewId === 'C002')!;
    expect(bAlert.severity).toBe('watch');
    expect(bAlert.criTo).toBe(61.2);
    // Highest of last 3 sparkline values [82.0, 80.1, 61.2] is 82.0
    expect(bAlert.criFrom).toBe(82.0);
    expect(bAlert.drivers).toEqual(['Radiation event']);
    expect(bAlert.id).toBe('crew-C002-amber');
    expect(bAlert.message).toBe('Cmdr B resilience is 61.2 (amber). Top driver: Radiation event.');

    // Red mapped to critical, missing sparkline falls back to cri
    const cAlert = alerts.find((a) => a.crewId === 'C003')!;
    expect(cAlert.severity).toBe('critical');
    expect(cAlert.criTo).toBe(45.0);
    expect(cAlert.criFrom).toBe(45.0);
    expect(cAlert.drivers).toEqual(['Sleep deprivation']);
    expect(cAlert.id).toBe('crew-C003-red');
  });

  it('severityLabel formats labels', () => {
    expect(severityLabel('watch')).toBe('WATCH');
    expect(severityLabel('warning')).toBe('WARNING');
    expect(severityLabel('critical')).toBe('CRITICAL (RED)');
  });
});
