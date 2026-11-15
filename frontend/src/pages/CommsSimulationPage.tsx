import { useState, type FC } from 'react';
import { useMissionSol } from '../context/SolContext';
import { useCopilotExplanation } from '../hooks/useCopilot';
import { useCommsSimulation } from '../hooks/useCommsSimulation';
import { useCrewSummaries } from '../hooks/useCrewSummaries';
import { EarthLinkControls } from '../components/comms/EarthLinkControls';
import { OnboardCopilotCard } from '../components/comms/OnboardCopilotCard';
import { ErrorBoundary } from '../components/ErrorBoundary';

const DEFAULT_CREW = ['C001', 'C002', 'C003', 'C004'];

const CommsContent: FC = () => {
  const { sol } = useMissionSol();
  const [selectedCrew, setSelectedCrew] = useState<string>('C002');
  const { isEarthLinkLost, setIsEarthLinkLost, delayMinutes, setDelayMinutes, remainingSeconds } =
    useCommsSimulation(14);

  const { data: crewList } = useCrewSummaries(sol);
  const crewMembers = crewList && crewList.length > 0
    ? crewList.map((c) => ({ id: c.id, callsign: c.callsign }))
    : DEFAULT_CREW.map((id) => ({ id, callsign: id }));

  const {
    data: copilot,
    isLoading,
    isError,
    error,
    refetch,
  } = useCopilotExplanation(selectedCrew, sol);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-5xl">
      <header className="mb-6 sm:mb-8">
        <span className="font-mono text-xs text-cyan-400 uppercase tracking-widest block mb-1">
          Deep-Space Telecommunications Simulation
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Earth Link & Autonomous Copilot
        </h1>
        <p className="text-sm text-slate-300 max-w-3xl mt-1 leading-relaxed">
          Simulate communication dropouts and round-trip light-time delays with Earth ground control.
          Verify that the local AI copilot generates verified physiological countermeasures autonomously.
        </p>
      </header>

      {/* Crew and Sol Selector */}
      <section className="mb-6 p-4 rounded-xl border border-slate-700/80 bg-slate-900/95 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">Target Astronaut:</span>
          <div className="flex items-center gap-1.5">
            {crewMembers.map((c) => (
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

        <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
          SOL {sol}
        </span>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EarthLinkControls
          isEarthLinkLost={isEarthLinkLost}
          onToggleLink={setIsEarthLinkLost}
          delayMinutes={delayMinutes}
          onDelayChange={setDelayMinutes}
          remainingSeconds={remainingSeconds}
        />

        <div>
          {isLoading && (
            <div className="p-8 text-center text-sm font-mono text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
              Querying local onboard Copilot knowledge base...
            </div>
          )}

          {isError && (
            <div className="p-6 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200">
              <h3 className="text-sm font-bold text-rose-300">Onboard Copilot query failed</h3>
              <p className="text-xs font-mono text-rose-400 mt-1">
                {error?.message || 'Unable to retrieve copilot guidance for selected crew.'}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-3 px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs font-mono border border-rose-700 transition-colors"
              >
                Retry Local Query
              </button>
            </div>
          )}

          {copilot && (
            <OnboardCopilotCard copilot={copilot} crewId={selectedCrew} sol={sol} />
          )}
        </div>
      </div>
    </div>
  );
};

export const CommsSimulationPage: FC = () => {
  return (
    <ErrorBoundary>
      <CommsContent />
    </ErrorBoundary>
  );
};
