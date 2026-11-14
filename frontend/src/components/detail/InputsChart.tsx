import { useState, type FC } from 'react';
import type { DailyRow, DetailBand } from '../../types/astronaut';
import { DetailChart } from './DetailChart';
import { RangeToggle, type ChartRange } from './RangeToggle';

interface InputsChartProps {
  rows: DailyRow[];
  band: DetailBand;
  dataLabel: string;
}

export const InputsChart: FC<InputsChartProps> = ({ rows, band, dataLabel }) => {
  const [range, setRange] = useState<ChartRange>('sol30');

  return (
    <section className="detail-panel detail-chart-panel" aria-labelledby="trend-heading">
      <div className="detail-panel-heading">
        <div>
          <span className="detail-eyebrow">Resilience trend</span>
          <h2 id="trend-heading">CRI and Input Trends</h2>
        </div>
        <RangeToggle value={range} onChange={setRange} />
      </div>
      <div className="detail-chart-topline">
        <span className="synthetic-chip">{dataLabel}</span>
      </div>
      <DetailChart rows={rows} range={range} bandColorVar={`--status-${band === 'Green' ? 'optimal' : band === 'Amber' ? 'watch' : 'act-now'}`} />
    </section>
  );
};
