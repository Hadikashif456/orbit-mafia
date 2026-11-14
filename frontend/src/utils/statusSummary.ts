import type { CrewStatus } from '../types/crew';

export const getStatusSummary = (status: CrewStatus): string[] => {
  if (status === 'optimal' || status === 'stable') {
    return ['All five inputs are in a healthy range.', 'No action needed today.'];
  }
  if (status === 'watch') {
    return ['Core inputs remain steady.', 'Sleep and radiation need closer watch today.'];
  }
  return ['Several inputs are outside the target range.', 'Review the recommended actions today.'];
};
