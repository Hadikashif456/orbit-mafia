import type { CrewMember, CrewStatus } from '../types/crew';
import type { DailyRow, DetailBand, DetailSnapshot } from '../types/astronaut';
import type { CrewSummary, CRIResult, TrendPoint, VitalPoint, Status } from './types';
import { round1, toDisplayScores } from '../lib/displayScales';

/**
 * Maps API resilience status enum to DetailBand ('Green' | 'Amber' | 'Red').
 */
export function statusToBand(status: Status | string): DetailBand {
  switch (status.toLowerCase()) {
    case 'red':
      return 'Red';
    case 'amber':
      return 'Amber';
    case 'green':
    default:
      return 'Green';
  }
}

/**
 * Maps API resilience status enum to CrewStatus ('act_now' | 'watch' | 'optimal').
 * Never re-derive status from CRI in the UI; use the authoritative API status.
 */
export function statusToCrewStatus(status: Status | string): CrewStatus {
  switch (status.toLowerCase()) {
    case 'red':
      return 'act_now';
    case 'amber':
      return 'watch';
    case 'green':
    default:
      return 'optimal';
  }
}

/**
 * Converts a backend CrewSummary into the frontend CrewMember model.
 */
export function toCrewMember(summary: CrewSummary): CrewMember {
  const cri = round1(summary.cri);
  const sparkline = summary.sparkline ?? [];
  const previousCri = sparkline.length >= 2 ? round1(sparkline[sparkline.length - 2]) : cri;

  return {
    id: summary.id,
    code: `CM-${summary.id.slice(-2)}`,
    name: summary.callsign,
    role: summary.topDriver,
    cri,
    previousCri,
    status: statusToCrewStatus(summary.status),
  };
}

/**
 * Joins time-series trend and vitals points by mission sol into DailyRow display models.
 */
export function toDailyRows(
  id: string,
  trend: TrendPoint[],
  vitals: VitalPoint[],
  baseline?: { hrBase: number; hrvBase: number }
): DailyRow[] {
  const vitalsBySol = new Map<number, VitalPoint>();
  for (const v of vitals) {
    vitalsBySol.set(v.sol, v);
  }

  return trend
    .map((tp) => {
      const v = vitalsBySol.get(tp.sol);
      const scores = v
        ? toDisplayScores(v, baseline)
        : { sleep: 70, cardio: 70, radiation: 70, exercise: 70, mood: 70 };

      return {
        day: tp.sol,
        crew_id: id,
        cri: round1(tp.cri),
        band: statusToBand(tp.status),
        sleep: scores.sleep,
        cardio: scores.cardio,
        radiation: scores.radiation,
        exercise: scores.exercise,
        mood: scores.mood,
      };
    })
    .sort((a, b) => a.day - b.day);
}

/**
 * Builds a DetailSnapshot for an astronaut from summary, CRI calculation, and daily rows.
 */
export function toDetailSnapshot(
  summary: CrewSummary,
  cri: CRIResult,
  rows: DailyRow[]
): DetailSnapshot {
  const latestRow = rows[rows.length - 1];
  const last6Cri = rows.slice(-6).map((r) => r.cri);
  const dataLabel = summary.provenance === 'SYNTHETIC'
    ? 'Synthetic data'
    : summary.provenance === 'REAL_OSDR'
    ? 'NASA OSDR data'
    : 'Synthetic data';

  return {
    id: summary.id,
    name: summary.callsign,
    role: summary.topDriver,
    cri: round1(cri.cri),
    band: statusToBand(cri.status),
    sleep: latestRow?.sleep ?? 0,
    cardio: latestRow?.cardio ?? 0,
    radiation: latestRow?.radiation ?? 0,
    exercise: latestRow?.exercise ?? 0,
    mood: latestRow?.mood ?? 0,
    trend: last6Cri,
    data_label: dataLabel,
  };
}
