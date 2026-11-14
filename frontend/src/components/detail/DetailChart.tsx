// Replace the drawing inside this file. Keep the props contract.

import type { CSSProperties, FC } from 'react';
import type { DailyRow } from '../../types/astronaut';

interface DetailChartProps {
  rows: DailyRow[];
  range: 'sol7' | 'sol30';
  bandColorVar: string;
}

const WIDTH = 720;
const HEIGHT = 300;
const PADDING = { top: 24, right: 24, bottom: 34, left: 38 };
const SERIES = [
  ['sleep', 'Sleep', '--chart-sleep'],
  ['cardio', 'Cardio', '--chart-cardio'],
  ['radiation', 'Radiation', '--chart-radiation'],
  ['exercise', 'Exercise', '--chart-exercise'],
  ['mood', 'Mood', '--chart-mood'],
] as const;

export const DetailChart: FC<DetailChartProps> = ({ rows, range, bandColorVar }) => {
  const visibleRows = range === 'sol7' ? rows.slice(-7) : rows;
  const x = (index: number): number =>
    PADDING.left + (index / Math.max(1, visibleRows.length - 1)) * (WIDTH - PADDING.left - PADDING.right);
  const y = (value: number): number =>
    PADDING.top + (1 - Math.max(0, Math.min(100, value)) / 100) * (HEIGHT - PADDING.top - PADDING.bottom);
  const pathFor = (key: keyof Omit<DailyRow, 'day' | 'crew_id' | 'band'>): string =>
    visibleRows.map((row, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(row[key])}`).join(' ');

  return (
    <svg
      className="detail-trend-chart"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Daily input trend chart for ${visibleRows.length} sols`}
      style={{ '--detail-chart-color': `var(${bandColorVar})` } as CSSProperties}
    >
      {[60, 75].map((threshold) => (
        <g key={threshold}>
          <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y(threshold)} y2={y(threshold)} className="chart-threshold" />
          <text x={8} y={y(threshold) + 4} className="chart-axis-label">{threshold}</text>
        </g>
      ))}
      <line x1={PADDING.left} x2={PADDING.left} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} className="chart-axis" />
      <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={HEIGHT - PADDING.bottom} y2={HEIGHT - PADDING.bottom} className="chart-axis" />
      {SERIES.map(([key, label, colorVar]) => (
        <path
          key={key}
          d={pathFor(key)}
          className="chart-line"
          style={{ '--series-color': `var(${colorVar})` } as CSSProperties}
          aria-label={label}
        >
          <title>{label}</title>
        </path>
      ))}
      <path d={pathFor('cri')} className="chart-line is-emphasis" style={{ '--series-color': 'var(--detail-chart-color)' } as CSSProperties}>
        <title>CRI</title>
      </path>
      {visibleRows.length > 0 && (
        <circle
          cx={x(visibleRows.length - 1)}
          cy={y(visibleRows[visibleRows.length - 1].cri)}
          r="5"
          className="chart-latest-dot"
        />
      )}
    </svg>
  );
};
