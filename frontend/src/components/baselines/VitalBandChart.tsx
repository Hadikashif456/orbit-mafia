import type { FC } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import type { VitalBaselineMetric } from '../../hooks/usePersonalBaselines';

export interface VitalBandChartProps {
  metric: VitalBaselineMetric;
}

export const VitalBandChart: FC<VitalBandChartProps> = ({ metric }) => {
  const { label, unit, band, points, outOfBandCount } = metric;

  // Chart data preparing upper/lower area band
  const chartData = points.map((p) => ({
    sol: p.sol,
    value: p.value,
    base: p.lower,
    bandHeight: Math.max(0, p.upper - p.lower),
    upper: p.upper,
    lower: p.lower,
    mean: p.mean,
    outOfBand: p.outOfBand,
  }));

  const yMin = Math.floor(Math.min(...points.map((p) => p.value), band.lower) * 0.95);
  const yMax = Math.ceil(Math.max(...points.map((p) => p.value), band.upper) * 1.05);

  return (
    <article
      className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur shadow flex flex-col gap-3"
      aria-label={`${label} personal baseline band chart`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            {label}
            <span className="text-[10px] font-mono font-normal text-slate-400">({unit})</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            Baseline: {band.mean} &plusmn; {(2 * band.std).toFixed(1)} [{band.lower} &ndash; {band.upper}]
          </span>
        </div>
        {outOfBandCount > 0 ? (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800">
            {outOfBandCount} out-of-band sol{outOfBandCount > 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
            Within baseline
          </span>
        )}
      </div>

      {/* Screen-reader hidden summary */}
      <div className="sr-only">
        {label} baseline is {band.mean} with range {band.lower} to {band.upper}. {outOfBandCount} of {points.length} sols diverge from baseline.
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
            <XAxis
              dataKey="sol"
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              tickFormatter={(sol) => `S${sol}`}
            />
            <YAxis
              stroke="#64748b"
              fontSize={10}
              domain={[yMin, yMax]}
              tickLine={false}
              width={35}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-700 text-xs shadow-xl font-mono">
                    <div className="text-cyan-400 font-bold mb-1">Sol {d.sol}</div>
                    <div className="text-white">
                      Observed: {d.value} {unit}
                    </div>
                    <div className="text-slate-400 text-[10px]">
                      Baseline Band: {d.lower} - {d.upper}
                    </div>
                    {d.outOfBand && (
                      <div className="text-rose-400 text-[10px] font-bold mt-1">
                        &bull; Out of 2-sigma baseline band
                      </div>
                    )}
                  </div>
                );
              }}
            />

            {/* Shaded 2-sigma baseline band */}
            <Area
              type="monotone"
              dataKey="bandHeight"
              baseValue="dataMin"
              stroke="none"
              fill="#0284c7"
              fillOpacity={0.15}
            />

            {/* Mean reference dashed line */}
            <Line
              type="monotone"
              dataKey="mean"
              stroke="#38bdf8"
              strokeDasharray="3 3"
              dot={false}
              strokeWidth={1}
            />

            {/* Observed vital values */}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (!cx || !cy) return <circle key={`empty-${Math.random()}`} />;
                if (payload.outOfBand) {
                  return (
                    <circle
                      key={`dot-out-${payload.sol}`}
                      cx={cx}
                      cy={cy}
                      r={4.5}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  );
                }
                return (
                  <circle
                    key={`dot-in-${payload.sol}`}
                    cx={cx}
                    cy={cy}
                    r={2.5}
                    fill="#38bdf8"
                  />
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
};
