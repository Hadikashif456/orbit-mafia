import { describe, it, expect } from 'vitest';
import { calculateRecoveryLevers } from './levers';

describe('recovery levers calculation', () => {
  const mockContributions = {
    cardio: 15.2,
    radiation: 12.0,
    sleep: 8.5,
    mood: 2.1,
    inflammation: 0.3,
  };
  const mockCri = 61.9;

  it('sorts levers descending by points deductible', () => {
    const { levers, totalDeficit } = calculateRecoveryLevers(mockContributions, mockCri);
    expect(totalDeficit).toBe(38.1);
    expect(levers[0].factor).toBe('cardio');
    expect(levers[0].points).toBe(15.2);
    expect(levers[1].factor).toBe('radiation');
    expect(levers[1].points).toBe(12.0);
    expect(levers[4].factor).toBe('inflammation');
    expect(levers[4].points).toBe(0.3);
  });

  it('calculates percentage of total deficit accurately', () => {
    const { levers, totalDeficit } = calculateRecoveryLevers(mockContributions, mockCri);
    const sumPoints = levers.reduce((acc, l) => acc + l.points, 0);
    expect(Math.abs(sumPoints - totalDeficit)).toBeLessThanOrEqual(0.1);
  });

  it('handles empty or perfect health (CRI=100) gracefully', () => {
    const zeroContributions = {
      cardio: 0,
      radiation: 0,
      sleep: 0,
      mood: 0,
      inflammation: 0,
    };
    const { levers, totalDeficit } = calculateRecoveryLevers(zeroContributions, 100);
    expect(totalDeficit).toBe(0);
    expect(levers.every((l) => l.points === 0)).toBe(true);
  });
});
