import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { getBiomarkers } from '../api/endpoints';
import type { Biomarker } from '../api/types';

export function useRecoveryBiomarkers(
  crewIds: string[],
  panel?: string
): UseQueryResult<Biomarker[], Error>[] {
  return useQueries({
    queries: crewIds.map((id) => ({
      queryKey: ['biomarkers', id, undefined, panel],
      queryFn: () => getBiomarkers(id, undefined, panel),
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    })),
  });
}
