/**
 * Status thresholds and CRI term weights.
 *
 * Status thresholds:
 * - Green: CRI >= 75
 * - Amber: 50 <= CRI < 75
 * - Red: CRI < 50
 */
export const STATUS_THRESHOLDS = {
  GREEN_MIN: 75,
  AMBER_MIN: 50,
} as const;

/**
 * Heuristic weights for Crew Resilience Index (CRI) v1.
 * Must sum to exactly 1.00.
 */
export const CRI_WEIGHTS = {
  radiation: 0.30,
  sleep: 0.25,
  cardio: 0.25,
  mood: 0.10,
  inflammation: 0.10,
} as const;
