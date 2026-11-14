import { useEffect, useMemo, useState, type FC, type MouseEvent as ReactMouseEvent } from 'react';
import type { ChartSeries } from '../../types/chart';

interface TrendChartProps {
  series: ChartSeries[];
  range: 'sol1' | 'sol30';
  ariaSummary: string;
  thresholds?: number[];
  syntheticLabel: string;
}

const WIDTH = 720;
const HEIGHT = 300;
const PADDING = { top: 24, right: 24, bottom: 34, left: 38 };

export const TrendChart: FC<TrendChartProps> = ({
  series,
  range,
  ariaSummary,
  thresholds = [60, 75],
  syntheticLabel,
}) => {
  const [visible, setVisible] = useState<Record<string, boolean>>(
    () => Object.fromEntries(series.map((item) => [item.key, item.defaultVisible])),
  );
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const activeSeries = series.filter((item) => visible[item.key]);
  useEffect(() => {
    setVisible(Object.fromEntries(series.map((item) => [item.key, visible[item.key] ?? item.defaultVisible])));
  }, [series]);
  const days = useMemo(() => {
    const allDays = series.flatMap((item) => item.points.map((point) => point.day));
    return [...new Set(allDays)].sort((a, b) => a - b).slice(range === 'sol30' ? -30 : -2);
  }, [series, range]);
  const x = (day: number): number => {
    const index = Math.max(0, days.indexOf(day));
    return PADDING.left + (index / Math.max(1, days.length - 1)) * (WIDTH - PADDING.left - PADDING.right);
  };
  const y = (value: number): number => PADDING.top + (1 - Math.max(0, Math.min(100, value)) / 100) * (HEIGHT - PADDING.top - PADDING.bottom);
  const hoverIndex = hoverDay === null ? -1 : days.indexOf(hoverDay);

  const move = (event: ReactMouseEvent<SVGRectElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left) / bounds.width;
    const index = Math.round(ratio * Math.max(1, days.length - 1));
    setHoverDay(days[Math.max(0, Math.min(days.length - 1, index))] ?? null);
  };

  return (
    <div className="detail-chart-shell">
      <div className="detail-chart-topline">
        <span className="synthetic-chip">{syntheticLabel}</span>
        {series.length === 1 ? <span className="chart-single-label">CRI</span> : (
          <div className="chart-legend">
            {series.map((item) => (
              <button
                key={item.key}
                type="button"
                className={item.emphasis ? 'is-emphasis' : ''}
                aria-pressed={visible[item.key]}
                onClick={() => !item.emphasis && setVisible((current) => ({ ...current, [item.key]: !current[item.key] }))}
              >
                <i style={{ ['--series-color' as string]: `var(${item.colorVar})` }} />
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <svg className="detail-trend-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={ariaSummary}>
        {thresholds.map((threshold) => (
          <g key={threshold}>
            <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y(threshold)} y2={y(threshold)} className="chart-threshold" />
            <text x={8} y={y(threshold) + 4} className="chart-axis-label">{threshold}</text>
          </g>
        ))}
        <line x1={PADDING.left} x2={PADDING.left} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} className="chart-axis" />
        <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={HEIGHT - PADDING.bottom} y2={HEIGHT - PADDING.bottom} className="chart-axis" />
        {activeSeries.map((item) => {
          const path = item.points
            .filter((point) => days.includes(point.day) && point.value !== null)
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.day)} ${y(point.value ?? 0)}`)
            .join(' ');
          return <path key={item.key} d={path} className={`chart-line ${item.emphasis ? 'is-emphasis' : ''}`} style={{ ['--series-color' as string]: `var(${item.colorVar})` }} />;
        })}
        {activeSeries.filter((item) => item.emphasis).map((item) => {
          const latest = [...item.points].reverse().find((point) => point.value !== null);
          if (!latest) return null;
          return (
            <g key={`${item.key}-latest`} className="chart-latest" style={{ ['--series-color' as string]: `var(${item.colorVar})` }}>
              <circle cx={x(latest.day)} cy={y(latest.value ?? 0)} r="5" />
              <text x={x(latest.day) + 9} y={y(latest.value ?? 0) - 8}>{item.label}: {latest.value}</text>
            </g>
          );
        })}
        <rect x={PADDING.left} y={PADDING.top} width={WIDTH - PADDING.left - PADDING.right} height={HEIGHT - PADDING.top - PADDING.bottom} className="chart-hit-area" onMouseMove={move} onMouseLeave={() => setHoverDay(null)} />
        {hoverDay !== null && <line x1={x(hoverDay)} x2={x(hoverDay)} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} className="chart-hover-line" />}
      </svg>
      {hoverDay !== null && (
        <div className="chart-tooltip" style={{ left: `${Math.min(86, Math.max(14, (hoverIndex / Math.max(1, days.length - 1)) * 100))}%` }}>
          <strong>Sol {hoverDay}</strong>
          {activeSeries.map((item) => {
            const point = item.points.find((candidate) => candidate.day === hoverDay);
            return <span key={item.key}>{item.label}: {point?.value ?? '—'}</span>;
          })}
        </div>
      )}
    </div>
  );
};
