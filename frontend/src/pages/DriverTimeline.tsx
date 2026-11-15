import { useState, useEffect, useMemo, type FC } from 'react';
import { useCosmos } from '../cosmos/CosmosContext';
import { useCriRange } from '../hooks/useCriRange';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { ErrorBoundary } from '../components/ErrorBoundary';
import {
  StackedStressChart,
  type DriverChartDataPoint,
} from '../components/drivers/StackedStressChart';
import { CriMiniChart } from '../components/drivers/CriMiniChart';
import { CompoundChipsRow } from '../components/drivers/CompoundChipsRow';
import {
  ACTIVE_THRESHOLD_POINTS,
  activeStressors,
  compoundLevel,
  findCompoundRuns,
  type StressorKey,
} from '../lib/compoundStress';
import type { Provenance } from '../api/types';
import { RefreshCw, Users, Activity, AlertCircle } from 'lucide-react';

const CREW_CONFIG = [
  { id: 'C002', callsign: 'Cmdr B (Storm Exposure)', highlight: true },
  { id: 'C001', callsign: 'Cmdr A (Baseline)' },
  { id: 'C003', callsign: 'Cmdr C (Baseline)' },
  { id: 'C004', callsign: 'Cmdr D (Baseline)' },
];

export const DriverTimelineContent: FC = () => {
  const { scene, setScene } = useCosmos();

  useEffect(() => {
    const previousScene = scene;
    setScene('dreamscape');
    return () => setScene(previousScene);
  }, [setScene]);

  // Default to C002 as it experiences the compound stress drop in Sols 143–145
  const [selectedCrew, setSelectedCrew] = useState<string>('C002');
  const [highlightedSol, setHighlightedSol] = useState<number | null>(null);

  const [visibleStressors, setVisibleStressors] = useState<Record<StressorKey, boolean>>({
    radiation: true,
    sleep: true,
    cardio: true,
    mood: true,
    inflammation: true,
  });

  const handleToggleStressor = (key: StressorKey) => {
    setVisibleStressors((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const {
    data,
    isLoading,
    isFetching,
    progress,
    errorCount,
    has429Error,
    refetchAll,
  } = useCriRange(selectedCrew, 100, 145);

  const chartData = useMemo<DriverChartDataPoint[]>(() => {
    return data.map((d) => {
      const c = d.contributions;
      const active = activeStressors(c, ACTIVE_THRESHOLD_POINTS);
      const totalPoints = c.radiation + c.sleep + c.cardio + c.mood + c.inflammation;

      return {
        sol: d.sol,
        cri: d.cri,
        radiation: c.radiation,
        sleep: c.sleep,
        cardio: c.cardio,
        mood: c.mood,
        inflammation: c.inflammation,
        totalPoints,
        activeCount: active.length,
        activeStressors: active,
        compoundLevel: compoundLevel(active.length),
      };
    });
  }, [data]);

  const compoundRuns = useMemo(() => {
    const points = chartData.map((p) => ({
      sol: p.sol,
      activeStressors: p.activeStressors,
    }));
    return findCompoundRuns(points);
  }, [chartData]);

  const provenance: Provenance = (data[0]?.provenance as Provenance) ?? 'SYNTHETIC';

  const percentLoaded = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;

  return (
    <div className="relative min-h-screen text-slate-100 flex flex-col font-sans overflow-x-hidden">
      <div className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Activity className="w-6 h-6 text-cyan-400" />
              <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-100">
                Driver Timeline + Compound Stress
              </h1>
              <ProvenanceBadge provenance={provenance} />
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Stacked contribution of physiological stressors to CRI drops across Mission Sols 100–145, highlighting simultaneous stress events.
            </p>
          </div>

          {/* Controls: Crew Member Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1">
              <Users className="w-4 h-4 text-slate-400 ml-1.5 shrink-0" />
              <div className="flex gap-1">
                {CREW_CONFIG.map((c) => {
                  const isSelected = selectedCrew === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCrew(c.id);
                        setHighlightedSol(null);
                      }}
                      className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                        isSelected
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                      aria-pressed={isSelected}
                    >
                      {c.id}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={refetchAll}
              disabled={isFetching}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-50 transition-colors"
              title="Refresh timeline data"
              aria-label="Refresh timeline data"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Progress Bar during loading or partial fetch */}
        {isFetching && (
          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                Loading sols 100–145 ({progress.loaded}/{progress.total})
              </span>
              <span className="text-cyan-400 font-bold">{percentLoaded}%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${percentLoaded}%` }}
              />
            </div>
          </div>
        )}

        {/* Warning if 429 or fetch errors occurred on some sols */}
        {errorCount > 0 && (
          <div className="p-3 bg-amber-950/50 border border-amber-800/60 rounded-lg flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {has429Error
                  ? 'Rate limit encountered on some queries. Partial data is rendered below.'
                  : `${errorCount} sol queries could not be loaded. Displaying available data.`}
              </span>
            </div>
            <button
              type="button"
              onClick={refetchAll}
              className="px-2.5 py-1 bg-amber-900/60 hover:bg-amber-900 border border-amber-700/80 rounded font-mono text-[11px] text-amber-100"
            >
              Retry
            </button>
          </div>
        )}

        {/* Main Content Area */}
        {isLoading && chartData.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center border border-slate-800 rounded-xl bg-slate-900/30 gap-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            <span className="text-sm font-mono text-slate-400">
              Loading timeline for {selectedCrew} (Sols 100–145)...
            </span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Interactive Compound Stress Chips */}
            <CompoundChipsRow
              runs={compoundRuns}
              highlightedSol={highlightedSol}
              onSelectSol={setHighlightedSol}
            />

            {/* Chart 1: Stacked Stressor Timeline */}
            <StackedStressChart
              data={chartData}
              compoundRuns={compoundRuns}
              visibleStressors={visibleStressors}
              onToggleStressor={handleToggleStressor}
              highlightedSol={highlightedSol}
              onSelectSol={setHighlightedSol}
              syncId="drivers-timeline"
            />

            {/* Chart 2: Resulting CRI Mini Line Chart */}
            <CriMiniChart
              data={chartData}
              highlightedSol={highlightedSol}
              onSelectSol={setHighlightedSol}
              syncId="drivers-timeline"
            />

            {/* Mandatory Honest Notes */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-mono font-bold text-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                <span>&quot;Window-based contributions&quot;: CRI uses a 3-sol window, so contributions change with a delay.</span>
              </div>
              <p className="text-slate-400 font-mono pl-3.5">
                &quot;Compound stress = number of stressors active at the same time. This is a count, not an interaction (synergy) model.&quot;
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Safety Disclaimer Footer */}
      <div className="relative z-10">
      </div>
    </div>
  );
};

export const DriverTimeline: FC = () => {
  return (
    <ErrorBoundary>
      <DriverTimelineContent />
    </ErrorBoundary>
  );
};
