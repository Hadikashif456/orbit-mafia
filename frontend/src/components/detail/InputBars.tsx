import type { FC } from 'react';
import type { DetailSnapshot } from '../../types/astronaut';

interface InputBarsProps {
  snapshot: DetailSnapshot;
}

const INPUTS = [
  ['Sleep', 'sleep'],
  ['Cardiovascular / HRV', 'cardio'],
  ['Radiation', 'radiation'],
  ['Exercise', 'exercise'],
  ['Mood', 'mood'],
] as const;

export const InputBars: FC<InputBarsProps> = ({ snapshot }) => (
  <div className="detail-input-bars">
    {INPUTS.map(([label, key]) => {
      const value = snapshot[key];
      return (
        <div className="detail-input" key={key}>
          <div className="detail-input-head">
            <span>{label}</span>
            <strong>{value ?? '—'}</strong>
          </div>
          <div className="detail-input-track">
            <span style={{ width: value === null ? '0%' : `${Math.max(0, Math.min(100, value))}%` }} />
          </div>
        </div>
      );
    })}
  </div>
);
