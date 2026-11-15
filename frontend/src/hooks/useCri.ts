import { useQuery } from '@tanstack/react-query';
import { getCri } from '../api/endpoints';
import type { CRIResult } from '../api/types';

export function useCri(id: string | undefined, sol?: number) {
  return useQuery<CRIResult>({
    queryKey: ['cri', id, sol],
    queryFn: () => getCri(id!, sol),
    enabled: Boolean(id),
    staleTime: 30000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
