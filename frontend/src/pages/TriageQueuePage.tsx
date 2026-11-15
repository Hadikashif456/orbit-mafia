import type { FC } from 'react';
import { useMissionSol } from '../context/SolContext';
import { useTriageQueue } from '../hooks/useTriageQueue';
import { TriageQueueCard } from '../components/triage/TriageQueueCard';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { ErrorBoundary } from '../components/ErrorBoundary';

const TriageContent: FC = () => {
  const { sol } = useMissionSol();
  const { rankedCrew, isLoading, isError, error, refetch } = useTriageQueue(sol);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
      <header className="mb-6 sm:mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-cyan-400 uppercase tracking-widest">
              Medical Officer Decision Support
            </span>
            <ProvenanceBadge provenance="SYNTHETIC" />
          </div>
          <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
            SOL {sol}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Crew Triage Priority Queue
        </h1>
        <p className="text-sm text-slate-400 max-w-3xl mt-1 leading-relaxed">
          Autonomous ranking of astronaut medical risk priority based on Inspiration4 telemetry indicators: status
          severity (Red &gt; Amber &gt; Green), lowest Composite Resilience Index (CRI), and recent trajectory drop.
        </p>
      </header>

      {isLoading && (
        <div className="p-8 text-center text-sm font-mono text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
          Loading crew telemetry for priority ranking...
        </div>
      )}

      {isError && (
        <div className="p-6 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-rose-300">Failed to load crew summary data</h2>
            <p className="text-xs font-mono text-rose-400 mt-1">
              {error?.message || 'The backend telemetry service is unavailable.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs font-mono border border-rose-700 transition-colors"
          >
            Retry Query
          </button>
        </div>
      )}

      {!isLoading && !isError && rankedCrew.length === 0 && (
        <div className="p-8 text-center text-sm font-mono text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
          No crew telemetry available for Sol {sol}.
        </div>
      )}

      {!isLoading && !isError && rankedCrew.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {rankedCrew.map((item) => (
            <TriageQueueCard key={item.member.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};

export const TriageQueuePage: FC = () => {
  return (
    <ErrorBoundary>
      <TriageContent />
    </ErrorBoundary>
  );
};
