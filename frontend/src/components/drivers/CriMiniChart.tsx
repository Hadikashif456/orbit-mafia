import { useMemo, type FC } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import type { DriverChartDataPoint } from './StackedStressChart';
import { useMissionSol } from '../../context/SolContext';

export interface CriMiniChartProps {
  data: DriverChartDataPoint[];
  highlightedSol: number | null;
  onSelectSol: (sol: number | null) => void;
  syncId?: string;
}

interface MiniTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
  }>;
  label?: number;
}

const MiniTooltip: FC<MiniTooltipProps> = ({ active, payload, label }) => {
  if (!active || label === undefined || !payload || payload.length === 0) return null;
  const criVal = payload[0].value;
  const statusLabel =
    criVal >= 75 ? 'Optimal' : criVal >= 50 ? 'Watch' : 'Action Required';
  const statusColor =
    criVal >= 75
      ? 'text-emerald-300'
      : criVal >= 50
      ? 'text-amber-300'
      : 'text-rose-300';

  return (
    <div className="bg-slate-900/95 border border-slate-700/80 rounded px-2.5 py-1.5 text-xs shadow-lg backdrop-blur">
      <div className="flex items-center gap-2 font-mono">
        <span className="text-slate-400">Sol {label}:</span>
        <span className="text-slate-100 font-bold">CRI {Math.round(criVal)}</span>
        <span className={`text-[10px] font-semibold ${statusColor}`}>({statusLabel})</span>
      </div>
    </div>
  );
};

export const CriMiniChart: FC<CriMiniChartProps> = ({
  data,
  highlightedSol,
  onSelectSol,
  syncId = 'drivers-timeline',
}) => {
  const { sol: currentMissionSol } = useMissionSol();

  const solDomain = useMemo<[number, number]>(() => {
    if (data.length === 0) return [100, 145];
    return [data[0].sol, data[data.length - 1].sol];
  }, [data]);

  return (
    <div className="p-4 sm:p-6 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
            <span>Resulting Composite Risk Index (CRI)</span>
            <span className="w-2 h-2 rounded-full bg-[#f8f4ff] inline-block shadow-[0_0_6px_#f8f4ff]" />
          </h4>
          <span className="text-[11px] font-mono text-slate-400">
            Scale 0–100 (100 = minimal risk)
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> &ge; 75 Optimal
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> 50–74 Watch
          </span>
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-400" /> &lt; 50 Action
          </span>
        </div>
      </div>

      <div className="h-44 sm:h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            syncId={syncId}
            margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
            onClick={(e) => {
              if (e && e.activeLabel !== undefined) {
                const clickedSol = Number(e.activeLabel);
                onSelectSol(highlightedSol === clickedSol ? null : clickedSol);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />

            {/* Status Zones */}
            <ReferenceArea y1={75} y2={100} fill="rgba(124, 245, 176, 0.05)" />
            <ReferenceArea y1={50} y2={75} fill="rgba(255, 224, 163, 0.05)" />
            <ReferenceArea y1={0} y2={50} fill="rgba(255, 93, 115, 0.07)" />

            <XAxis
              dataKey="sol"
              type="number"
              domain={solDomain}
              stroke="#64748b"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickFormatter={(s) => `Sol ${s}`}
              label={{
                value: 'Mission Sol (100–145)',
                position: 'insideBottom',
                offset: -10,
                fill: '#64748b',
                fontSize: 11,
              }}
            />
            <YAxis
              domain={[30, 100]}
              stroke="#64748b"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              label={{
                value: 'CRI',
                angle: -90,
                position: 'insideLeft',
                fill: '#64748b',
                fontSize: 11,
                offset: 15,
              }}
            />

            <Tooltip content={<MiniTooltip />} />

            {/* Status threshold lines */}
            <ReferenceLine
              y={75}
              stroke="#7cf5b0"
              strokeDasharray="3 3"
              strokeOpacity={0.6}
              label={{
                value: '75',
                fill: '#7cf5b0',
                fontSize: 10,
                position: 'right',
              }}
            />
            <ReferenceLine
              y={50}
              stroke="#ff5d73"
              strokeDasharray="3 3"
              strokeOpacity={0.6}
              label={{
                value: '50',
                fill: '#ff5d73',
                fontSize: 10,
                position: 'right',
              }}
            />

            {/* Mission Sol vertical line */}
            {currentMissionSol >= solDomain[0] && currentMissionSol <= solDomain[1] && (
              <ReferenceLine
                x={currentMissionSol}
                stroke="#83e7f5"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Mission Sol ${currentMissionSol}`,
                  fill: '#83e7f5',
                  fontSize: 10,
                  position: 'top',
                }}
              />
            )}

            {/* Selected Sol vertical line */}
            {highlightedSol !== null && (
              <ReferenceLine
                x={highlightedSol}
                stroke="#f8f4ff"
                strokeWidth={2}
                strokeDasharray="3 3"
              />
            )}

            <Line
              type="monotone"
              dataKey="cri"
              name="CRI"
              stroke="#f8f4ff"
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 5, fill: '#f8f4ff', stroke: '#83e7f5', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
