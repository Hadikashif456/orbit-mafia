import { describe, it, expect } from 'vitest';
import { rankCrew, calculateRecentDrop, generateRankReason } from './triage';
import type { CrewSummary } from '../api/types';

describe('triage queue logic', () => {
  const mockCrew: CrewSummary[] = [
    {
      id: 'C001',
      callsign: 'Apex',
      cri: 92.5,
      status: 'green',
      topDriver: 'Nominal',
      sparkline: [95, 94, 93, 92.5],
      provenance: 'SYNTHETIC',
    },
    {
      id: 'C002',
      callsign: 'Vanguard',
      cri: 61.9,
      status: 'amber',
      topDriver: 'Cardiovascular strain',
      sparkline: [86.6, 75.0, 68.2, 61.9],
      provenance: 'SYNTHETIC',
    },
    {
      id: 'C003',
      callsign: 'Beacon',
      cri: 78.4,
      status: 'amber',
      topDriver: 'Sleep restriction',
      sparkline: [91.9, 88.0, 82.0, 78.4],
      provenance: 'SYNTHETIC',
    },
    {
      id: 'C004',
      callsign: 'Nova',
      cri: 48.0,
      status: 'red',
      topDriver: 'SPE radiation exposure',
      sparkline: [80.0, 70.0, 60.0, 48.0],
      provenance: 'SYNTHETIC',
    },
  ];

  it('ranks red status crew member first regardless of CRI', () => {
    const ranked = rankCrew(mockCrew);
    expect(ranked[0].member.id).toBe('C004');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].member.status).toBe('red');
  });

  it('breaks ties between same status by lowest CRI', () => {
    const ranked = rankCrew(mockCrew);
    // Between C002 (amber, 61.9) and C003 (amber, 78.4), C002 is lower CRI and ranked higher
    expect(ranked[1].member.id).toBe('C002');
    expect(ranked[2].member.id).toBe('C003');
  });

  it('breaks ties between equal status and CRI by largest recent drop', () => {
    const tiedCrew: CrewSummary[] = [
      {
        id: 'C001',
        callsign: 'TiedA',
        cri: 60.0,
        status: 'amber',
        topDriver: 'Driver A',
        sparkline: [62, 60.0], // drop = 2
        provenance: 'SYNTHETIC',
      },
      {
        id: 'C002',
        callsign: 'TiedB',
        cri: 60.0,
        status: 'amber',
        topDriver: 'Driver B',
        sparkline: [70, 60.0], // drop = 10
        provenance: 'SYNTHETIC',
      },
    ];

    const ranked = rankCrew(tiedCrew);
    expect(ranked[0].member.id).toBe('C002'); // Larger drop of 10
    expect(ranked[1].member.id).toBe('C001');
  });

  it('calculates recent drop accurately', () => {
    expect(calculateRecentDrop([80, 72.5])).toBe(7.5);
    expect(calculateRecentDrop([50])).toBe(0);
    expect(calculateRecentDrop([50, 60])).toBe(0); // recovery does not produce negative drop
  });

  it('generates clear explanatory reason for ranking', () => {
    const reason = generateRankReason(mockCrew[1], 2, 6.3);
    expect(reason).toContain('Rank #2');
    expect(reason).toContain('AMBER');
    expect(reason).toContain('Cardiovascular strain');
  });
});
