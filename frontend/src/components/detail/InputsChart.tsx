import { useMemo, useState, type FC } from 'react';
import type { AstronautSnapshot } from '../../types/astronaut';
import { buildSeries } from '../../api/trendAdapter';
import { RangeToggle, type ChartRange } from './RangeToggle';
import { SolCompare } from './SolCompare';
import { TrendChart } from './TrendChart';

interface InputsChartProps {
  snapshot: AstronautSnapshot;
  trendResponse: unknown;
}

export const InputsChart: FC<InputsChartProps> = ({ snapshot, trendResponse }) => {
  const [range, setRange] = useState<ChartRange>('sol30');
  const chart = useMemo(() => buildSeries(snapshot, trendResponse), [snapshot, trendResponse]);

  return (
    <section className="detail-panel detail-chart-panel" aria-labelledby="trend-heading">
      <div className="detail-panel-heading">
        <div>
          <span className="detail-eyebrow">Resilience trend</span>
          <h2 id="trend-heading">CRI and Input Trends</h2>
        </div>
        <RangeToggle value={range} onChange={setRange} />
      </div>
      {range === 'sol30' ? (
        <TrendChart
          series={chart.series}
          range={range}
          ariaSummary={`Daily resilience chart with ${chart.series.length} series`}
          thresholds={[60, 75]}
          syntheticLabel="Synthetic demo data"
        />
      ) : (
        <SolCompare series={chart.series} />
      )}
    </section>
  );
};
