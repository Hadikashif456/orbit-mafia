import type { FC } from 'react';
import type { RecoveryStatusResult } from '../../lib/recovery';

export interface RecoveryStatusCardProps {
  crewId: string;
  callsign: string;
  baseline: number | null;
  unit: string;
  status: RecoveryStatusResult;
  color: string;
}

export const RecoveryStatusCard: FC<RecoveryStatusCardProps> = ({
  crewId,
  callsign,
  baseline,
  unit,
  status,
  color,
}) => {
  const isRecovered = status.recoveredAt !== null;
  const peakSign = status.peakDeviationPct >= 0 ? '+' : '';

  return (
    <article
      className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur transition-all flex flex-col justify-between"
      style={{ borderLeftColor: color, borderLeftWidth: '3px' }}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-slate-100">{crewId}</span>
            <span className="text-xs text-slate-300 font-medium">({callsign})</span>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${
              isRecovered
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : 'bg-amber-950 text-amber-300 border border-amber-800'
            }`}
          >
            {isRecovered ? 'Recovered' : 'Monitoring'}
          </span>
        </div>

        <div className="text-xs text-slate-400 mb-3">
          Baseline:{' '}
          <span className="font-mono font-medium text-slate-200">
            {baseline !== null ? `${baseline.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}` : 'N/A'}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs">
        <div className="text-slate-300">
          Peak deviation:{' '}
          {status.peakTimepoint ? (
            <span className="font-mono font-semibold text-rose-300">
              {peakSign}{status.peakDeviationPct}% at {status.peakTimepoint}
            </span>
          ) : (
            <span className="font-mono text-slate-400">None observed</span>
          )}
        </div>

        <div className="text-slate-300">
          {status.recoveredAt ? (
            <span>
              Back within &plusmn;10% at{' '}
              <span className="font-mono font-semibold text-emerald-300">
                {status.recoveredAt}
              </span>
            </span>
          ) : (
            <span className="text-amber-300 font-medium">
              Not recovered by {status.peakTimepoint ? 'R+194' : 'end of window'}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};
