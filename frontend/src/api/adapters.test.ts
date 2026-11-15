import { describe, it, expect } from 'vitest';
import {
  statusToBand,
  statusToCrewStatus,
  toCrewMember,
  toDailyRows,
  toDetailSnapshot,
} from './adapters';
import {
  computeSleepScore,
  computeExerciseScore,
  computeMoodScore,
  computeRadiationScore,
  computeCardioScore,
} from '../lib/displayScales';
import type { CrewSummary, CRIResult, TrendPoint, VitalPoint } from './types';

describe('Adapters and Display Scales', () => {
  describe('Status mapping', () => {
    it('maps status correctly to DetailBand', () => {
      expect(statusToBand('green')).toBe('Green');
      expect(statusToBand('amber')).toBe('Amber');
      expect(statusToBand('red')).toBe('Red');
    });

    it('maps status correctly to CrewStatus without re-deriving', () => {
      expect(statusToCrewStatus('green')).toBe('optimal');
      expect(statusToCrewStatus('amber')).toBe('watch');
      expect(statusToCrewStatus('red')).toBe('act_now');
    });
  });

  describe('toCrewMember', () => {
    it('maps previousCri correctly from sparkline', () => {
      const summary: CrewSummary = {
        id: 'C001',
        callsign: 'Cmdr A',
        cri: 84.52,
        status: 'green',
        topDriver: 'Baseline stable',
        sparkline: [85, 84, 85, 83.2, 84.5],
        provenance: 'SYNTHETIC',
      };
      const member = toCrewMember(summary);
      expect(member.id).toBe('C001');
      expect(member.code).toBe('CM-01');
      expect(member.name).toBe('Cmdr A');
      expect(member.role).toBe('Baseline stable');
      expect(member.cri).toBe(84.5);
      expect(member.previousCri).toBe(83.2);
      expect(member.status).toBe('optimal');
    });

    it('falls back previousCri to current cri if sparkline is short', () => {
      const summary: CrewSummary = {
        id: 'C002',
        callsign: 'Cmdr B',
        cri: 61.2,
        status: 'amber',
        topDriver: 'Radiation event',
        sparkline: [61.2],
        provenance: 'SYNTHETIC',
      };
      const member = toCrewMember(summary);
      expect(member.previousCri).toBe(61.2);
      expect(member.status).toBe('watch');
    });
  });

  describe('toDailyRows (join on sol)', () => {
    it('joins trend and vitals rows by mission sol', () => {
      const trend: TrendPoint[] = [
        { sol: 140, cri: 80.0, status: 'green' },
        { sol: 141, cri: 75.4, status: 'amber' },
      ];
      const vitals: VitalPoint[] = [
        {
          crewId: 'C001',
          sol: 140,
          hr: 70,
          hrv: 50,
          sleepHours: 8,
          exerciseMin: 60,
          mood: 5,
          radiationMsv: 0,
          provenance: 'SYNTHETIC',
        },
        {
          crewId: 'C001',
          sol: 141,
          hr: 70,
          hrv: 50,
          sleepHours: 4,
          exerciseMin: 30,
          mood: 3,
          radiationMsv: 5,
          provenance: 'SYNTHETIC',
        },
      ];

      const rows = toDailyRows('C001', trend, vitals, { hrBase: 70, hrvBase: 50 });
      expect(rows.length).toBe(2);
      expect(rows[0].day).toBe(140);
      expect(rows[0].cri).toBe(80.0);
      expect(rows[0].band).toBe('Green');
      expect(rows[0].sleep).toBe(100);
      expect(rows[0].exercise).toBe(100);
      expect(rows[0].mood).toBe(100);
      expect(rows[0].radiation).toBe(100);
      expect(rows[0].cardio).toBe(100);

      expect(rows[1].day).toBe(141);
      expect(rows[1].band).toBe('Amber');
      expect(rows[1].sleep).toBe(50);
      expect(rows[1].exercise).toBe(50);
      expect(rows[1].mood).toBe(50);
      expect(rows[1].radiation).toBe(50);
    });
  });

  describe('Display Scales', () => {
    it('computes sleep score at various hours', () => {
      expect(computeSleepScore(8)).toBe(100);
      expect(computeSleepScore(4)).toBe(50);
      expect(computeSleepScore(0)).toBe(0);
      expect(computeSleepScore(10)).toBe(100); // clamped at 100
    });

    it('computes exercise score at various minutes', () => {
      expect(computeExerciseScore(60)).toBe(100);
      expect(computeExerciseScore(30)).toBe(50);
      expect(computeExerciseScore(0)).toBe(0);
      expect(computeExerciseScore(90)).toBe(100); // clamped at 100
    });

    it('computes mood score across 1..5 scale', () => {
      expect(computeMoodScore(5)).toBe(100);
      expect(computeMoodScore(3)).toBe(50);
      expect(computeMoodScore(1)).toBe(0);
    });

    it('computes radiation score inversely against 10 mSv', () => {
      expect(computeRadiationScore(0)).toBe(100);
      expect(computeRadiationScore(5)).toBe(50);
      expect(computeRadiationScore(10)).toBe(0);
      expect(computeRadiationScore(12)).toBe(0); // clamped at 0
    });

    it('computes baseline cardio = 100 at baseline', () => {
      const hrBase = 65.4;
      const hrvBase = 48.2;
      const score = computeCardioScore(hrBase, hrvBase, { hrBase, hrvBase });
      expect(score).toBe(100);
    });

    it('penalizes elevated HR and depressed HRV in cardio score', () => {
      const hrBase = 70;
      const hrvBase = 50;
      // HR elevated to 85, HRV depressed to 35
      const score = computeCardioScore(85, 35, { hrBase, hrvBase });
      // 50 * (35/50) + 50 * (70/85) = 35 + 41.176 = 76.2
      expect(score).toBe(76.2);
    });
  });

  describe('toDetailSnapshot', () => {
    it('assembles detail snapshot from summary, cri, and rows', () => {
      const summary: CrewSummary = {
        id: 'C001',
        callsign: 'Cmdr A',
        cri: 84.5,
        status: 'green',
        topDriver: 'Baseline stable',
        sparkline: [85, 84, 85, 84, 85],
        provenance: 'SYNTHETIC',
      };
      const criResult: CRIResult = {
        crewId: 'C001',
        sol: 144,
        cri: 84.5,
        status: 'green',
        contributions: { radiation: 2, sleep: 2, cardio: 2, mood: 1, inflammation: 1 },
        weights: { radiation: 0.3, sleep: 0.25, cardio: 0.25, mood: 0.1, inflammation: 0.1 },
        formulaVersion: 'v1',
        provenance: 'SYNTHETIC+REAL_OSDR',
      };
      const rows = [
        { day: 143, crew_id: 'C001', cri: 84, band: 'Green', sleep: 80, cardio: 90, radiation: 95, exercise: 80, mood: 75 },
        { day: 144, crew_id: 'C001', cri: 85, band: 'Green', sleep: 85, cardio: 92, radiation: 95, exercise: 85, mood: 80 },
      ];

      const snapshot = toDetailSnapshot(summary, criResult, rows);
      expect(snapshot.id).toBe('C001');
      expect(snapshot.name).toBe('Cmdr A');
      expect(snapshot.role).toBe('Baseline stable');
      expect(snapshot.cri).toBe(84.5);
      expect(snapshot.band).toBe('Green');
      expect(snapshot.sleep).toBe(85);
      expect(snapshot.cardio).toBe(92);
      expect(snapshot.trend).toEqual([84, 85]);
      expect(snapshot.data_label).toBe('Synthetic data');
    });
  });
});
