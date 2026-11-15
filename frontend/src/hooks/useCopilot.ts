import { useMutation, useQuery } from '@tanstack/react-query';
import { explainRisk } from '../api/endpoints';
import type { CopilotResponse } from '../api/types';

export function useCopilot() {
  return useMutation<CopilotResponse, Error, { crewId: string; sol: number }>({
    mutationFn: (variables) => explainRisk(variables),
  });
}

export function useCopilotExplanation(crewId: string | undefined, sol: number) {
  return useQuery<CopilotResponse>({
    queryKey: ['copilot-explanation', crewId, sol],
    queryFn: () => explainRisk({ crewId: crewId!, sol }),
    enabled: Boolean(crewId),
    staleTime: 30000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
