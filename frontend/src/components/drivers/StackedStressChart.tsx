import { useMemo, type FC } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import {
  STRESSOR_COLORS,
  STRESSOR_LABELS,
  STRESSOR_KEYS,
  type StressorKey,
  type CompoundRun,
} from '../../lib/compoundStress';

export interface DriverChartDataPoint {
  sol: number;
  cri: number;
  radiation: number;
  sleep: number;
  cardio: number;
  mood: number;
  inflammation: number;
  totalPoints: number;
  activeCount: number;
  activeStressors: StressorKey[];
  compoundLevel: 'none' | 'compound' | 'severe compound';
  [key: string]: string | number | string[] | null | undefined;
}

export interface StackedStressChartProps {
  data: DriverChartDataPoint[];
  compoundRuns: CompoundRun[];
  visibleStressors: Record<StressorKey, boolean>;
  onToggleStressor: (key: StressorKey) => void;
  highlightedSol: number | null;
  onSelectSol: (sol: number | null) => void;
  syncId?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: number;
  dataMap: Map<number, DriverChartDataPoint>;
}

const CustomTooltip: FC<CustomTooltipProps> = ({ active, payload, label, dataMap }) => {
  if (!active || label === undefined) return null;
  const point = dataMap.get(label);
  if (!point) return null;

  return (
    <div className="bg-slate-900/95 border border-slate-700/80 rounded-lg p-3 text-xs shadow-xl backdrop-blur max-w-xs">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2 mb-2">
        <span className="font-mono font-bold text-slate-100">Sol {label}</span>
        <span
          className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${
            point.cri >= 75
              ? 'text-emerald-300 bg-emerald-950/80 border border-emerald-800/60'
              : point.cri >= 50
              ? 'text-amber-300 bg-amber-950/80 border border-amber-800/60'
              : 'text-rose-300 bg-rose-950/80 border border-rose-800/60'
          }`}
        >
          CRI {Math.round(point.cri)}
        </span>
      </div>

      <div className="mb-2.5">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-slate-400">Active stressors (contributions &ge; 3 pts):</span>
          <span
            className={`font-mono font-semibold px-1.5 py-0.2 rounded text-[10px] ${
              point.activeCount >= 3
                ? 'bg-rose-950 text-rose-300 border border-rose-800/80'
                : point.activeCount === 2
                ? 'bg-amber-950 text-amber-300 border border-amber-800/80'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {point.activeCount === 0
              ? 'None'
              : point.activeCount === 1
              ? '1 active'
              : `${point.activeCount} active (Compound)`}
          </span>
        </div>
        {point.activeStressors.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {point.activeStressors.map((s) => (
              <span
                key={s}
                className="text-[10px] font-mono px-1 rounded"
                style={{
                  color: STRESSOR_COLORS[s],
                  backgroundColor: `${STRESSOR_COLORS[s]}15`,
                  border: `1px solid ${STRESSOR_COLORS[s]}40`,
                }}
              >
                {STRESSOR_LABELS[s]}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1 pt-1 border-t border-slate-800/80">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
          Stressor Drop Contributions
        </div>
        {payload &&
          payload.map((entry) => {
            const key = entry.dataKey as StressorKey;
            const isStressorKey = STRESSOR_KEYS.includes(key);
            if (!isStressorKey) return null;
            const val = typeof entry.value === 'number' ? entry.value : 0;
            const isActive = val >= 3.0;

            return (
              <div key={key} className="flex items-center justify-between gap-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className={isActive ? 'text-slate-200 font-medium' : 'text-slate-400'}>
                    {STRESSOR_LABELS[key] || entry.name}
                  </span>
                </div>
                <span className="font-mono text-slate-200">
                  {val.toFixed(1)} <span className="text-slate-400 text-[10px]">pts</span>
                </span>
              </div>
            );
          })}
        <div className="flex items-center justify-between pt-1 mt-1 border-t border-slate-800 text-[11px] font-mono">
          <span className="text-slate-400">Total contribution:</span>
          <span className="text-slate-200 font-bold">{point.totalPoints.toFixed(1)} pts</span>
        </div>
      </div>
    </div>
  );
};

export const StackedStressChart: FC<StackedStressChartProps> = ({
  data,
  compoundRuns,
  visibleStressors,
  onToggleStressor,
  highlightedSol,
  onSelectSol,
  syncId = 'drivers-timeline',
}) => {
  const dataMap = useMemo(() => {
    return new Map<number, DriverChartDataPoint>(data.map((p) => [p.sol, p]));
  }, [data]);

  const solDomain = useMemo<[number, number]>(() => {
    if (data.length === 0) return [100, 145];
    return [data[0].sol, data[data.length - 1].sol];
  }, [data]);

  return (
    <div className="p-4 sm:p-6 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-100 font-mono flex items-center gap-2">
            <span>Stressor Drop Timeline</span>
            <span className="text-xs font-mono font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              Stacked Points
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Points contributed to the total CRI reduction by each physiological stressor.
            Shaded zones highlight compound stress (&ge; 2 active stressors).
          </p>
        </div>

        {/* Legend / Toggles */}
        <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Stressor visibility toggles">
          {STRESSOR_KEYS.map((key) => {
            const isVisible = visibleStressors[key];
            const color = STRESSOR_COLORS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onToggleStressor(key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-colors border ${
                  isVisible
                    ? 'border-slate-700 bg-slate-800/80 text-slate-200'
                    : 'border-slate-800/50 bg-slate-900/40 text-slate-400 line-through'
                }`}
                aria-pressed={isVisible}
                title={`Toggle ${STRESSOR_LABELS[key]}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: isVisible ? color : '#475569',
                    boxShadow: isVisible ? `0 0 6px ${color}60` : 'none',
                  }}
                />
                <span>{STRESSOR_LABELS[key]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-72 sm:h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            syncId={syncId}
            margin={{ top: 15, right: 20, left: 0, bottom: 20 }}
            onClick={(e) => {
              if (e && e.activeLabel !== undefined) {
                const clickedSol = Number(e.activeLabel);
                onSelectSol(highlightedSol === clickedSol ? null : clickedSol);
              }
            }}
          >
            <defs>
              {STRESSOR_KEYS.map((key) => (
                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={STRESSOR_COLORS[key]} stopOpacity={0.7} />
                  <stop offset="95%" stopColor={STRESSOR_COLORS[key]} stopOpacity={0.15} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.7} />
            <XAxis
              dataKey="sol"
              type="number"
              domain={solDomain}
              stroke="#64748b"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickFormatter={(sol) => `Sol ${sol}`}
              label={{
                value: 'Mission Sol (100–145)',
                position: 'insideBottom',
                offset: -10,
                fill: '#64748b',
                fontSize: 11,
              }}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              label={{
                value: 'CRI Points Drop',
                angle: -90,
                position: 'insideLeft',
                fill: '#64748b',
                fontSize: 11,
                offset: 15,
              }}
            />
            <Tooltip
              content={<CustomTooltip dataMap={dataMap} />}
              cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
            />

            {/* Compound Stress Runs Shaded Areas */}
            {compoundRuns.map((run, idx) => {
              const x1 = run.startSol === run.endSol ? run.startSol - 0.4 : run.startSol;
              const x2 = run.startSol === run.endSol ? run.endSol + 0.4 : run.endSol;
              const isHighlighted =
                highlightedSol !== null &&
                highlightedSol >= run.startSol &&
                highlightedSol <= run.endSol;

              return (
                <ReferenceArea
                  key={`run-${idx}-${run.startSol}-${run.endSol}`}
                  x1={x1}
                  x2={x2}
                  fill={isHighlighted ? '#ff5d73' : '#ff5d73'}
                  fillOpacity={isHighlighted ? 0.22 : 0.12}
                  stroke={isHighlighted ? '#ff5d73' : 'rgba(255, 93, 115, 0.4)'}
                  strokeDasharray="3 3"
                  strokeWidth={isHighlighted ? 2 : 1}
                />
              );
            })}

            {/* Highlighted Sol vertical line if user clicked a sol or chip */}
            {highlightedSol !== null && (
              <ReferenceLine
                x={highlightedSol}
                stroke="#f8f4ff"
                strokeWidth={2}
                strokeDasharray="3 3"
                label={{
                  value: `Selected: Sol ${highlightedSol}`,
                  fill: '#f8f4ff',
                  fontSize: 10,
                  position: 'top',
                }}
              />
            )}

            {/* Stacked Areas for Stressors */}
            {STRESSOR_KEYS.map((key) => {
              if (!visibleStressors[key]) return null;
              return (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={STRESSOR_LABELS[key]}
                  stackId="stressors"
                  stroke={STRESSOR_COLORS[key]}
                  strokeWidth={1.75}
                  fill={`url(#grad-${key})`}
                  isAnimationActive={false}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 px-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-2 rounded bg-rose-500/20 border border-rose-500/50" />
          <span>Shaded vertical bands: Compound stress intervals (&ge; 2 active stressors)</span>
        </span>
        <span>Click chart or chip to pin a Sol</span>
      </div>
    </div>
  );
};
