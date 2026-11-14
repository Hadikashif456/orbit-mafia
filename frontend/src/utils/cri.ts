import type { AstronautSnapshot } from '../types/astronaut';

export const CRI_WEIGHTS = {
  sleep: 0.25,
  cardio: 0.25,
  radiation: 0.2,
  exercise: 0.15,
  mood: 0.15,
} as const;

export const computeCri = (snapshot: Pick<AstronautSnapshot, 'sleep' | 'cardio' | 'radiation' | 'exercise' | 'mood'>): number =>
  snapshot.sleep * CRI_WEIGHTS.sleep +
  snapshot.cardio * CRI_WEIGHTS.cardio +
  snapshot.radiation * CRI_WEIGHTS.radiation +
  snapshot.exercise * CRI_WEIGHTS.exercise +
  snapshot.mood * CRI_WEIGHTS.mood;
