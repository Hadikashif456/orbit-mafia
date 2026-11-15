import { useQuery } from '@tanstack/react-query';
import { getBiomarkers } from '../api/endpoints';
import type { Biomarker } from '../api/types';

export function useBiomarkers(id: string | undefined, names?: string[], panel?: string) {
  return useQuery<Biomarker[]>({
    queryKey: ['biomarkers', id, names, panel],
    queryFn: () => getBiomarkers(id!, names, panel),
    enabled: Boolean(id),
    staleTime: 30000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
