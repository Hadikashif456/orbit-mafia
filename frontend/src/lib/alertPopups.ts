import type { Alert, CrewSummary } from '../api/types';

export const SEVERITY_RANK = {
  watch: 1,
  warning: 2,
  critical: 3,
} as const;

export type Severity = keyof typeof SEVERITY_RANK;

/**
 * Filter alerts to find fresh ones compared to what has been previously seen.
 * - An alert is fresh when its severity rank is higher than seen[crewId] (or crewId unseen).
 * - nextSeen contains ONLY crews that have an alert right now (so a crew that recovered
 *   and alerts again later is shown again).
 * - De-escalation never produces a pop-up.
 */
export function selectNewAlerts(
  alerts: Alert[],
  seen: Record<string, number>
): { fresh: Alert[]; nextSeen: Record<string, number> } {
  const fresh: Alert[] = [];
  const nextSeen: Record<string, number> = {};

  for (const alert of alerts) {
    const rank = SEVERITY_RANK[alert.severity];
    const prevRank = seen[alert.crewId];

    if (prevRank === undefined || rank > prevRank) {
      fresh.push(alert);
    }

    nextSeen[alert.crewId] = Math.max(nextSeen[alert.crewId] ?? 0, rank);
  }

  return { fresh, nextSeen };
}

/**
 * Sort alerts: severity descending, then (criFrom - criTo) descending.
 */
export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => {
    const rankDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (rankDiff !== 0) return rankDiff;
    const dropA = a.criFrom - a.criTo;
    const dropB = b.criFrom - b.criTo;
    return dropB - dropA;
  });
}

/**
 * Fallback mapping for sols outside the replay window.
 * amber -> 'watch', red -> 'critical', green -> none;
 * criFrom = the highest of the previous 3 sparkline values (or cri if none),
 * criTo = cri,
 * drivers = [topDriver],
 * predictedWindowHours 48,
 * message `${callsign} resilience is ${cri} (${status}). Top driver: ${topDriver}.`,
 * id `crew-${id}-${status}`,
 * provenance from the summary.
 */
export function alertsFromCrew(crew: CrewSummary[]): Alert[] {
  const alerts: Alert[] = [];

  for (const c of crew) {
    if (c.status === 'green') continue;

    const severity: 'watch' | 'critical' = c.status === 'amber' ? 'watch' : 'critical';

    let criFrom = c.cri;
    if (c.sparkline && c.sparkline.length > 0) {
      const last3 = c.sparkline.slice(-3);
      criFrom = Math.max(...last3);
    }

    alerts.push({
      id: `crew-${c.id}-${c.status}`,
      crewId: c.id,
      severity,
      criFrom,
      criTo: c.cri,
      drivers: [c.topDriver],
      predictedWindowHours: 48,
      message: `${c.callsign} resilience is ${c.cri} (${c.status}). Top driver: ${c.topDriver}.`,
      provenance: c.provenance,
    });
  }

  return alerts;
}

/**
 * Human-readable severity label.
 */
export function severityLabel(severity: 'watch' | 'warning' | 'critical'): 'WATCH' | 'WARNING' | 'CRITICAL (RED)' {
  switch (severity) {
    case 'watch':
      return 'WATCH';
    case 'warning':
      return 'WARNING';
    case 'critical':
      return 'CRITICAL (RED)';
  }
}
