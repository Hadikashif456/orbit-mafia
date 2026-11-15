import { useState, useEffect, useMemo } from 'react';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { getCri } from '../api/endpoints';
import type { CRIResult } from '../api/types';

const BATCH_SIZE = 6;

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
 * Fetches CRI history across a range of sols in batches of ~6 requests
 * to avoid backend rate limiting. Shares the exact ['cri', id, sol] query cache.
 */
export function useCriRange(
  crewId: string,
  fromSol: number = 100,
  toSol: number = 145
): UseCriRangeResult {
  const sols = useMemo(() => {
    const list: number[] = [];
    for (let s = fromSol; s <= toSol; s++) {
      list.push(s);
    }
    return list;
  }, [fromSol, toSol]);

  const totalBatches = Math.ceil(sols.length / BATCH_SIZE);
  const [activeBatch, setActiveBatch] = useState<number>(0);

  // Reset active batch index when crewId or range changes
  useEffect(() => {
    setActiveBatch(0);
  }, [crewId, fromSol, toSol]);

  // Define query configurations with batch-level enabled flags
  const queryDefinitions = useMemo(() => {
    return sols.map((sol, index) => {
      const batchIndex = Math.floor(index / BATCH_SIZE);
      const isEnabled = Boolean(crewId) && batchIndex <= activeBatch;

      return {
        queryKey: ['cri', crewId, sol],
        queryFn: () => getCri(crewId, sol),
        enabled: isEnabled,
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 1,
        retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 3000),
        refetchOnWindowFocus: false,
      };
    });
  }, [sols, crewId, activeBatch]);

  const queryResults: UseQueryResult<CRIResult, Error>[] = useQueries({
    queries: queryDefinitions,
  });

  // Advance batch when all queries in the current activeBatch have resolved
  useEffect(() => {
    if (activeBatch >= totalBatches - 1) return;

    const startIdx = activeBatch * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, queryResults.length);
    const batchResults = queryResults.slice(startIdx, endIdx);

    const isBatchFinished = batchResults.every(
      (r) => r.isSuccess || r.isError || (!r.isLoading && !r.isFetching && r.data !== undefined)
    );

    if (isBatchFinished) {
      setActiveBatch((prev) => Math.min(totalBatches - 1, prev + 1));
    }
  }, [activeBatch, totalBatches, queryResults]);

  const data = useMemo(() => {
    return queryResults
      .map((q) => q.data)
      .filter((d): d is CRIResult => d !== undefined)
      .sort((a, b) => a.sol - b.sol);
  }, [queryResults]);

  const loaded = data.length;
  const total = sols.length;
  const errorCount = queryResults.filter((q) => q.isError).length;

  const has429Error = queryResults.some((q) => {
    const err = q.error;
    const msg = err ? String(err.message) : '';
    return msg.includes('429');
  });

  const isFetching = queryResults.some((q) => q.isFetching);
  const isLoading = data.length === 0 && queryResults.some((q) => q.isLoading);

  const refetchAll = () => {
    setActiveBatch(0);
    queryResults.forEach((q) => q.refetch());
  };

  return {
    data,
    isLoading,
    isFetching,
    progress: {
      loaded,
      total,
    },
    errorCount,
    has429Error,
    refetchAll,
  };
}
