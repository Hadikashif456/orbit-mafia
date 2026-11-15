import { useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMissionSol } from '../context/SolContext';
import { REPLAY_FIRST_SOL, REPLAY_LAST_SOL } from '../lib/mission';
import { getScenario, getCrew } from '../api/endpoints';
import { isUsingMock } from '../api/client';
import { alertsFromCrew } from '../lib/alertPopups';
import type { Alert, CrewSummary } from '../api/types';

export interface AlertWatcherResult {
  sol: number;
  alerts: Alert[];
  callsigns: Record<string, string>;
  usingMock: boolean;
}

export function useAlertWatcher(): AlertWatcherResult {
  const { sol } = useMissionSol();
  const isReplayWindow = sol >= REPLAY_FIRST_SOL && sol <= REPLAY_LAST_SOL;

  const { data, error } = useQuery<{ alerts: Alert[]; crew: CrewSummary[] }>({
    queryKey: ['alert-watch', sol],
    queryFn: async () => {
      if (isReplayWindow) {
        const scenario = await getScenario(sol);
        return {
          alerts: scenario.alerts,
          crew: scenario.crew,
        };
      } else {
        const crew = await getCrew(sol);
        return {
          alerts: alertsFromCrew(crew),
          crew,
        };
      }
    },
    refetchInterval: 30000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const lastWarnedErrorRef = useRef<unknown>(null);
  useEffect(() => {
    if (error && error !== lastWarnedErrorRef.current) {
      console.warn('[useAlertWatcher] Failed to fetch alerts:', error);
      lastWarnedErrorRef.current = error;
    }
  }, [error]);

  const callsigns = useMemo(() => {
    const map: Record<string, string> = {};
    if (data?.crew) {
      for (const c of data.crew) {
        map[c.id] = c.callsign;
      }
    }
    return map;
  }, [data?.crew]);

  return {
    sol,
    alerts: error ? [] : (data?.alerts ?? []),
    callsigns,
    usingMock: isUsingMock(),
  };
}
