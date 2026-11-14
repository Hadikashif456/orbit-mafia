import type { AstronautSnapshot, DailyRow } from '../types/astronaut';
import type { ChartSeries } from '../types/chart';

/*
 * To enable all-input lines: make GET /crew/{id}/trend return DailyRow[]
 * (day, crew_id, sleep, cardio, radiation, exercise, mood, cri, band) OR
 * change getDailySeries() in src/api/crew.ts. Nothing else needs to change.
 */

const isDailyRow = (value: unknown): value is DailyRow => {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.day === 'number' &&
    typeof row.crew_id === 'string' &&
    typeof row.sleep === 'number' &&
    typeof row.cardio === 'number' &&
    typeof row.radiation === 'number' &&
    typeof row.exercise === 'number' &&
    typeof row.mood === 'number' &&
    typeof row.cri === 'number' &&
    typeof row.band === 'string';
};

const isDailyRowArray = (value: unknown): value is DailyRow[] =>
  Array.isArray(value) && value.length > 0 && value.every(isDailyRow);

const isCriPointArray = (value: unknown): value is Array<number | { day: number; cri: number }> =>
  Array.isArray(value) && value.every((item) =>
    typeof item === 'number' ||
    (typeof item === 'object' && item !== null && 'day' in item && 'cri' in item &&
      typeof item.day === 'number' && typeof item.cri === 'number'),
  );

const series = (
  key: string,
  label: string,
  points: Array<{ day: number; value: number | null }>,
  colorVar: string,
  emphasis = false,
): ChartSeries => ({ key, label, points, colorVar, emphasis, defaultVisible: true });

export function buildSeries(
  snapshot: AstronautSnapshot,
  trendResponse: unknown,
): { series: ChartSeries[]; mode: 'cri-only' | 'full' } {
  const override = import.meta.env.VITE_CHART_MODE;
  const full = override === 'full' || (override !== 'cri-only' && isDailyRowArray(trendResponse));

  if (full && isDailyRowArray(trendResponse)) {
    return {
      mode: 'full',
      series: [
        series('sleep', 'Sleep', trendResponse.map((row) => ({ day: row.day, value: row.sleep })), '--chart-sleep'),
        series('cardio', 'Cardio', trendResponse.map((row) => ({ day: row.day, value: row.cardio })), '--chart-cardio'),
        series('radiation', 'Radiation', trendResponse.map((row) => ({ day: row.day, value: row.radiation })), '--chart-radiation'),
        series('exercise', 'Exercise', trendResponse.map((row) => ({ day: row.day, value: row.exercise })), '--chart-exercise'),
        series('mood', 'Mood', trendResponse.map((row) => ({ day: row.day, value: row.mood })), '--chart-mood'),
        series('cri', 'CRI', trendResponse.map((row) => ({ day: row.day, value: row.cri })), '--chart-cri', true),
      ],
    };
  }

  const values = isCriPointArray(trendResponse) ? trendResponse : [snapshot.cri];
  return {
    mode: 'cri-only',
    series: [series('cri', 'CRI', values.map((value, index) => (
      typeof value === 'number'
        ? { day: index + 1, value }
        : { day: value.day, value: value.cri }
    )), '--chart-cri', true)],
  };
}
