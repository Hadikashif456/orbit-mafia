import type { FC } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from 'recharts';
import { ProvenanceBadge } from '../ProvenanceBadge';
import { RECOVERY_TOLERANCE_PCT, formatTimepoint } from '../../lib/recovery';

export interface RecoveryChartDataPoint {
  timepoint: string;
  displayTimepoint: string;
  C001_pct?: number | null;
  C001_raw?: number | null;
  C002_pct?: number | null;
  C002_raw?: number | null;
  C003_pct?: number | null;
  C003_raw?: number | null;
  C004_pct?: number | null;
  C004_raw?: number | null;
  [key: string]: string | number | null | undefined;
}

export interface RecoveryChartProps {
  data: RecoveryChartDataPoint[];
  markerName: string;
  unit: string;
  selectedCrew: string; // 'ALL' or 'C001'..'C004'
  crewColors: Record<string, string>;
  crewCallsigns: Record<string, string>;
}

export const RecoveryChart: FC<RecoveryChartProps> = ({
  data,
  markerName,
  unit,
  selectedCrew,
  crewColors,
  crewCallsigns,
}) => {
  const crewIds = selectedCrew === 'ALL' ? ['C001', 'C002', 'C003', 'C004'] : [selectedCrew];

  return (
    <div className="p-4 sm:p-6 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base sm:text-lg font-bold text-slate-100 font-mono">
              {markerName}
            </h3>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/70 border border-cyan-800/80 px-2 py-0.5 rounded">
              {unit || 'normalized'}
            </span>
            <ProvenanceBadge provenance="REAL_OSDR" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Normalized recovery relative to each astronaut&apos;s pre-flight baseline (100%). Shaded band is &plusmn;{RECOVERY_TOLERANCE_PCT}%.
          </p>
        </div>
      </div>

      <div className="h-72 sm:h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 15, right: 20, left: 0, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.7} />
            <XAxis
              dataKey="timepoint"
              stroke="#64748b"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickFormatter={(tp) => String(tp)}
              label={{
                value: 'Mission Timepoints (Pre-flight L to Post-flight R)',
                position: 'insideBottom',
                offset: -15,
                fill: '#64748b',
                fontSize: 11,
              }}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              domain={[
                (dataMin: number) => Math.max(0, Math.floor(Math.min(dataMin, 80) / 10) * 10),
                (dataMax: number) => Math.ceil(Math.max(dataMax, 130) / 10) * 10,
              ]}
              tickFormatter={(v) => `${v}%`}
              label={{
                value: '% of Baseline',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                fill: '#64748b',
                fontSize: 11,
              }}
            />

            {/* Shaded tolerance band: 90% - 110% */}
            <ReferenceArea
              y1={100 - RECOVERY_TOLERANCE_PCT}
              y2={100 + RECOVERY_TOLERANCE_PCT}
              fill="#83e7f5"
              fillOpacity={0.08}
              stroke="#83e7f5"
              strokeOpacity={0.2}
              strokeDasharray="2 2"
            />

            {/* 100% Baseline Line */}
            <ReferenceLine
              y={100}
              stroke="#f8f4ff"
              strokeDasharray="4 4"
              strokeOpacity={0.8}
              label={{
                value: 'Baseline (100%)',
                position: 'insideTopRight',
                fill: '#d9b8ff',
                fontSize: 10,
              }}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                return (
                  <div className="bg-slate-900/95 border border-slate-700 p-3 rounded shadow-xl text-xs backdrop-blur font-mono">
                    <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-1.5">
                      {formatTimepoint(String(label))} ({label})
                    </div>
                    <div className="space-y-1">
                      {payload.map((item) => {
                        const cid = (item.dataKey as string).replace('_pct', '');
                        const callsign = crewCallsigns[cid] || cid;
                        const rawVal = item.payload[`${cid}_raw`];
                        const pctVal = item.value;

                        return (
                          <div key={item.dataKey} className="flex items-center justify-between gap-4">
                            <span style={{ color: item.color }} className="font-medium">
                              {cid} ({callsign}):
                            </span>
                            <span className="text-slate-100 font-bold">
                              {typeof pctVal === 'number' ? `${pctVal.toFixed(1)}%` : 'No data'}
                              {typeof rawVal === 'number' && (
                                <span className="text-slate-400 font-normal ml-1">
                                  ({rawVal.toLocaleString()} {unit})
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }}
            />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: '12px', fontSize: '11px', fontFamily: 'monospace' }}
              formatter={(value: string) => {
                const cid = value.replace('_pct', '');
                return `${cid} (${crewCallsigns[cid] || cid})`;
              }}
            />

            {crewIds.map((cid) => (
              <Line
                key={cid}
                type="monotone"
                dataKey={`${cid}_pct`}
                stroke={crewColors[cid]}
                strokeWidth={2}
                dot={{ r: 3.5, strokeWidth: 1.5, fill: '#0f172a' }}
                activeDot={{ r: 6 }}
                connectNulls={false}
                name={`${cid}_pct`}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
