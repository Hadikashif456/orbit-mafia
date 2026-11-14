import type { FC } from 'react';

export type ChartRange = 'sol7' | 'sol30';

interface RangeToggleProps {
  value: ChartRange;
  onChange: (range: ChartRange) => void;
}

export const RangeToggle: FC<RangeToggleProps> = ({ value, onChange }) => (
  <div className="detail-range-toggle" role="group" aria-label="Chart range">
    {(['sol7', 'sol30'] as const).map((range) => (
      <button key={range} type="button" aria-pressed={value === range} onClick={() => onChange(range)}>
        {range === 'sol7' ? '7 Sols' : '30 Sols'}
      </button>
    ))}
  </div>
);
