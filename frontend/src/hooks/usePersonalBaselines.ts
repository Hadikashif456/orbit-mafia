import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getVitals } from '../api/endpoints';
import type { VitalPoint } from '../api/types';
import { calculateBand, isOutOfBand, type BaselineBand } from '../lib/baseline';

export type VitalKey = 'hr' | 'hrv' | 'sleepHours' | 'radiationMsv' | 'exerciseMin' | 'mood';

export interface VitalChartPoint {
  sol: number;
  value: number;
  lower: number;
  upper: number;
  mean: number;
  outOfBand: boolean;
}

export interface VitalBaselineMetric {
  key: VitalKey;
  label: string;
  unit: string;
  band: BaselineBand;
  points: VitalChartPoint[];
  outOfBandCount: number;
}

const VITAL_CONFIGS: Array<{ key: VitalKey; label: string; unit: string }> = [
  { key: 'hr', label: 'Heart Rate', unit: 'bpm' },
  { key: 'hrv', label: 'Heart Rate Variability', unit: 'ms' },
  { key: 'sleepHours', label: 'Sleep Duration', unit: 'h' },
  { key: 'radiationMsv', label: 'Radiation Ambient Rate', unit: 'mSv' },
  { key: 'exerciseMin', label: 'Exercise Duration', unit: 'min' },
  { key: 'mood', label: 'Subjective Mood Rating', unit: 'pts' },
];

export function usePersonalBaselines(crewId: string, sol: number = 145) {
  // 1. Baseline window: Sols 1-14
  const baselineQuery = useQuery<VitalPoint[], Error>({
    queryKey: ['vitals', crewId, 30, 14],
    queryFn: () => getVitals(crewId, 30, 14),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: Boolean(crewId),
  });

  // 2. Current window ending at selected sol
  const currentQuery = useQuery<VitalPoint[], Error>({
    queryKey: ['vitals', crewId, 30, sol],
    queryFn: () => getVitals(crewId, 30, sol),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: Boolean(crewId),
  });

  const metrics = useMemo<VitalBaselineMetric[]>(() => {
    if (!baselineQuery.data || !currentQuery.data) return [];

    const baselineData = baselineQuery.data;
    const currentData = currentQuery.data;

    return VITAL_CONFIGS.map(({ key, label, unit }) => {
      // Calculate baseline band from Sols 1-14
      const baselineValues = baselineData.map((d) => d[key]);
      const band = calculateBand(baselineValues);

      let outOfBandCount = 0;
      const points: VitalChartPoint[] = currentData.map((d) => {
        const val = d[key];
        const out = isOutOfBand(val, band.lower, band.upper);
        if (out) outOfBandCount++;

        return {
          sol: d.sol,
          value: val,
          lower: band.lower,
          upper: band.upper,
          mean: band.mean,
          outOfBand: out,
        };
      });

      return {
        key,
        label,
        unit,
        band,
        points,
        outOfBandCount,
      };
    });
  }, [baselineQuery.data, currentQuery.data]);

  const isLoading = baselineQuery.isLoading || currentQuery.isLoading;
  const isError = baselineQuery.isError || currentQuery.isError;
  const error = baselineQuery.error || currentQuery.error;

  return {
    metrics,
    isLoading,
    isError,
    error,
    refetch: () => {
      baselineQuery.refetch();
      currentQuery.refetch();
    },
  };
}
