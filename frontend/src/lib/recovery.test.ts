import { describe, it, expect } from 'vitest';
import {
  parseTimepoint,
  formatTimepoint,
  baselineOf,
  toPercentOfBaseline,
  recoveryStatus,
  RECOVERY_TOLERANCE_PCT,
} from './recovery';
import type { Biomarker } from '../api/types';

describe('recovery module', () => {
  describe('parseTimepoint and formatTimepoint', () => {
    it('parses valid pre-flight and post-flight timepoint strings correctly', () => {
      expect(parseTimepoint('L-92')).toBe(-92);
      expect(parseTimepoint('L-44')).toBe(-44);
      expect(parseTimepoint('L-3')).toBe(-3);
      expect(parseTimepoint('R+1')).toBe(1);
      expect(parseTimepoint('R+45')).toBe(45);
      expect(parseTimepoint('R+82')).toBe(82);
      expect(parseTimepoint('R+194')).toBe(194);
    });

    it('returns null for unknown or invalid timepoint strings', () => {
      expect(parseTimepoint('')).toBeNull();
      expect(parseTimepoint('UNKNOWN')).toBeNull();
      expect(parseTimepoint('Mid-mission')).toBeNull();
      expect(parseTimepoint('X-10')).toBeNull();
    });

    it('formats timepoints into human-readable display labels', () => {
      expect(formatTimepoint('L-92')).toBe('Pre-flight L-92');
      expect(formatTimepoint('R+45')).toBe('Post R+45');
      expect(formatTimepoint('')).toBe('');
      expect(formatTimepoint('OTHER')).toBe('OTHER');
    });
  });

  describe('baselineOf and toPercentOfBaseline', () => {
    const mockRows: Biomarker[] = [
      {
        crewId: 'C001',
        timepoint: 'L-92',
        panel: 'CARDIO_EVE',
        name: 'CRP',
        value: 100,
        unit: 'pg/mL',
        refMin: null,
        refMax: null,
        provenance: 'REAL_OSDR',
      },
      {
        crewId: 'C001',
        timepoint: 'L-44',
        panel: 'CARDIO_EVE',
        name: 'CRP',
        value: 120,
        unit: 'pg/mL',
        refMin: null,
        refMax: null,
        provenance: 'REAL_OSDR',
      },
      {
        crewId: 'C001',
        timepoint: 'L-3',
        panel: 'CARDIO_EVE',
        name: 'CRP',
        value: 110,
        unit: 'pg/mL',
        refMin: null,
        refMax: null,
        provenance: 'REAL_OSDR',
      },
      {
        crewId: 'C001',
        timepoint: 'R+1',
        panel: 'CARDIO_EVE',
        name: 'CRP',
        value: 250,
        unit: 'pg/mL',
        refMin: null,
        refMax: null,
        provenance: 'REAL_OSDR',
      },
    ];

    it('computes mean of multiple pre-flight baseline points', () => {
      // (100 + 120 + 110) / 3 = 110
      const baseline = baselineOf(mockRows, 'C001', 'CRP');
      expect(baseline).toBe(110);
    });

    it('skips and returns null when baseline is zero', () => {
      const zeroRows: Biomarker[] = [
        {
          crewId: 'C002',
          timepoint: 'L-92',
          panel: 'CMP',
          name: 'ALT',
          value: 0,
          unit: 'U/L',
          refMin: null,
          refMax: null,
          provenance: 'REAL_OSDR',
        },
      ];
      expect(baselineOf(zeroRows, 'C002', 'ALT')).toBeNull();
      expect(toPercentOfBaseline(50, 0)).toBeNull();
    });

    it('skips and returns null when baseline or crew data is missing', () => {
      expect(baselineOf(mockRows, 'C999', 'CRP')).toBeNull();
      expect(baselineOf(mockRows, 'C001', 'NONEXISTENT')).toBeNull();
    });

    it('calculates toPercentOfBaseline accurately', () => {
      expect(toPercentOfBaseline(165, 110)).toBe(150);
      expect(toPercentOfBaseline(110, 110)).toBe(100);
      expect(toPercentOfBaseline(55, 110)).toBe(50);
    });
  });

  describe('recoveryStatus', () => {
    it('handles normal recovery where biomarker returns and stays within ±10%', () => {
      const series = [
        { timepoint: 'L-92', pct: 100 },
        { timepoint: 'R+1', pct: 240 },   // Peak deviation (+140%)
        { timepoint: 'R+45', pct: 130 },  // 30% deviation (outside 10%)
        { timepoint: 'R+82', pct: 106 },  // Within tolerance (6% deviation)
        { timepoint: 'R+194', pct: 102 }, // Within tolerance (2% deviation)
      ];

      const res = recoveryStatus(series, RECOVERY_TOLERANCE_PCT);
      expect(res.peakDeviationPct).toBe(140);
      expect(res.peakTimepoint).toBe('R+1');
      expect(res.recoveredAt).toBe('R+82');
    });

    it('handles series that never recovers within the observed window', () => {
      const series = [
        { timepoint: 'L-92', pct: 100 },
        { timepoint: 'R+1', pct: 180 },   // Peak (+80%)
        { timepoint: 'R+45', pct: 160 },
        { timepoint: 'R+82', pct: 140 },
        { timepoint: 'R+194', pct: 125 }, // Still 25% above baseline
      ];

      const res = recoveryStatus(series, RECOVERY_TOLERANCE_PCT);
      expect(res.peakDeviationPct).toBe(80);
      expect(res.peakTimepoint).toBe('R+1');
      expect(res.recoveredAt).toBeNull();
    });

    it('handles unsorted input by chronologically ordering points before evaluation', () => {
      const unsortedSeries = [
        { timepoint: 'R+194', pct: 103 },
        { timepoint: 'R+1', pct: 210 },
        { timepoint: 'L-3', pct: 98 },
        { timepoint: 'R+82', pct: 107 },
        { timepoint: 'R+45', pct: 128 },
      ];

      const res = recoveryStatus(unsortedSeries, RECOVERY_TOLERANCE_PCT);
      expect(res.peakDeviationPct).toBe(110);
      expect(res.peakTimepoint).toBe('R+1');
      expect(res.recoveredAt).toBe('R+82');
    });

    it('handles missing intermediate post-flight timepoints gracefully', () => {
      const seriesWithGaps = [
        { timepoint: 'L-92', pct: 100 },
        { timepoint: 'R+1', pct: 195 },   // Peak deviation (+95%)
        // R+45 and R+82 missing
        { timepoint: 'R+194', pct: 104 }, // Recovered at R+194
      ];

      const res = recoveryStatus(seriesWithGaps, RECOVERY_TOLERANCE_PCT);
      expect(res.peakDeviationPct).toBe(95);
      expect(res.peakTimepoint).toBe('R+1');
      expect(res.recoveredAt).toBe('R+194');
    });

    it('does not claim recovery if value spikes back outside tolerance on later timepoints', () => {
      const fluctuatingSeries = [
        { timepoint: 'L-92', pct: 100 },
        { timepoint: 'R+1', pct: 250 },   // Peak
        { timepoint: 'R+45', pct: 105 },  // Briefly dips into 10% tolerance
        { timepoint: 'R+82', pct: 135 },  // Relapses to 35% above baseline
        { timepoint: 'R+194', pct: 108 }, // Returns to tolerance
      ];

      const res = recoveryStatus(fluctuatingSeries, RECOVERY_TOLERANCE_PCT);
      // R+45 is not valid recoveredAt because R+82 relapsed!
      expect(res.recoveredAt).toBe('R+194');
    });
  });
});
