import type { FC } from 'react';
import {
  STRESSOR_COLORS,
  STRESSOR_LABELS,
  type CompoundRun,
} from '../../lib/compoundStress';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

export interface CompoundChipsRowProps {
  runs: CompoundRun[];
  highlightedSol: number | null;
  onSelectSol: (sol: number | null) => void;
}

export const CompoundChipsRow: FC<CompoundChipsRowProps> = ({
  runs,
  highlightedSol,
  onSelectSol,
}) => {
  if (runs.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center gap-3 text-xs text-slate-300">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <div>
          <span className="font-semibold text-emerald-300">No Compound Stress Events:</span>{' '}
          All stressor contributions remained below the active threshold (&lt; 3.0 pts) or occurred in isolation across Sols 100–145.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
            Compound Stress Events ({runs.length} detected)
          </h4>
        </div>
        {highlightedSol !== null && (
          <button
            type="button"
            onClick={() => onSelectSol(null)}
            className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded bg-slate-800 border border-slate-700"
          >
            <X className="w-3 h-3" />
            <span>Clear pinned Sol</span>
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Intervals where 2 or more physiological stressors simultaneously contributed &ge; 3.0 points to CRI reduction.
        Click an event to highlight it on both charts.
      </p>

      <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Compound stress intervals">
        {runs.map((run, idx) => {
          const isSelected =
            highlightedSol !== null &&
            highlightedSol >= run.startSol &&
            highlightedSol <= run.endSol;

          const solLabel =
            run.startSol === run.endSol
              ? `Sol ${run.startSol}`
              : `Sol ${run.startSol}–${run.endSol}`;

          return (
            <button
              key={`run-${idx}-${run.startSol}-${run.endSol}`}
              type="button"
              onClick={() => {
                // If already selected, clicking toggles it off, otherwise pin to startSol
                onSelectSol(isSelected ? null : run.startSol);
              }}
              className={`text-left transition-all px-3 py-2 rounded-lg border text-xs font-mono flex flex-col gap-1.5 ${
                isSelected
                  ? 'border-rose-500 bg-rose-950/60 text-slate-100 shadow-md shadow-rose-950/50 ring-1 ring-rose-500'
                  : 'border-slate-800 bg-slate-800/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
              }`}
              aria-pressed={isSelected}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-slate-100">{solLabel}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                    run.stressors.length >= 3
                      ? 'bg-rose-950 text-rose-300 border border-rose-800/80'
                      : 'bg-amber-950 text-amber-300 border border-amber-800/80'
                  }`}
                >
                  {run.stressors.length} stressors
                </span>
              </div>

              <div className="flex flex-wrap gap-1 text-[11px]">
                {run.stressors.map((s) => (
                  <span
                    key={s}
                    className="px-1.5 py-0.5 rounded text-[10px]"
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
            </button>
          );
        })}
      </div>
    </div>
  );
};
