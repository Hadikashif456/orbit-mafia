import type { CRIResult } from '../api/types';

export interface RecoveryLever {
  factor: 'radiation' | 'sleep' | 'cardio' | 'mood' | 'inflammation';
  label: string;
  points: number;
  percentageOfDeficit: number;
}

const FACTOR_LABELS: Record<string, string> = {
  radiation: 'Radiation Exposure Mitigation',
  sleep: 'Sleep Debt & Circadian Restoration',
  cardio: 'Cardiovascular Autonomic Conditioning',
  mood: 'Psychological Well-being & Mood Support',
  inflammation: 'Inflammation & Biomarker Recovery',
};

/**
 * Calculates recovery levers from backend CRI contributions without recomputing CRI.
 * Contributions represent exact points deducted from 100.
 * Returned items are sorted descending by potential recovery points.
 */
export function calculateRecoveryLevers(
  contributions: CRIResult['contributions'],
  cri: number
): { levers: RecoveryLever[]; totalDeficit: number } {
  if (!contributions) {
    return { levers: [], totalDeficit: 0 };
  }

  const totalDeficit = Math.max(0, Number((100 - cri).toFixed(1)));

  const factors: Array<RecoveryLever['factor']> = [
    'radiation',
    'sleep',
    'cardio',
    'mood',
    'inflammation',
  ];

  const rawLevers = factors.map((factor) => {
    const rawPoints = contributions[factor] || 0;
    const points = Math.max(0, Number(rawPoints.toFixed(1)));
    const percentageOfDeficit =
      totalDeficit > 0 ? Number(((points / totalDeficit) * 100).toFixed(1)) : 0;

    return {
      factor,
      label: FACTOR_LABELS[factor] || factor,
      points,
      percentageOfDeficit,
    };
  });

  // Sort descending by potential point gain
  const levers = rawLevers.sort((a, b) => b.points - a.points);

  return { levers, totalDeficit };
}
