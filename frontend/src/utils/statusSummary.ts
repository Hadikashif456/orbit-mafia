import type { DetailSnapshot } from '../types/astronaut';

export const getStatusSummary = ({ band, cri, trend }: Pick<DetailSnapshot, 'band' | 'cri' | 'trend'>): string[] => {
  const first = trend[0];
  const previous = trend.length > 1 ? trend[trend.length - 2] : first;
  const change = first === undefined || previous === undefined ? null : cri - previous;
  const changeText = change === null ? 'CRI change is unavailable.' : change < 0 ? `CRI dropped ${Math.abs(change)} points recently.` : change > 0 ? `CRI rose ${change} points recently.` : 'CRI is holding steady.';

  return band === 'Green'
    ? [`CRI is ${cri}, in the green range.`, changeText, 'No alert is active.']
    : band === 'Amber'
      ? [`CRI is ${cri}, in the amber range.`, changeText, 'Alert: keep this reading under review.']
      : [`CRI is ${cri}, in the red range.`, changeText, 'Alert: review the available next steps.'];
};
