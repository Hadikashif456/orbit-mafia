/**
 * Compound stress evaluation and contiguous run analysis.
 * Operates purely on backend CRI contribution values without computing CRI.
 */

/**
 * Threshold in points for a stressor contribution to be considered active.
 * Set to 3.0 points to filter out healthy Gaussian baseline noise (typically 0.5-2.5 pts)
 * while identifying meaningful physiological strain (e.g. sleep restriction >= 3.5 pts,
 * acute radiation spike >= 9 pts, cardiovascular strain >= 4 pts).
 */
export const ACTIVE_THRESHOLD_POINTS = 3.0;

export type StressorKey = 'radiation' | 'sleep' | 'cardio' | 'mood' | 'inflammation';

export const STRESSOR_KEYS: StressorKey[] = [
  'radiation',
  'sleep',
  'cardio',
  'mood',
  'inflammation',
];

export const STRESSOR_LABELS: Record<StressorKey, string> = {
  radiation: 'Radiation',
  sleep: 'Sleep',
  cardio: 'Cardiovascular',
  mood: 'Mood',
  inflammation: 'Inflammation',
};

export const STRESSOR_COLORS: Record<StressorKey, string> = {
  radiation: '#ffe0a3',    // Champagne gold
  sleep: '#83e7f5',        // Glacial cyan
  cardio: '#b56cff',       // Electric orchid
  mood: '#f4a4cf',         // Cosmic rose
  inflammation: '#ff5d73', // Coral red
};

/**
 * Identifies keys whose contribution points meet or exceed the active threshold.
 */
export function activeStressors(
  contributions: Record<string, number> | undefined,
  threshold: number = ACTIVE_THRESHOLD_POINTS
): StressorKey[] {
  if (!contributions || typeof contributions !== 'object') return [];

  const active: StressorKey[] = [];
  for (const key of STRESSOR_KEYS) {
    const val = contributions[key];
    if (typeof val === 'number' && val >= threshold) {
      active.push(key);
    }
  }
  return active;
}

export type CompoundLevel = 'none' | 'compound' | 'severe compound';

/**
 * Categorizes compound stress severity level based on active stressor count.
 * 0-1: "none"
 * 2: "compound"
 * 3+: "severe compound"
 */
export function compoundLevel(count: number): CompoundLevel {
  if (count <= 1) return 'none';
  if (count === 2) return 'compound';
  return 'severe compound';
}

export interface CompoundRunPoint {
  sol: number;
  activeStressors: StressorKey[];
}

export interface CompoundRun {
  startSol: number;
  endSol: number;
  stressors: StressorKey[];
}

/**
 * Finds contiguous ranges of sols where 2 or more stressors are active simultaneously.
 * Returns an array of compound stress runs with startSol, endSol, and union of active stressors.
 */
export function findCompoundRuns(points: CompoundRunPoint[]): CompoundRun[] {
  if (!points || !Array.isArray(points) || points.length === 0) return [];

  // Sort chronologically by sol
  const sorted = [...points].sort((a, b) => a.sol - b.sol);
  const runs: CompoundRun[] = [];

  let currentRun: { startSol: number; endSol: number; stressorSet: Set<StressorKey> } | null = null;

  for (const pt of sorted) {
    const isCompound = pt.activeStressors && pt.activeStressors.length >= 2;

    if (isCompound) {
      if (!currentRun) {
        // Start a new contiguous compound run
        currentRun = {
          startSol: pt.sol,
          endSol: pt.sol,
          stressorSet: new Set<StressorKey>(pt.activeStressors),
        };
      } else if (pt.sol === currentRun.endSol + 1) {
        // Continue existing contiguous run
        currentRun.endSol = pt.sol;
        pt.activeStressors.forEach((s) => currentRun!.stressorSet.add(s));
      } else {
        // Discontinuity: close current run and start new one
        runs.push({
          startSol: currentRun.startSol,
          endSol: currentRun.endSol,
          stressors: Array.from(currentRun.stressorSet),
        });
        currentRun = {
          startSol: pt.sol,
          endSol: pt.sol,
          stressorSet: new Set<StressorKey>(pt.activeStressors),
        };
      }
    } else {
      if (currentRun) {
        // Run has ended
        runs.push({
          startSol: currentRun.startSol,
          endSol: currentRun.endSol,
          stressors: Array.from(currentRun.stressorSet),
        });
        currentRun = null;
      }
    }
  }

  // Push final run if still open
  if (currentRun) {
    runs.push({
      startSol: currentRun.startSol,
      endSol: currentRun.endSol,
      stressors: Array.from(currentRun.stressorSet),
    });
  }

  return runs;
}
