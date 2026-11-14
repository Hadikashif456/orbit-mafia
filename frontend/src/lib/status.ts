import { STATUS_THRESHOLDS } from './constants';

export type StatusColor = 'green' | 'amber' | 'red';

/**
 * Returns the traffic-light resilience status corresponding to a CRI score.
 *
 * @param cri Crew Resilience Index score (0 to 100)
 * @returns 'green' (>=75), 'amber' (50..74.99), or 'red' (<50)
 */
export function getStatus(cri: number): StatusColor {
  if (cri >= STATUS_THRESHOLDS.GREEN_MIN) {
    return 'green';
  }
  if (cri >= STATUS_THRESHOLDS.AMBER_MIN) {
    return 'amber';
  }
  return 'red';
}
