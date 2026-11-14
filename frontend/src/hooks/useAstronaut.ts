import { useMemo } from 'react';
import { getAstronautSnapshot, getDailyRows } from '../data/detailSource';
import type { DetailSnapshot } from '../types/astronaut';

interface UseAstronautResult {
  snapshot: DetailSnapshot | null;
  rows: ReturnType<typeof getDailyRows>;
  loading: boolean;
  error: string | null;
}

export const useAstronaut = (id: string | undefined): UseAstronautResult => {
  return useMemo(() => {
    if (!id) return { snapshot: null, rows: [], loading: false, error: 'No astronaut was selected.' };
    const snapshot = getAstronautSnapshot(id);
    if (!snapshot) return { snapshot: null, rows: [], loading: false, error: 'Astronaut data is unavailable.' };
    return { snapshot, rows: getDailyRows(id, 'sol30'), loading: false, error: null };
  }, [id]);
};
