export type CrewStatus = 'act_now' | 'watch' | 'stable' | 'optimal';

export interface CrewMember {
  id: string;
  code: string;
  name: string;
  role: string;
  cri: number;
  previousCri: number;
  status?: CrewStatus;
}
