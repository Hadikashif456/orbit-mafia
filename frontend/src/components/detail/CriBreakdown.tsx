import type { FC } from 'react';
import type { AstronautSnapshot } from '../../types/astronaut';
import { computeCri, CRI_WEIGHTS } from '../../utils/cri';

interface CriBreakdownProps {
  snapshot: AstronautSnapshot;
  compact?: boolean;
}

export const CriBreakdown: FC<CriBreakdownProps> = ({ snapshot, compact = false }) => {
  const rows = [
    ['Sleep', snapshot.sleep, CRI_WEIGHTS.sleep],
    ['Cardio/HRV', snapshot.cardio, CRI_WEIGHTS.cardio],
    ['Radiation', snapshot.radiation, CRI_WEIGHTS.radiation],
    ['Exercise', snapshot.exercise, CRI_WEIGHTS.exercise],
    ['Mood', snapshot.mood, CRI_WEIGHTS.mood],
  ] as const;
  const total = computeCri(snapshot);
  return (
    <section className={`detail-breakdown ${compact ? 'detail-breakdown--compact' : ''}`} aria-labelledby="breakdown-heading">
      <h2 id="breakdown-heading">How CRI is calculated</h2>
      <div className="detail-formula-list">
        {rows.map(([label, value, weight]) => <div key={label}><span>{label}</span><span>{value} × {Math.round(weight * 100)}% = {(value * weight).toFixed(2)}</span></div>)}
      </div>
      <strong className="detail-total">Total {total.toFixed(2)} → CRI {Math.round(total)}</strong>
    </section>
  );
};
