import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCriRange } from '../api/endpoints';
import type { CRIResult } from '../api/types';

export interface UseCriRangeResult {
  data: CRIResult[];
  isLoading: boolean;
  isFetching: boolean;
  progress: {
    loaded: number;
    total: number;
  };
  errorCount: number;
  has429Error: boolean;
  refetchAll: () => void;
}

/**
 * Fetches CRI history across a range of sols in a SINGLE batch request
 * via GET /api/v1/crew/{id}/cri/range?from=&to=.
 * Seeds the individual ['cri', crewId, sol] react-query cache from the result
 * to keep individual sol queries instantaneous.
 */
export function useCriRange(
  crewId: string,
  fromSol: number = 100,
  toSol: number = 145
): UseCriRangeResult {
  const queryClient = useQueryClient();
  const total = Math.max(0, toSol - fromSol + 1);

  const query = useQuery<CRIResult[], Error>({
    queryKey: ['cri-range', crewId, fromSol, toSol],
    queryFn: async () => {
      const results = await getCriRange(crewId, fromSol, toSol);
      return results;
    },
    enabled: Boolean(crewId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Seed the per-sol ['cri', crewId, sol] cache from the range result
  useEffect(() => {
    if (query.data && Array.isArray(query.data)) {
      query.data.forEach((item) => {
        queryClient.setQueryData(['cri', crewId, item.sol], item);
      });
    }
  }, [query.data, crewId, queryClient]);

  const data = query.data || [];
  const loaded = data.length > 0 ? data.length : (query.isLoading ? 0 : 0);
  const has429Error = Boolean(
    query.error && String(query.error.message || '').includes('429')
  );
  const errorCount = query.isError ? 1 : 0;

  return {
    data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    progress: {
      loaded: data.length > 0 ? data.length : loaded,
      total,
    },
    errorCount,
    has429Error,
    refetchAll: () => {
      query.refetch();
    },
  };
}
