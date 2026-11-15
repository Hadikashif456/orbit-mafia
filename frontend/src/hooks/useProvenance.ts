import { useQuery } from '@tanstack/react-query';
import { getProvenance } from '../api/endpoints';
import type { ProvenanceResponse } from '../api/types';

export function useProvenance() {
  return useQuery<ProvenanceResponse>({
    queryKey: ['provenance'],
    queryFn: () => getProvenance(),
    staleTime: 30000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
