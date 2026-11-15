import type { FC } from 'react';
import type { RecoveryLever } from '../../lib/levers';

export interface LeverBarChartProps {
  levers: RecoveryLever[];
  totalDeficit: number;
}

export const LeverBarChart: FC<LeverBarChartProps> = ({ levers, totalDeficit }) => {
  return (
    <div className="space-y-4">
      {levers.map((lever) => (
        <div
          key={lever.factor}
          className="p-4 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-md flex flex-col gap-2"
        >
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="font-semibold text-white">{lever.label}</span>
            <span className="font-mono font-bold text-cyan-400">
              +{lever.points.toFixed(1)} CRI gain
            </span>
          </div>

          <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{
                width: `${totalDeficit > 0 ? (lever.points / totalDeficit) * 100 : 0}%`,
              }}
              role="progressbar"
              aria-valuenow={lever.points}
              aria-valuemin={0}
              aria-valuemax={totalDeficit}
              aria-label={`${lever.label} potential recovery points`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Factor deduction: {lever.points.toFixed(1)} pts</span>
            <span>{lever.percentageOfDeficit.toFixed(0)}% of total deficit</span>
          </div>
        </div>
      ))}
    </div>
  );
};
