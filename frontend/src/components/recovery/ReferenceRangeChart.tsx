import type { FC } from 'react';
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
import { ProvenanceBadge } from '../ProvenanceBadge';
import { formatTimepoint } from '../../lib/recovery';

export interface ReferenceRangeChartProps {
  data: Array<{
    timepoint: string;
    C001_raw?: number | null;
    C002_raw?: number | null;
    C003_raw?: number | null;
    C004_raw?: number | null;
  }>;
  markerName: string;
  unit: string;
  refMin: number | null;
  refMax: number | null;
  selectedCrew: string;
  crewColors: Record<string, string>;
  crewCallsigns: Record<string, string>;
}

export const ReferenceRangeChart: FC<ReferenceRangeChartProps> = ({
  data,
  markerName,
  unit,
  refMin,
  refMax,
  selectedCrew,
  crewColors,
  crewCallsigns,
}) => {
  const hasReferenceRange =
    refMin !== null &&
    refMax !== null &&
    !isNaN(refMin) &&
    !isNaN(refMax) &&
    refMin < refMax;

  if (!hasReferenceRange) {
    return (
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 text-slate-400 text-xs font-mono flex items-center justify-between">
        <span>No clinical reference range available, showing vs own baseline.</span>
        <ProvenanceBadge provenance="REAL_OSDR" />
      </div>
    );
  }

  const crewIds = selectedCrew === 'ALL' ? ['C001', 'C002', 'C003', 'C004'] : [selectedCrew];

  return (
    <div className="p-4 sm:p-5 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-200 font-mono">
              Clinical Reference Band: {markerName}
            </h4>
            <ProvenanceBadge provenance="REAL_OSDR" />
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Standard laboratory range: {refMin} &ndash; {refMax} {unit}
          </p>
        </div>
      </div>

      <div className="h-44 sm:h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 15, left: 0, bottom: 15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.5} />
            <XAxis
              dataKey="timepoint"
              stroke="#64748b"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              domain={['auto', 'auto']}
              tickFormatter={(v) => Number(v).toLocaleString()}
            />

            {/* Clinical Reference Range Shaded Area */}
            <ReferenceArea
              y1={refMin}
              y2={refMax}
              fill="#7cf5b0"
              fillOpacity={0.12}
              stroke="#7cf5b0"
              strokeOpacity={0.4}
              strokeDasharray="2 2"
            />
            <ReferenceLine
              y={refMin}
              stroke="#7cf5b0"
              strokeDasharray="2 2"
              strokeOpacity={0.5}
            />
            <ReferenceLine
              y={refMax}
              stroke="#7cf5b0"
              strokeDasharray="2 2"
              strokeOpacity={0.5}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                return (
                  <div className="bg-slate-900/95 border border-slate-700 p-2.5 rounded shadow-lg text-[11px] font-mono">
                    <div className="text-slate-300 font-bold mb-1">
                      {formatTimepoint(String(label))} ({label})
                    </div>
                    {payload.map((item) => {
                      const cid = (item.dataKey as string).replace('_raw', '');
                      const callsign = crewCallsigns[cid] || cid;
                      const val = item.value;
                      return (
                        <div key={item.dataKey} className="flex items-center justify-between gap-3">
                          <span style={{ color: item.color }}>{cid} ({callsign}):</span>
                          <span className="font-bold text-slate-100">
                            {typeof val === 'number' ? `${val.toLocaleString()} ${unit}` : 'No data'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />

            {crewIds.map((cid) => (
              <Line
                key={cid}
                type="monotone"
                dataKey={`${cid}_raw`}
                stroke={crewColors[cid]}
                strokeWidth={1.5}
                dot={{ r: 2.5 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
