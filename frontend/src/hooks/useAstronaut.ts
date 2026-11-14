import { useEffect, useState } from 'react';
import { getCrew, getTrend } from '../api/crew';
import type { AstronautSnapshot } from '../types/astronaut';

interface UseAstronautResult {
  snapshot: AstronautSnapshot | null;
  trendResponse: unknown;
  loading: boolean;
  error: string | null;
}

export const useAstronaut = (id: string | undefined): UseAstronautResult => {
  const [snapshot, setSnapshot] = useState<AstronautSnapshot | null>(null);
  const [trendResponse, setTrendResponse] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!id) {
      setError('No astronaut was selected.');
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    setError(null);
    Promise.all([getCrew(id), getTrend(id)])
      .then(([nextSnapshot, nextTrend]) => {
        if (!active) return;
        setSnapshot(nextSnapshot);
        setTrendResponse(nextTrend);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Astronaut data could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [id]);

  return { snapshot, trendResponse, loading, error };
};
