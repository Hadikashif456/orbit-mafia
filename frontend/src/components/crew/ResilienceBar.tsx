import type { FC } from 'react';
import type { CrewStatus } from '../../types/crew';

interface ResilienceBarProps {
  value: number;
  status: CrewStatus;
}

export const ResilienceBar: FC<ResilienceBarProps> = ({ value, status }) => (
  <div className="resilience-bar" aria-label={`${value}% resilience`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
    <span className={`status-${status}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);
