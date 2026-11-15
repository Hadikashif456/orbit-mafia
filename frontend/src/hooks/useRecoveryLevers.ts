import { useMemo } from 'react';
import { useCri } from './useCri';
import { calculateRecoveryLevers } from '../lib/levers';

export function useRecoveryLevers(crewId: string, sol: number) {
  const query = useCri(crewId, sol);

  const { levers, totalDeficit } = useMemo(() => {
    if (!query.data) {
      return { levers: [], totalDeficit: 0 };
    }
    return calculateRecoveryLevers(query.data.contributions, query.data.cri);
  }, [query.data]);

  return {
    ...query,
    levers,
    totalDeficit,
  };
}
