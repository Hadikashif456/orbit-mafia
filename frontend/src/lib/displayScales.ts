/**
 * DISPLAY-ONLY SCALES
 *
 * NOTE: These are normalized 0–100 display-only gauges intended for frontend
 * visualization cards and radar/trend charts. They are NOT clinical diagnostic
 * scores and do NOT represent the Crew Resilience Index (CRI) calculation.
 */

export const SLEEP_BASELINE_HOURS = 8;
export const EXERCISE_BASELINE_MIN = 60;
export const MOOD_MIN_RATING = 1;
export const MOOD_MAX_RATING = 5;
export const RADIATION_MAX_MSV = 10;
export const DEFAULT_HR_BASE = 70;
export const DEFAULT_HRV_BASE = 50;

export const clamp = (val: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, val));

export const round1 = (val: number): number =>
  Math.round(val * 10) / 10;

/**
 * Normalized display score for sleep: clamp(sleepHours / 8 * 100)
 */
export function computeSleepScore(sleepHours: number): number {
  return round1(clamp((sleepHours / SLEEP_BASELINE_HOURS) * 100));
}

/**
 * Normalized display score for exercise: clamp(exerciseMin / 60 * 100)
 */
export function computeExerciseScore(exerciseMin: number): number {
  return round1(clamp((exerciseMin / EXERCISE_BASELINE_MIN) * 100));
}

/**
 * Normalized display score for mood: clamp((mood - 1) / 4 * 100)
 */
export function computeMoodScore(mood: number): number {
  return round1(clamp(((mood - MOOD_MIN_RATING) / (MOOD_MAX_RATING - MOOD_MIN_RATING)) * 100));
}

/**
 * Normalized display score for radiation: clamp(100 - radiationMsv / 10 * 100)
 */
export function computeRadiationScore(radiationMsv: number): number {
  return round1(clamp(100 - (radiationMsv / RADIATION_MAX_MSV) * 100));
}

/**
 * Normalized display score for cardio:
 * clamp(50 * (hrv / hrvBase) + 50 * (hrBase / hr))
 * where hrBase/hrvBase are the crew member's Sol 1–14 baseline means.
 * At baseline (hr === hrBase and hrv === hrvBase), this equals exactly 100.
 */
export function computeCardioScore(
  hr: number,
  hrv: number,
  baseline?: { hrBase: number; hrvBase: number }
): number {
  const hrBase = baseline && baseline.hrBase > 0 ? baseline.hrBase : (hr > 0 ? hr : DEFAULT_HR_BASE);
  const hrvBase = baseline && baseline.hrvBase > 0 ? baseline.hrvBase : (hrv > 0 ? hrv : DEFAULT_HRV_BASE);
  const hrTerm = hr > 0 ? hrBase / hr : 1;
  const hrvTerm = hrvBase > 0 ? hrv / hrvBase : 1;
  return round1(clamp(50 * hrvTerm + 50 * hrTerm));
}

export interface DisplayScores {
  sleep: number;
  cardio: number;
  radiation: number;
  exercise: number;
  mood: number;
}

export function toDisplayScores(
  vital: {
    sleepHours: number;
    exerciseMin: number;
    mood: number;
    radiationMsv: number;
    hr: number;
    hrv: number;
  },
  baseline?: { hrBase: number; hrvBase: number }
): DisplayScores {
  return {
    sleep: computeSleepScore(vital.sleepHours),
    cardio: computeCardioScore(vital.hr, vital.hrv, baseline),
    radiation: computeRadiationScore(vital.radiationMsv),
    exercise: computeExerciseScore(vital.exerciseMin),
    mood: computeMoodScore(vital.mood),
  };
}
