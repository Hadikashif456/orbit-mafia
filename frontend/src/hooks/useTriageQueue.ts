import { useMemo } from 'react';
import { useCrewSummaries } from './useCrewSummaries';
import { rankCrew, type RankedCrewMember } from '../lib/triage';

export function useTriageQueue(sol?: number) {
  const query = useCrewSummaries(sol);

  const rankedCrew = useMemo<RankedCrewMember[]>(() => {
    if (!query.data || query.data.length === 0) return [];
    return rankCrew(query.data);
  }, [query.data]);

  return {
    ...query,
    rankedCrew,
  };
}
