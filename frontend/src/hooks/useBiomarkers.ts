import { useQuery } from '@tanstack/react-query';
import { getBiomarkers } from '../api/endpoints';
import type { Biomarker } from '../api/types';

export function useBiomarkers(id: string | undefined, names?: string[]) {
  return useQuery<Biomarker[]>({
    queryKey: ['biomarkers', id, names],
    queryFn: () => getBiomarkers(id!, names),
    enabled: Boolean(id),
    staleTime: 30000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
