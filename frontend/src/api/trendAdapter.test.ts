import { describe, expect, it } from 'vitest';
import { buildSeries } from './trendAdapter';
import type { AstronautSnapshot, DailyRow } from '../types/astronaut';

const snapshot: AstronautSnapshot = {
  id: 'C002',
  name: 'Emily Carter',
  role: 'Mission Commander',
  day: 142,
  sleep: 55,
  cardio: 60,
  radiation: 55,
  exercise: 70,
  mood: 70,
  cri: 61,
  status: 'watch',
};

describe('buildSeries', () => {
  it('normalises CRI number arrays into one emphasized series', () => {
    const result = buildSeries(snapshot, [82, 70, 61]);
    expect(result.mode).toBe('cri-only');
    expect(result.series).toHaveLength(1);
    expect(result.series[0].points[2]).toEqual({ day: 3, value: 61 });
  });

  it('automatically expands DailyRow responses into six series', () => {
    const row: DailyRow = {
      day: 142,
      crew_id: 'C002',
      sleep: 55,
      cardio: 60,
      radiation: 55,
      exercise: 70,
      mood: 70,
      cri: 61,
      band: 'Amber',
    };
    const result = buildSeries(snapshot, [row]);
    expect(result.mode).toBe('full');
    expect(result.series.map((item) => item.key)).toEqual([
      'sleep', 'cardio', 'radiation', 'exercise', 'mood', 'cri',
    ]);
    expect(result.series[5].emphasis).toBe(true);
  });
});
