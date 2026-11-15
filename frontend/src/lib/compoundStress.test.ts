import { describe, it, expect } from 'vitest';
import {
  ACTIVE_THRESHOLD_POINTS,
  activeStressors,
  compoundLevel,
  findCompoundRuns,
  type CompoundRunPoint,
} from './compoundStress';

describe('compoundStress module', () => {
  describe('activeStressors', () => {
    it('returns empty array when no stressors meet or exceed the threshold (none active)', () => {
      const contributions = {
        radiation: 0.1,
        sleep: 1.5,
        cardio: 2.2,
        mood: 0.8,
        inflammation: 0.5,
      };
      const active = activeStressors(contributions, ACTIVE_THRESHOLD_POINTS);
      expect(active).toEqual([]);
    });

    it('identifies exactly one active stressor', () => {
      const contributions = {
        radiation: 0.2,
        sleep: 4.5, // >= 3.0
        cardio: 1.8,
        mood: 1.0,
        inflammation: 0.6,
      };
      const active = activeStressors(contributions, ACTIVE_THRESHOLD_POINTS);
      expect(active).toEqual(['sleep']);
    });

    it('identifies two active stressors', () => {
      const contributions = {
        radiation: 0.2,
        sleep: 7.2,  // Active
        cardio: 4.8, // Active
        mood: 2.1,
        inflammation: 0.9,
      };
      const active = activeStressors(contributions, ACTIVE_THRESHOLD_POINTS);
      expect(active).toEqual(['sleep', 'cardio']);
    });

    it('identifies three or more active stressors', () => {
      const contributions = {
        radiation: 12.5, // Active
        sleep: 9.8,     // Active
        cardio: 8.2,    // Active
        mood: 4.4,      // Active
        inflammation: 0.9,
      };
      const active = activeStressors(contributions, ACTIVE_THRESHOLD_POINTS);
      expect(active).toEqual(['radiation', 'sleep', 'cardio', 'mood']);
    });
  });

  describe('compoundLevel', () => {
    it('categorizes 0 and 1 as none', () => {
      expect(compoundLevel(0)).toBe('none');
      expect(compoundLevel(1)).toBe('none');
    });

    it('categorizes 2 as compound', () => {
      expect(compoundLevel(2)).toBe('compound');
    });

    it('categorizes 3 or more as severe compound', () => {
      expect(compoundLevel(3)).toBe('severe compound');
      expect(compoundLevel(4)).toBe('severe compound');
      expect(compoundLevel(5)).toBe('severe compound');
    });
  });

  describe('findCompoundRuns', () => {
    it('returns empty array for empty input', () => {
      expect(findCompoundRuns([])).toEqual([]);
    });

    it('returns empty array when no sols have compound stress', () => {
      const points: CompoundRunPoint[] = [
        { sol: 100, activeStressors: [] },
        { sol: 101, activeStressors: ['sleep'] },
        { sol: 102, activeStressors: ['cardio'] },
      ];
      expect(findCompoundRuns(points)).toEqual([]);
    });

    it('finds single contiguous run of compound stress', () => {
      const points: CompoundRunPoint[] = [
        { sol: 140, activeStressors: ['sleep'] },
        { sol: 141, activeStressors: ['sleep', 'cardio'] },
        { sol: 142, activeStressors: ['sleep', 'cardio', 'mood'] },
        { sol: 143, activeStressors: ['radiation', 'sleep', 'cardio'] },
        { sol: 144, activeStressors: ['radiation', 'cardio'] },
        { sol: 145, activeStressors: ['cardio'] }, // count 1 -> run ends
      ];

      const runs = findCompoundRuns(points);
      expect(runs).toHaveLength(1);
      expect(runs[0].startSol).toBe(141);
      expect(runs[0].endSol).toBe(144);
      expect(runs[0].stressors.sort()).toEqual(['cardio', 'mood', 'radiation', 'sleep'].sort());
    });

    it('finds multiple distinct runs across boundary discontinuities', () => {
      const points: CompoundRunPoint[] = [
        // Run 1: sols 110-111
        { sol: 110, activeStressors: ['sleep', 'mood'] },
        { sol: 111, activeStressors: ['sleep', 'mood'] },
        // Interruption: sol 112 has only 1 stressor
        { sol: 112, activeStressors: ['sleep'] },
        // Run 2: sol 115 (gap in sols + isolated compound sol)
        { sol: 115, activeStressors: ['cardio', 'radiation'] },
        // Interruption: sol 116 has 0 stressors
        { sol: 116, activeStressors: [] },
        // Run 3: sols 120-122
        { sol: 120, activeStressors: ['sleep', 'cardio'] },
        { sol: 121, activeStressors: ['sleep', 'cardio', 'radiation'] },
        { sol: 122, activeStressors: ['radiation', 'cardio'] },
      ];

      const runs = findCompoundRuns(points);
      expect(runs).toHaveLength(3);

      expect(runs[0]).toEqual({
        startSol: 110,
        endSol: 111,
        stressors: expect.arrayContaining(['sleep', 'mood']),
      });

      expect(runs[1]).toEqual({
        startSol: 115,
        endSol: 115,
        stressors: expect.arrayContaining(['cardio', 'radiation']),
      });

      expect(runs[2]).toEqual({
        startSol: 120,
        endSol: 122,
        stressors: expect.arrayContaining(['sleep', 'cardio', 'radiation']),
      });
    });

    it('handles unsorted input correctly', () => {
      const points: CompoundRunPoint[] = [
        { sol: 143, activeStressors: ['sleep', 'radiation'] },
        { sol: 141, activeStressors: ['sleep', 'cardio'] },
        { sol: 142, activeStressors: ['sleep', 'cardio'] },
      ];

      const runs = findCompoundRuns(points);
      expect(runs).toHaveLength(1);
      expect(runs[0].startSol).toBe(141);
      expect(runs[0].endSol).toBe(143);
    });
  });
});
