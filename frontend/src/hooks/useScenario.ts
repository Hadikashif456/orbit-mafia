import { useQuery } from '@tanstack/react-query';
import { getScenario } from '../api/endpoints';
import type { ScenarioState } from '../api/types';

export function useScenario(sol: number) {
  return useQuery<ScenarioState>({
    queryKey: ['scenario', sol],
    queryFn: () => getScenario(sol),
    placeholderData: (prev) => prev,
    staleTime: 30000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
