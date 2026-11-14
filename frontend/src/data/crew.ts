import type { CrewMember } from '../types/crew';

export const CREW_MEMBERS: readonly CrewMember[] = [
  { id: 'C001', code: 'CM-01', name: 'Dr. Kenji Mori', role: 'Medical Officer', cri: 54, previousCri: 71, status: 'act_now' },
  { id: 'C002', code: 'CM-02', name: 'Emily Carter', role: 'Mission Commander', cri: 82, previousCri: 80, status: 'optimal' },
  { id: 'C003', code: 'CM-03', name: 'Yuki Tanaka', role: 'Flight Engineer', cri: 67, previousCri: 72, status: 'watch' },
  { id: 'C004', code: 'CM-04', name: 'Eman Fatima', role: 'Bioastronautics & Systems Lead', cri: 76, previousCri: 74, status: 'stable' },
];
