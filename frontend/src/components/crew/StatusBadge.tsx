import type { FC } from 'react';
import type { CrewStatus } from '../../types/crew';

const LABELS: Record<CrewStatus, string> = {
  act_now: 'Act now',
  watch: 'Watch',
  stable: 'Stable',
  optimal: 'Optimal',
};

interface StatusBadgeProps {
  status: CrewStatus;
}

export const StatusBadge: FC<StatusBadgeProps> = ({ status }) => (
  <div className={`status-badge status-${status}`}>
    <span className="status-dot" aria-hidden="true" />
    <span>{LABELS[status]}</span>
  </div>
);
