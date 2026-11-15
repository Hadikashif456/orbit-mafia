import { useState, type FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePersonalBaselines } from '../hooks/usePersonalBaselines';
import { useCrewSummaries } from '../hooks/useCrewSummaries';
import { VitalBandChart } from '../components/baselines/VitalBandChart';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { ErrorBoundary } from '../components/ErrorBoundary';

const DEFAULT_CREW = ['C001', 'C002', 'C003', 'C004'];

const BaselinesContent: FC = () => {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const crewId = paramId && /^C00[1-4]$/.test(paramId) ? paramId : 'C002';
  const [selectedSol, setSelectedSol] = useState<number>(145);

  const { data: crewList } = useCrewSummaries(selectedSol);
  const crewMembers = crewList && crewList.length > 0
    ? crewList.map((c) => ({ id: c.id, callsign: c.callsign }))
    : DEFAULT_CREW.map((id) => ({ id, callsign: id }));

  const { metrics, isLoading, isError, error, refetch } = usePersonalBaselines(crewId, selectedSol);

  const handleCrewChange = (nextId: string) => {
    navigate(`/baselines/${nextId}`);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
      <header className="mb-6 sm:mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-cyan-400 uppercase tracking-widest">
              Biometric Stability Monitoring
            </span>
            <ProvenanceBadge provenance="SYNTHETIC" />
          </div>
          <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
            SOL {selectedSol}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Personal-Baseline Bands & Divergence
        </h1>
        <p className="text-sm text-slate-300 max-w-3xl mt-1 leading-relaxed">
          Compares current telemetry against the astronaut&apos;s personal baseline (mean &plusmn; 2&sigma; established over Sol 1&ndash;14).
          Sols deviating beyond personal thresholds are highlighted.
        </p>
      </header>

      {/* Selectors */}
      <section className="mb-6 p-4 rounded-xl border border-slate-700/80 bg-slate-900/95 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-mono text-slate-400">Astronaut:</span>
          <div className="flex items-center gap-1.5">
            {crewMembers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleCrewChange(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
                  crewId === c.id
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
          <label htmlFor="baselines-sol" className="text-xs font-mono text-slate-400">
            Observation Sol:
          </label>
          <input
            id="baselines-sol"
            type="number"
            min={15}
            max={200}
            value={selectedSol}
            onChange={(e) => setSelectedSol(Math.max(15, Math.min(200, Number(e.target.value))))}
            className="w-20 px-2 py-1 text-xs font-mono rounded bg-slate-800 text-white border border-slate-700 text-center"
          />
        </div>
      </section>

      {isLoading && (
        <div className="p-8 text-center text-sm font-mono text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
          Loading baseline (Sol 1-14) and observation telemetry for {crewId}...
        </div>
      )}

      {isError && (
        <div className="p-6 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 mb-6">
          <h3 className="text-sm font-bold text-rose-300">Failed to load vital telemetry</h3>
          <p className="text-xs font-mono text-rose-400 mt-1">
            {error?.message || 'Vitals telemetry database query failed.'}
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

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {metrics.map((metric) => (
            <VitalBandChart key={metric.key} metric={metric} />
          ))}
        </div>
      )}
    </div>
  );
};

export const PersonalBaselinesPage: FC = () => {
  return (
    <ErrorBoundary>
      <BaselinesContent />
    </ErrorBoundary>
  );
};
