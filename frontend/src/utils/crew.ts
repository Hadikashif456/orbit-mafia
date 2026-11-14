import type { CrewMember, CrewStatus } from '../types/crew';

export const deriveCrewStatus = (cri: number): CrewStatus => {
  if (cri < 40) return 'act_now';
  if (cri < 60) return 'watch';
  if (cri < 80) return 'stable';
  return 'optimal';
};

export const getCrewStatus = (member: CrewMember): CrewStatus =>
  member.status ?? deriveCrewStatus(member.cri);

export const getTrendLabel = (member: CrewMember): string => {
  const delta = member.cri - member.previousCri;
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  return `${member.previousCri} → ${member.cri} ${arrow} since yesterday`;
};
