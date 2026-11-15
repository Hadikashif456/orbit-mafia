import { useQuery } from '@tanstack/react-query';
import { getCrew, getCri, getTrend, getVitals } from '../api/endpoints';
import { toDailyRows, toDetailSnapshot } from '../api/adapters';
import type { DailyRow, DetailSnapshot } from '../types/astronaut';

export interface AstronautDetailResult {
  snapshot: DetailSnapshot | null;
  rows: DailyRow[];
}

export function useAstronautDetail(id: string | undefined, sol?: number) {
  return useQuery<AstronautDetailResult>({
    queryKey: ['astronaut-detail', id, sol],
    queryFn: async () => {
      if (!id) {
        throw new Error('No astronaut ID provided');
      }

      // Fetch summary, CRI calculation, 30-day trend, 30-day vitals, and baseline vitals in parallel
      const [summaries, criResult, trend30, vitals30, baselineVitals] = await Promise.all([
        getCrew(sol),
        getCri(id, sol),
        getTrend(id, 30, sol),
        getVitals(id, 30, sol),
        getVitals(id, 30, 14),
      ]);

      const summary = summaries.find((s) => s.id === id);
      if (!summary) {
        throw new Error(`Crew member ${id} not found in crew summaries`);
      }

      // Compute Sol 1–14 baseline means for HR and HRV
      const sol1To14 = baselineVitals.filter((v) => v.sol >= 1 && v.sol <= 14);
      const hrBase = sol1To14.length > 0
        ? sol1To14.reduce((sum, v) => sum + v.hr, 0) / sol1To14.length
        : 70;
      const hrvBase = sol1To14.length > 0
        ? sol1To14.reduce((sum, v) => sum + v.hrv, 0) / sol1To14.length
        : 50;

      const rows = toDailyRows(id, trend30, vitals30, { hrBase, hrvBase });
      const snapshot = toDetailSnapshot(summary, criResult, rows);

      return { snapshot, rows };
    },
    enabled: Boolean(id),
    staleTime: 30000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
