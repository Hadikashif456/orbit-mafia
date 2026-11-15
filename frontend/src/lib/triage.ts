import type { CrewSummary } from '../api/types';

export interface RankedCrewMember {
  rank: number;
  member: CrewSummary;
  recentDrop: number;
  reason: string;
}

const STATUS_PRIORITY: Record<string, number> = {
  red: 3,
  amber: 2,
  green: 1,
};

/**
 * Calculates recent CRI drop from the sparkline (previous sol - current sol).
 */
export function calculateRecentDrop(sparkline: number[]): number {
  if (!sparkline || sparkline.length < 2) return 0;
  const prev = sparkline[sparkline.length - 2];
  const curr = sparkline[sparkline.length - 1];
  return Math.max(0, Number((prev - curr).toFixed(1)));
}

/**
 * Generates an informative one-line explanation of why this crew member is placed at their rank.
 */
export function generateRankReason(member: CrewSummary, rank: number, recentDrop: number): string {
  const statusUpper = member.status.toUpperCase();
  if (member.status === 'red') {
    return `Rank #${rank}: Critical severity with lowest CRI (${member.cri.toFixed(1)}) and ${recentDrop > 0 ? `${recentDrop} pt drop` : 'severe baseline divergence'} driven by ${member.topDriver}.`;
  }
  if (member.status === 'amber') {
    return `Rank #${rank}: Elevated ${statusUpper} risk flag (CRI ${member.cri.toFixed(1)}) requiring intervention for ${member.topDriver}.`;
  }
  return `Rank #${rank}: Nominal ${statusUpper} status (CRI ${member.cri.toFixed(1)}) with stable telemetry and nominal reserve.`;
}

/**
 * Pure ranking function:
 * 1. Status severity first (red > amber > green)
 * 2. Lowest CRI (lower score means higher medical priority)
 * 3. Largest recent CRI drop
 */
export function rankCrew(crew: CrewSummary[]): RankedCrewMember[] {
  if (!crew || crew.length === 0) return [];

  const sorted = [...crew].sort((a, b) => {
    // 1. Status severity
    const prioA = STATUS_PRIORITY[a.status] || 0;
    const prioB = STATUS_PRIORITY[b.status] || 0;
    if (prioB !== prioA) {
      return prioB - prioA;
    }

    // 2. Lowest CRI
    if (Math.abs(a.cri - b.cri) > 0.01) {
      return a.cri - b.cri;
    }

    // 3. Largest recent CRI drop
    const dropA = calculateRecentDrop(a.sparkline);
    const dropB = calculateRecentDrop(b.sparkline);
    if (Math.abs(dropB - dropA) > 0.01) {
      return dropB - dropA;
    }

    return a.id.localeCompare(b.id);
  });

  return sorted.map((member, index) => {
    const rank = index + 1;
    const recentDrop = calculateRecentDrop(member.sparkline);
    return {
      rank,
      member,
      recentDrop,
      reason: generateRankReason(member, rank, recentDrop),
    };
  });
}
