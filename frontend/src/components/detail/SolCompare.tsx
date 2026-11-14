import type { FC } from 'react';
import type { ChartSeries } from '../../types/chart';

interface SolCompareProps {
  series: ChartSeries[];
}

export const SolCompare: FC<SolCompareProps> = ({ series }) => (
  <div className="sol-compare">
    {series.map((item) => {
      const points = item.points.slice(-2);
      const yesterday = points.length > 1 ? points[0].value : null;
      const today = points.length > 1 ? points[1].value : null;
      return (
        <div className="sol-compare-row" key={item.key}>
          <span className="sol-compare-label">{item.label}</span>
          <div className="sol-bar-wrap">
            <div className="sol-bar"><span style={{ ['--bar-value' as string]: `${yesterday ?? 0}%`, ['--series-color' as string]: `var(${item.colorVar})` }} /></div>
            <small>{yesterday ?? '—'}</small>
          </div>
          <div className="sol-bar-wrap">
            <div className="sol-bar"><span style={{ ['--bar-value' as string]: `${today ?? 0}%`, ['--series-color' as string]: `var(${item.colorVar})` }} /></div>
            <small>{today ?? '—'}</small>
          </div>
        </div>
      );
    })}
    <div className="sol-compare-head"><span /><span>Yesterday</span><span>Today</span></div>
  </div>
);
