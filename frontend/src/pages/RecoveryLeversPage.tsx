import { useState, type FC } from 'react';
import { useRecoveryLevers } from '../hooks/useRecoveryLevers';
import { LeverBarChart } from '../components/levers/LeverBarChart';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { StatusBadge } from '../components/crew/StatusBadge';
import { statusToCrewStatus } from '../api/adapters';
import type { Provenance } from '../api/types';

const CREW_MEMBERS = [
  { id: 'C001', callsign: 'Apex' },
  { id: 'C002', callsign: 'Vanguard' },
  { id: 'C003', callsign: 'Beacon' },
  { id: 'C004', callsign: 'Nova' },
];

const RecoveryLeversContent: FC = () => {
  const [selectedCrew, setSelectedCrew] = useState<string>('C002');
  const [selectedSol, setSelectedSol] = useState<number>(145);

  const { data: criData, levers, totalDeficit, isLoading, isError, error, refetch } =
    useRecoveryLevers(selectedCrew, selectedSol);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-5xl">
      <header className="mb-6 sm:mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <span className="font-mono text-xs text-cyan-400 uppercase tracking-widest">
            Physiological Countermeasure Modeling
          </span>
          <ProvenanceBadge provenance={(criData?.provenance as Provenance) || 'SYNTHETIC'} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Recovery Levers & Potential CRI Gain
        </h1>
        <p className="text-sm text-slate-400 max-w-3xl mt-1 leading-relaxed">
          Quantifies the exact points deducted from 100 CRI by each physiological risk factor. Returning a factor
          to baseline restores its deducted points.
        </p>
      </header>

      {/* Selectors */}
      <section className="mb-6 p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-mono text-slate-400">Astronaut:</span>
          <div className="flex items-center gap-1.5">
            {CREW_MEMBERS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCrew(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
                  selectedCrew === c.id
                    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                {c.id} ({c.callsign})
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="levers-sol" className="text-xs font-mono text-slate-400">
            Mission Sol:
          </label>
          <input
            id="levers-sol"
            type="number"
            min={1}
            max={200}
            value={selectedSol}
            onChange={(e) => setSelectedSol(Math.max(1, Math.min(200, Number(e.target.value))))}
            className="w-20 px-2 py-1 text-xs font-mono rounded bg-slate-800 text-white border border-slate-700 text-center"
          />
        </div>
      </section>

      {isLoading && (
        <div className="p-8 text-center text-sm font-mono text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
          Loading baseline contributions for {selectedCrew} Sol {selectedSol}...
        </div>
      )}

      {isError && (
        <div className="p-6 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 mb-6">
          <h3 className="text-sm font-bold text-rose-300">Failed to load CRI breakdown</h3>
          <p className="text-xs font-mono text-rose-400 mt-1">
            {error?.message || 'CRI scoring service returned an error.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs font-mono border border-rose-700 transition-colors"
          >
            Retry Query
          </button>
        </div>
      )}

      {criData && (
        <div className="space-y-6">
          {/* Summary Box */}
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                Current Resilience Baseline
              </span>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono text-3xl font-extrabold text-white">
                  {criData.cri.toFixed(1)}
                </span>
                <StatusBadge status={statusToCrewStatus(criData.status)} />
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                Total Point Deficit from 100
              </span>
              <span className="font-mono text-2xl font-bold text-rose-400">
                -{totalDeficit.toFixed(1)} pts
              </span>
            </div>
          </div>

          {/* Levers List */}
          <LeverBarChart levers={levers} totalDeficit={totalDeficit} />

          {/* Mandatory Safety Notice */}
          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-300">Upper bound:</span> assumes instant
            recovery; the 3-sol window means real recovery lags. Calculations represent points subtracted from 100 CRI.
          </div>
        </div>
      )}
    </div>
  );
};

export const RecoveryLeversPage: FC = () => {
  return (
    <ErrorBoundary>
      <RecoveryLeversContent />
    </ErrorBoundary>
  );
};
