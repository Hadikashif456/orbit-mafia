import { useMissionSol } from '../context/SolContext';
import { useAstronautDetail } from './useAstronautDetail';
import type { DailyRow, DetailSnapshot } from '../types/astronaut';

interface UseAstronautResult {
  snapshot: DetailSnapshot | null;
  rows: DailyRow[];
  loading: boolean;
  error: string | null;
}

export const useAstronaut = (id: string | undefined): UseAstronautResult => {
  const { sol } = useMissionSol();
  const { data, isLoading, error } = useAstronautDetail(id, sol);

  if (!id) {
    return {
      snapshot: null,
      rows: [],
      loading: false,
      error: 'No astronaut was selected.',
    };
  }

  return {
    snapshot: data?.snapshot ?? null,
    rows: data?.rows ?? [],
    loading: isLoading,
    error: error ? error.message : null,
  };
};
