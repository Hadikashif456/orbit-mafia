import type { DailyRow } from '../types/astronaut';

const astroTwoValues = (day: number): DailyRow => {
  const progress = (day - 113) / 29;
  return {
    day,
    crew_id: 'C002',
    sleep: Math.round((82 - progress * 27) * 10) / 10,
    cardio: Math.round((78 - progress * 18) * 10) / 10,
    radiation: Math.round((42 + progress * 13) * 10) / 10,
    exercise: Math.round((84 - progress * 14) * 10) / 10,
    mood: Math.round((86 - progress * 16) * 10) / 10,
    cri: Math.round((82 - progress * 21) * 10) / 10,
    band: progress > 0.6 ? 'Amber' : 'Green',
  };
};

const ASTRO_TWO_DAILY: readonly DailyRow[] = Array.from({ length: 30 }, (_, index) => astroTwoValues(113 + index));

export const getMockDailyRows = (id: string): readonly DailyRow[] =>
  id === 'C002' ? ASTRO_TWO_DAILY : Array.from({ length: 7 }, (_, index) => ({
    day: 138 + index,
    crew_id: id,
    sleep: 70 + index,
    cardio: 68 + index,
    radiation: 55,
    exercise: 65 + index,
    mood: 72,
    cri: 72 + index,
    band: 'Green',
  }));

export const getMockCriValues = (id: string): number[] =>
  getMockDailyRows(id).map((row) => row.cri);
