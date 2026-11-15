import { useQuery } from '@tanstack/react-query';
import { getCrew } from '../api/endpoints';
import type { CrewSummary } from '../api/types';

export function useCrewSummaries(sol?: number) {
  return useQuery<CrewSummary[]>({
    queryKey: ['crew', sol],
    queryFn: () => getCrew(sol),
    staleTime: 30000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
