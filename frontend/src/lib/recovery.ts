import type { Biomarker } from '../api/types';

/**
 * Standard recovery tolerance threshold: ±10% of pre-flight baseline.
 */
export const RECOVERY_TOLERANCE_PCT = 10;

/**
 * Parses spaceflight timepoint strings into numeric offsets for chronological sorting.
 * Pre-flight e.g. "L-92" -> -92, "L-44" -> -44, "L-3" -> -3.
 * Post-flight e.g. "R+1" -> 1, "R+45" -> 45, "R+82" -> 82, "R+194" -> 194.
 * Returns null for unknown strings (skips row silently).
 */
export function parseTimepoint(tp: string): number | null {
  if (!tp || typeof tp !== 'string') return null;
  const match = tp.trim().match(/^([LR])([+-]?)(\d+)$/i);
  if (!match) return null;

  const prefix = match[1].toUpperCase();
  const sign = match[2];
  const num = parseInt(match[3], 10);
  if (isNaN(num)) return null;

  if (prefix === 'L') {
    // Pre-flight offset is negative relative to launch
    return sign === '+' ? num : -num;
  }
  if (prefix === 'R') {
    // Post-flight recovery offset is positive relative to return
    return sign === '-' ? -num : num;
  }
  return null;
}

/**
 * Formats a timepoint label into a human-readable display string.
 * e.g. "L-92" -> "Pre-flight L-92", "R+45" -> "Post R+45".
 */
export function formatTimepoint(tp: string): string {
  if (!tp || typeof tp !== 'string') return '';
  const parsed = parseTimepoint(tp);
  if (parsed === null) return tp;
  if (parsed < 0) {
    return `Pre-flight ${tp.trim()}`;
  }
  return `Post ${tp.trim()}`;
}

/**
 * Computes an astronaut's pre-flight baseline for a given biomarker analyte.
 * Uses the earliest pre-flight timepoint (most negative number).
 * If a crew has multiple baseline timepoints (e.g. L-92, L-44, L-3), uses the mean of them.
 * Skips/returns null if baseline is 0, NaN, or missing.
 */
export function baselineOf(
  rows: Biomarker[],
  crewId: string,
  name: string
): number | null {
  if (!rows || !Array.isArray(rows)) return null;

  const matching = rows.filter(
    (r) =>
      r.crewId === crewId &&
      r.name.trim().toUpperCase() === name.trim().toUpperCase() &&
      r.value !== null &&
      r.value !== undefined &&
      !isNaN(r.value)
  );
  if (matching.length === 0) return null;

  // Filter for pre-flight points (parsed timepoint < 0)
  const preFlight = matching.filter((r) => {
    const pt = parseTimepoint(r.timepoint);
    return pt !== null && pt < 0;
  });

  let baselineRows: Biomarker[];
  if (preFlight.length > 0) {
    baselineRows = preFlight;
  } else {
    // Fallback if dataset contains non-negative timepoints: use earliest available point
    const withPt = matching
      .map((r) => ({ row: r, pt: parseTimepoint(r.timepoint) }))
      .filter((x): x is { row: Biomarker; pt: number } => x.pt !== null);
    if (withPt.length === 0) return null;
    const minPt = Math.min(...withPt.map((x) => x.pt));
    baselineRows = withPt.filter((x) => x.pt === minPt).map((x) => x.row);
  }

  const values = baselineRows.map((r) => r.value);
  if (values.length === 0) return null;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean === 0 || isNaN(mean)) return null;
  return mean;
}

/**
 * Normalizes a measured value to a percentage of the individual's baseline.
 * value / baseline * 100.
 * Returns null if baseline is 0 or non-finite.
 */
export function toPercentOfBaseline(value: number, baseline: number): number | null {
  if (baseline === 0 || !isFinite(baseline) || !isFinite(value)) return null;
  return (value / baseline) * 100;
}

export interface RecoveryPoint {
  timepoint: string;
  pct: number;
}

export interface RecoveryStatusResult {
  peakDeviationPct: number;
  peakTimepoint: string;
  recoveredAt: string | null;
}

/**
 * Evaluates biomarker recovery relative to pre-flight baseline.
 * Finds the post-flight peak deviation (|pct - 100| maximum).
 * Then identifies the first post-flight timepoint AFTER peak deviation where
 * |pct - 100| <= tolerancePct and remains within tolerance for all subsequent observed points.
 */
export function recoveryStatus(
  series: RecoveryPoint[],
  tolerancePct: number = RECOVERY_TOLERANCE_PCT
): RecoveryStatusResult {
  if (!series || !Array.isArray(series) || series.length === 0) {
    return { peakDeviationPct: 0, peakTimepoint: '', recoveredAt: null };
  }

  // Sort series chronologically by parsed timepoint
  const sorted = [...series]
    .map((s) => ({ ...s, pt: parseTimepoint(s.timepoint) }))
    .filter((s): s is RecoveryPoint & { pt: number } => s.pt !== null && !isNaN(s.pct))
    .sort((a, b) => a.pt - b.pt);

  if (sorted.length === 0) {
    return { peakDeviationPct: 0, peakTimepoint: '', recoveredAt: null };
  }

  // Find post-flight points (parsed timepoint > 0)
  const postFlight = sorted.filter((s) => s.pt > 0);
  if (postFlight.length === 0) {
    return { peakDeviationPct: 0, peakTimepoint: '', recoveredAt: null };
  }

  // Find peak absolute deviation from 100% baseline among post-flight points
  let peakIndex = 0;
  let maxAbsDev = -1;

  for (let i = 0; i < postFlight.length; i++) {
    const absDev = Math.abs(postFlight[i].pct - 100);
    if (absDev > maxAbsDev) {
      maxAbsDev = absDev;
      peakIndex = i;
    }
  }

  const peakPoint = postFlight[peakIndex];
  const peakDeviationPct = Math.round((peakPoint.pct - 100) * 10) / 10;
  const peakTimepoint = peakPoint.timepoint;

  // Find first timepoint AFTER peak deviation that is within tolerance and STAYS within tolerance
  let recoveredAt: string | null = null;
  for (let i = peakIndex + 1; i < postFlight.length; i++) {
    const isWithin = Math.abs(postFlight[i].pct - 100) <= tolerancePct;
    if (isWithin) {
      // Verify all subsequent points remain within tolerance
      const staysWithin = postFlight
        .slice(i)
        .every((p) => Math.abs(p.pct - 100) <= tolerancePct);
      if (staysWithin) {
        recoveredAt = postFlight[i].timepoint;
        break;
      }
    }
  }

  return {
    peakDeviationPct,
    peakTimepoint,
    recoveredAt,
  };
}
