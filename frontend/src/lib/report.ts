import type { ScenarioEvent, Alert, CRIResult } from '../api/types';
import { calculateRecoveryLevers, type RecoveryLever } from './levers';

export interface IncidentReportSummary {
  crewId: string;
  sol: number;
  cri: number;
  status: string;
  contributions: CRIResult['contributions'];
  topLevers: RecoveryLever[];
  events: ScenarioEvent[];
  alerts: Alert[];
}

/**
 * Filter scenario events up to the selected sol, matching optional crewId or global events.
 * Returns sorted chronologically or reverse chronologically (newest first).
 */
export function filterScenarioEventsUpToSol(
  events: ScenarioEvent[] | undefined,
  sol: number,
  crewId?: string
): ScenarioEvent[] {
  if (!events) return [];
  return events
    .filter((event) => event.sol <= sol && (!event.crewId || !crewId || event.crewId === crewId))
    .sort((a, b) => b.sol - a.sol);
}

/**
 * Filter active scenario alerts for the specified crew member.
 */
export function filterAlertsForCrew(
  alerts: Alert[] | undefined,
  crewId: string
): Alert[] {
  if (!alerts) return [];
  return alerts.filter((alert) => alert.crewId === crewId);
}

/**
 * Assembles complete incident report package for a crew member at a given sol.
 */
export function buildIncidentReportData(params: {
  crewId: string;
  sol: number;
  criResult: CRIResult;
  allEvents?: ScenarioEvent[];
  alerts?: Alert[];
}): IncidentReportSummary {
  const { crewId, sol, criResult, allEvents, alerts } = params;
  const filteredEvents = filterScenarioEventsUpToSol(allEvents, sol, crewId);
  const crewAlerts = filterAlertsForCrew(alerts, crewId);
  const { levers } = calculateRecoveryLevers(criResult.contributions, criResult.cri);
  const topLevers = levers.slice(0, 3);

  return {
    crewId,
    sol,
    cri: criResult.cri,
    status: criResult.status,
    contributions: criResult.contributions,
    topLevers,
    events: filteredEvents,
    alerts: crewAlerts,
  };
}
