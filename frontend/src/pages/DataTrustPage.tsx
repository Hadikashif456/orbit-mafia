import type { FC } from 'react';
import { useProvenance } from '../hooks/useProvenance';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { TrustTable } from '../components/trust/TrustTable';

export const DataTrustContent: FC = () => {
  const { data: provenance, isLoading, isError } = useProvenance();

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <header className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">Scientific Transparency</span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs font-mono text-slate-400">Honest Provenance & Limitations</span>
          </div>
          <ProvenanceBadge provenance="REAL_OSDR" />
        </div>
        <h1 className="text-2xl md:text-3xl font-mono font-bold text-white tracking-tight">
          Data Trust & Methodology Disclosures
        </h1>
        <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
          Orbit Mafia couples NASA Open Science Data Repository (OSDR) biological profiles with simulated mission telemetry.
          To ensure complete operational and ethical transparency, every data stream, its mathematical contribution to
          the Crew Resilience Index (CRI), and its known limitations are enumerated below.
        </p>
      </header>

      {/* Honest Scientific Limitations Banner */}
      <section className="rounded-xl border border-amber-500/40 bg-slate-900/90 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-mono font-bold text-sm uppercase tracking-wide">
            Critical Methodological Boundaries
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono text-amber-200/90">
          <div className="rounded-lg bg-black/40 border border-amber-800/40 p-3 space-y-1">
            <div className="font-semibold text-amber-300">1. Orbital LEO, Not Mars</div>
            <p className="text-slate-300">
              Biomarkers derive from Inspiration4 (3-day Low Earth Orbit flight), not interplanetary or Mars transit conditions.
            </p>
          </div>
          <div className="rounded-lg bg-black/40 border border-amber-800/40 p-3 space-y-1">
            <div className="font-semibold text-amber-300">2. Sample Cohort (N = 4)</div>
            <p className="text-slate-300">
              Only 4 civilian astronaut profiles across 7 discrete pre- and post-flight collection timepoints.
            </p>
          </div>
          <div className="rounded-lg bg-black/40 border border-amber-800/40 p-3 space-y-1">
            <div className="font-semibold text-amber-300">3. Synthetic Telemetry</div>
            <p className="text-slate-300">
              Cardio, sleep debt, mood, and ambient radiation telemetry are synthetic models, not live wearable feeds.
            </p>
          </div>
          <div className="rounded-lg bg-black/40 border border-amber-800/40 p-3 space-y-1">
            <div className="font-semibold text-amber-300">4. Reference Ranges (CMP Only)</div>
            <p className="text-slate-300">
              Standard clinical reference ranges are available for CMP chemistry. Proteomic markers lack universal baselines.
            </p>
          </div>
          <div className="rounded-lg bg-black/40 border border-amber-800/40 p-3 space-y-1">
            <div className="font-semibold text-amber-300">5. Advisory, Not Diagnostic</div>
            <p className="text-slate-300">
              Outputs are resilience risk flags and countermeasure suggestions. Never clinical diagnoses or disease detection.
            </p>
          </div>
          <div className="rounded-lg bg-black/40 border border-amber-800/40 p-3 space-y-1">
            <div className="font-semibold text-amber-300">6. Ground-Truth Telemetry</div>
            <p className="text-slate-300">
              {provenance?.policy || 'All CRI calculations are strictly evaluated backend-side with zero browser estimation.'}
            </p>
          </div>
        </div>
      </section>

      {/* Trust Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-mono font-semibold text-slate-100">
            Data Stream Provenance Matrix
          </h2>
        </div>
        <TrustTable />
      </section>

      {/* Backend Live Provenance Sync */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <h2 className="text-base font-mono font-semibold text-slate-200">
          Live API Provenance Verification
        </h2>
        {isLoading ? (
          <p className="text-xs font-mono text-slate-500 animate-pulse">Querying live backend provenance metadata...</p>
        ) : isError ? (
          <p className="text-xs font-mono text-amber-400">Offline mode: Using cached data provenance catalog.</p>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-slate-400">
              <span className="font-semibold text-slate-200">Replay Note: </span>
              {provenance?.replayNote}
            </div>
            {provenance?.datasets && provenance.datasets.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {provenance.datasets.map((ds) => (
                  <div key={ds.id} className="rounded border border-slate-800 bg-black/30 p-3 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-400">{ds.id}</span>
                      <ProvenanceBadge provenance={ds.provenance} />
                    </div>
                    <div className="text-slate-300 mt-1">{ds.title}</div>
                    <div className="text-slate-500 text-[11px] mt-1">{ds.citation}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

    </div>
  );
};

export const DataTrustPage: FC = () => {
  return (
    <ErrorBoundary>
      <DataTrustContent />
    </ErrorBoundary>
  );
};
export default DataTrustPage;
