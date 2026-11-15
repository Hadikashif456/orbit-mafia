import { useState, useMemo, type FC } from 'react';
import { useRecoveryBiomarkers } from '../hooks/useRecoveryBiomarkers';
import { useCrewSummaries } from '../hooks/useCrewSummaries';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { DisclaimerBar } from '../components/DisclaimerBar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { RecoveryChart, type RecoveryChartDataPoint } from '../components/recovery/RecoveryChart';
import { ReferenceRangeChart } from '../components/recovery/ReferenceRangeChart';
import { RecoveryStatusCard } from '../components/recovery/RecoveryStatusCard';
import { MarkerSearchList } from '../components/recovery/MarkerSearchList';
import {
  parseTimepoint,
  baselineOf,
  toPercentOfBaseline,
  recoveryStatus,
  RECOVERY_TOLERANCE_PCT,
} from '../lib/recovery';
import type { Biomarker } from '../api/types';

const CREW_CONFIG: Array<{ id: string; callsign: string; color: string }> = [
  { id: 'C001', callsign: 'Cmdr A', color: '#83e7f5' },
  { id: 'C002', callsign: 'Cmdr B', color: '#b56cff' },
  { id: 'C003', callsign: 'Cmdr C', color: '#ffe0a3' },
  { id: 'C004', callsign: 'Cmdr D', color: '#7cf5b0' },
];

const CREW_COLORS: Record<string, string> = Object.fromEntries(
  CREW_CONFIG.map((c) => [c.id, c.color])
);

const CREW_CALLSIGNS: Record<string, string> = Object.fromEntries(
  CREW_CONFIG.map((c) => [c.id, c.callsign])
);

const VALID_PANELS = [
  { id: 'CARDIO_EVE', label: 'Cardiovascular Panel (CARDIO_EVE)' },
  { id: 'CMP', label: 'Comprehensive Metabolic Panel (CMP)' },
  { id: 'IMMUNE_HD71', label: 'Immune HD71 Panel (IMMUNE_HD71)' },
  { id: 'INFLAMMATION_ALAMAR', label: 'Multiplex Inflammation (INFLAMMATION_ALAMAR)' },
];

export const BiomarkerRecoveryContent: FC = () => {
  const [selectedPanel, setSelectedPanel] = useState<string>('CARDIO_EVE');
  const [selectedMarker, setSelectedMarker] = useState<string>('CRP');
  const [selectedCrew, setSelectedCrew] = useState<string>('ALL');

  const { data: liveCrew } = useCrewSummaries();
  const dynamicCrewCallsigns = useMemo(() => {
    const map = { ...CREW_CALLSIGNS };
    if (liveCrew) {
      liveCrew.forEach((c) => {
        map[c.id] = c.callsign;
      });
    }
    return map;
  }, [liveCrew]);

  // Fetch the 4 crew members in parallel for the selected panel
  const queryResults = useRecoveryBiomarkers(
    CREW_CONFIG.map((c) => c.id),
    selectedPanel
  );

  const isLoading = queryResults.some((q) => q.isLoading);
  const isError = queryResults.some((q) => q.isError);
  const error = queryResults.find((q) => q.error)?.error as Error | undefined;

  const handleRetryAll = () => {
    queryResults.forEach((q) => q.refetch());
  };

  // Flatten all rows across the 4 crew
  const allRows: Biomarker[] = useMemo(() => {
    return queryResults.flatMap((q) => q.data || []);
  }, [queryResults]);

  // Extract unique markers present in the loaded panel
  const availableMarkers: string[] = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => {
      if (r.name && r.name.trim()) {
        set.add(r.name.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  // Ensure selectedMarker is valid for the current panel
  const activeMarker = useMemo(() => {
    if (availableMarkers.length === 0) return '';
    if (availableMarkers.includes(selectedMarker)) return selectedMarker;
    if (availableMarkers.includes('CRP')) return 'CRP';
    return availableMarkers[0];
  }, [availableMarkers, selectedMarker]);

  // Selected marker metadata (unit, refMin, refMax)
  const markerMetadata = useMemo(() => {
    const matching = allRows.filter(
      (r) => r.name.trim().toUpperCase() === activeMarker.toUpperCase()
    );
    const unit = matching.find((r) => r.unit)?.unit || '';
    const refRow = matching.find((r) => r.refMin !== null && r.refMax !== null);
    return {
      unit,
      refMin: refRow?.refMin ?? null,
      refMax: refRow?.refMax ?? null,
    };
  }, [allRows, activeMarker]);

  // Extract and sort all distinct timepoints for this marker
  const timepoints: string[] = useMemo(() => {
    const matching = allRows.filter(
      (r) => r.name.trim().toUpperCase() === activeMarker.toUpperCase()
    );
    const set = new Set<string>();
    matching.forEach((r) => {
      if (r.timepoint && parseTimepoint(r.timepoint) !== null) {
        set.add(r.timepoint);
      }
    });
    return Array.from(set).sort((a, b) => (parseTimepoint(a) ?? 0) - (parseTimepoint(b) ?? 0));
  }, [allRows, activeMarker]);

  // Compute baseline and recovery status per crew
  const crewAnalyses = useMemo(() => {
    return CREW_CONFIG.map((crew) => {
      const baseline = baselineOf(allRows, crew.id, activeMarker);
      const crewRows = allRows.filter(
        (r) =>
          r.crewId === crew.id &&
          r.name.trim().toUpperCase() === activeMarker.toUpperCase()
      );

      const series: Array<{ timepoint: string; pct: number }> = [];
      crewRows.forEach((r) => {
        if (baseline !== null && r.value !== null && r.value !== undefined) {
          const pct = toPercentOfBaseline(r.value, baseline);
          if (pct !== null) {
            series.push({ timepoint: r.timepoint, pct });
          }
        }
      });

      const status = recoveryStatus(series, RECOVERY_TOLERANCE_PCT);

      return {
        crewId: crew.id,
        callsign: crew.callsign,
        color: crew.color,
        baseline,
        status,
        crewRows,
      };
    });
  }, [allRows, activeMarker]);

  // Prepare normalized Recharts data points
  const chartData: RecoveryChartDataPoint[] = useMemo(() => {
    return timepoints.map((tp) => {
      const point: RecoveryChartDataPoint = {
        timepoint: tp,
        displayTimepoint: tp,
      };

      crewAnalyses.forEach((ca) => {
        const row = ca.crewRows.find((r) => r.timepoint === tp);
        if (row && typeof row.value === 'number') {
          point[`${ca.crewId}_raw`] = row.value;
          if (ca.baseline !== null) {
            point[`${ca.crewId}_pct`] = toPercentOfBaseline(
              row.value,
              ca.baseline
            );
          } else {
            point[`${ca.crewId}_pct`] = null;
          }
        } else {
          point[`${ca.crewId}_raw`] = null;
          point[`${ca.crewId}_pct`] = null;
        }
      });

      return point;
    });
  }, [timepoints, crewAnalyses]);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl font-sans text-slate-100">
      {/* Page Header */}
      <header className="mb-6 border-b border-slate-800 pb-5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">
            Inspiration4 Physiological Readout
          </span>
          <ProvenanceBadge provenance="REAL_OSDR" />
        </div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
          Post-flight biomarker recovery (Inspiration4, real OSDR data)
        </h1>
        <p className="text-sm text-slate-300 mt-1 max-w-3xl">
          Each crew member is compared to their own pre-flight baseline.
        </p>
        <div className="mt-2.5 flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>Recovery tolerance: within &plusmn;{RECOVERY_TOLERANCE_PCT}% of baseline</span>
        </div>
      </header>

      {/* Top Controls Card */}
      <section className="mb-8 p-4 sm:p-5 rounded-xl border border-slate-700/80 bg-slate-900/95 shadow-lg grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Panel Selector */}
        <div>
          <label htmlFor="panel-select" className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
            Biomarker Panel
          </label>
          <select
            id="panel-select"
            value={selectedPanel}
            onChange={(e) => setSelectedPanel(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-cyan-500 font-mono transition-colors"
          >
            {VALID_PANELS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Marker Selector */}
        <div>
          <label htmlFor="marker-select" className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
            Analyte Marker {markerMetadata.unit ? `(${markerMetadata.unit})` : ''}
          </label>
          {selectedPanel === 'IMMUNE_HD71' ? (
            <MarkerSearchList
              markers={availableMarkers}
              selectedMarker={activeMarker}
              onSelectMarker={(m) => setSelectedMarker(m)}
            />
          ) : (
            <select
              id="marker-select"
              value={activeMarker}
              onChange={(e) => setSelectedMarker(e.target.value)}
              disabled={availableMarkers.length === 0}
              className="w-full px-3 py-2 text-xs rounded bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-cyan-500 font-mono transition-colors"
            >
              {availableMarkers.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Crew Selector Toggle */}
        <div>
          <span className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
            Crew Display Mode
          </span>
          <div className="grid grid-cols-5 gap-1">
            <button
              type="button"
              onClick={() => setSelectedCrew('ALL')}
              className={`py-1.5 text-xs font-mono font-semibold rounded border transition-colors ${
                selectedCrew === 'ALL'
                  ? 'bg-cyan-900 text-cyan-100 border-cyan-600'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              All
            </button>
            {CREW_CONFIG.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCrew(c.id)}
                className={`py-1.5 text-xs font-mono font-semibold rounded border transition-colors ${
                  selectedCrew === c.id
                    ? 'bg-slate-800 text-white border-slate-600'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {c.id}
              </button>
            ))}
          </div>
          <span className="block text-[10px] font-mono text-slate-500 mt-1">
            {selectedCrew === 'ALL' ? 'Showing all 4 astronauts' : `Focusing on ${selectedCrew} (${dynamicCrewCallsigns[selectedCrew] || selectedCrew})`}
          </span>
        </div>
      </section>

      {/* States: Loading, Error, Empty, or Data Views */}
      {isLoading ? (
        <section className="space-y-4">
          <div className="h-72 rounded-xl bg-slate-900/60 animate-pulse border border-slate-800 flex items-center justify-center">
            <span className="text-xs font-mono text-slate-400">
              Loading NASA OSDR biomarker telemetry for panel {selectedPanel}...
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-slate-900/40 animate-pulse border border-slate-800" />
            ))}
          </div>
        </section>
      ) : isError ? (
        <section className="p-6 rounded-xl border border-rose-800/80 bg-rose-950/20 text-center">
          <h3 className="text-base font-bold text-rose-300 font-mono mb-2">
            Failed to Load Biomarker Telemetry
          </h3>
          <p className="text-xs text-rose-200/80 mb-4 max-w-md mx-auto">
            {error?.message || 'An error occurred while communicating with the OSDR data service.'}
          </p>
          <button
            type="button"
            onClick={handleRetryAll}
            className="px-4 py-2 text-xs font-mono bg-rose-900 hover:bg-rose-800 text-white rounded border border-rose-700 transition-colors"
          >
            Retry Request
          </button>
        </section>
      ) : !activeMarker || chartData.length === 0 ? (
        <section className="p-8 rounded-xl border border-slate-800 bg-slate-900/30 text-center">
          <p className="text-sm font-mono text-slate-400">
            No data available for this marker in the selected panel.
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          {/* Main Normalized Recovery Chart */}
          <section>
            <RecoveryChart
              data={chartData}
              markerName={activeMarker}
              unit={markerMetadata.unit}
              selectedCrew={selectedCrew}
              crewColors={CREW_COLORS}
              crewCallsigns={dynamicCrewCallsigns}
            />
          </section>

          {/* Per-Crew Recovery Status Cards */}
          <section>
            <h2 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">
              Individual Recovery Status (vs Own Baseline)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {crewAnalyses
                .filter((ca) => selectedCrew === 'ALL' || ca.crewId === selectedCrew)
                .map((ca) => (
                  <RecoveryStatusCard
                    key={ca.crewId}
                    crewId={ca.crewId}
                    callsign={dynamicCrewCallsigns[ca.crewId] || ca.callsign}
                    baseline={ca.baseline}
                    unit={markerMetadata.unit}
                    status={ca.status}
                    color={ca.color}
                  />
                ))}
            </div>
          </section>

          {/* Clinical Reference Range or Baseline Note */}
          <section>
            <ReferenceRangeChart
              data={chartData}
              markerName={activeMarker}
              unit={markerMetadata.unit}
              refMin={markerMetadata.refMin}
              refMax={markerMetadata.refMax}
              selectedCrew={selectedCrew}
              crewColors={CREW_COLORS}
              crewCallsigns={dynamicCrewCallsigns}
            />
          </section>
        </div>
      )}

      {/* Bottom Mandatory Safety Disclaimer */}
      <footer className="mt-12 pt-6 border-t border-slate-800">
        <DisclaimerBar />
      </footer>
    </div>
  );
};

export const BiomarkerRecovery: FC = () => {
  return (
    <ErrorBoundary>
      <BiomarkerRecoveryContent />
    </ErrorBoundary>
  );
};
