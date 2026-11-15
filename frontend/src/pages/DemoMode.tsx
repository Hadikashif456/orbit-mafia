import { useEffect, useState, useRef, type FC } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCosmos } from '../cosmos/CosmosContext';
import { EYE } from '../cosmos/scenes';
import { useMissionSol } from '../context/SolContext';
import { useScenario } from '../hooks/useScenario';
import { useCopilot } from '../hooks/useCopilot';
import { getScenario } from '../api/endpoints';
import { StatusBadge } from '../components/crew/StatusBadge';
import { ResilienceBar } from '../components/crew/ResilienceBar';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { CountUp } from '../components/CountUp';
import { statusToCrewStatus } from '../api/adapters';
import { REPLAY_FIRST_SOL, REPLAY_LAST_SOL } from '../lib/mission';
import { prime, speak, cancel, formatAlertNarration, formatCopilotNarration, isCopilotSpeaking } from '../lib/narration';
import { NarrationToggle } from '../components/NarrationToggle';
import type { CopilotResponse } from '../api/types';
import '../styles/replay.css';

export const DemoMode: FC = () => {
  const queryClient = useQueryClient();
  const { scene, immersive, scrollProgress, setScene, setImmersive } = useCosmos();
  const { sol: currentContextSol, setSol } = useMissionSol();

  // Save the sol prior to mounting so we can restore it on unmount
  const initialSolRef = useRef(currentContextSol);
  const [replaySol, setReplaySol] = useState<number>(REPLAY_FIRST_SOL);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [narrationEnabled, setNarrationEnabled] = useState<boolean>(true);
  const spokenAlertIdsRef = useRef<Set<string>>(new Set());

  // Prefetch scenario for every sol in replay window on mount
  useEffect(() => {
    for (let s = REPLAY_FIRST_SOL; s <= REPLAY_LAST_SOL; s++) {
      queryClient.prefetchQuery({
        queryKey: ['scenario', s],
        queryFn: () => getScenario(s),
        staleTime: 30000,
      });
    }
  }, [queryClient]);

  // Cancel any active speech on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, []);

  // Map to hold responses per alert ID (never auto-call)
  const [copilotResponses, setCopilotResponses] = useState<Record<string, CopilotResponse>>({});
  const copilotMutation = useCopilot();

  // Synchronize context sol with replaySol while mounted, restore on unmount
  useEffect(() => {
    const prevSol = initialSolRef.current;
    return () => {
      setSol(prevSol);
    };
  }, [setSol]);

  useEffect(() => {
    setSol(replaySol);
  }, [replaySol, setSol]);

  // Keep the EYE scene effect exactly byte-for-byte
  useEffect(() => {
    const previousScene = scene;
    const previousImmersive = immersive;
    const previousProgress = scrollProgress.current;
    setScene(EYE.id);
    scrollProgress.current = 1;
    setImmersive(true);
    return () => {
      setScene(previousScene);
      setImmersive(previousImmersive);
      scrollProgress.current = previousProgress;
    };
  }, [scrollProgress, setImmersive, setScene]);

  // Stop at last sol via dedicated effect (no state side-effects in updaters)
  useEffect(() => {
    if (replaySol >= REPLAY_LAST_SOL && isPlaying) {
      setIsPlaying(false);
    }
  }, [replaySol, isPlaying]);

  // 1.5s timer for replay playback; do not advance to an uncached sol
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setReplaySol((prev) => {
        const next = prev + 1;
        if (next > REPLAY_LAST_SOL) {
          return prev;
        }
        const cached = queryClient.getQueryData(['scenario', next]);
        if (!cached) {
          return prev;
        }
        return next;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [isPlaying, queryClient]);

  const { data: scenario, isLoading, isFetching, isError, error } = useScenario(replaySol);

  // Narration for new alerts while playing (never cuts off copilot guidance)
  useEffect(() => {
    if (!isPlaying || !narrationEnabled || !scenario?.alerts) return;
    if (isCopilotSpeaking()) return;

    for (const alert of scenario.alerts) {
      if (!spokenAlertIdsRef.current.has(alert.id)) {
        spokenAlertIdsRef.current.add(alert.id);
        const text = formatAlertNarration(scenario.sol, alert);
        speak(text);
      }
    }
  }, [isPlaying, narrationEnabled, scenario]);

  const handlePlayToggle = () => {
    prime();
    if (replaySol >= REPLAY_LAST_SOL && !isPlaying) {
      setReplaySol(REPLAY_FIRST_SOL);
    }
    if (isPlaying) {
      cancel();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    cancel();
    spokenAlertIdsRef.current.clear();
    setIsPlaying(false);
    setReplaySol(REPLAY_FIRST_SOL);
  };

  const handleNarrationToggle = (next: boolean) => {
    setNarrationEnabled(next);
    if (!next) {
      cancel();
    }
  };

  const handleAskCopilot = (alertId: string, crewId: string) => {
    prime();
    copilotMutation.mutate(
      { crewId, sol: replaySol },
      {
        onSuccess: (data) => {
          setCopilotResponses((prev) => ({ ...prev, [alertId]: data }));
          if (narrationEnabled) {
            speak(formatCopilotNarration(data), { isCopilot: true });
          }
        },
      }
    );
  };

  // Filter events up to this Sol
  const eventsUpToSol = scenario?.events
    ? scenario.events.filter((e) => e.sol <= replaySol)
    : [];

  return (
    <div className={`replay-container ${isPlaying ? 'is-playing' : ''}`}>
      <header className="replay-header">
        <span className="replay-eyebrow">Mission Scenario Playback</span>
        <h1>Mission Replay</h1>
        <p>
          Simulate mission telemetry across the replay window: SPE radiation event, cardiovascular strain,
          and AI Copilot recommended countermeasure responses.
        </p>
      </header>

      {/* Playback Controls */}
      <section className="replay-controls-card">
        <div className="replay-button-group">
          <button
            type="button"
            className="replay-btn replay-btn-primary"
            onClick={handlePlayToggle}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            className="replay-btn"
            onClick={handleReset}
          >
            Reset
          </button>
          <NarrationToggle
            enabled={narrationEnabled}
            onToggle={handleNarrationToggle}
          />
        </div>

        <div className="replay-slider-wrap">
          <span className="text-xs font-mono text-slate-400">Sol {REPLAY_FIRST_SOL}</span>
          <input
            type="range"
            min={REPLAY_FIRST_SOL}
            max={REPLAY_LAST_SOL}
            step={1}
            value={replaySol}
            onChange={(e) => {
              cancel();
              setIsPlaying(false);
              setReplaySol(Number(e.target.value));
            }}
            className="replay-slider"
            aria-label="Mission Sol slider"
          />
          <span className="text-xs font-mono text-slate-400">Sol {REPLAY_LAST_SOL}</span>
        </div>

        <div className="replay-sol-indicator">
          SOL {replaySol}
        </div>
      </section>

      {isLoading && !scenario && (
        <p className="text-sm text-slate-400 mb-6">Loading scenario telemetry for Sol {replaySol}...</p>
      )}

      {isError && !scenario && (
        <p className="text-sm text-rose-400 mb-6">
          Failed to load scenario telemetry: {error?.message || 'Scenario data unavailable'}
        </p>
      )}

      {scenario && (
        <div className={isFetching ? 'replay-content-dimmed' : 'replay-content-normal'}>
          {/* Crew Status Grid */}
          <section className="mb-8">
            <h2 className="replay-section-title">Crew Resilience Readout (Sol {scenario.sol})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {scenario.crew.map((member) => {
                const crewStatus = statusToCrewStatus(member.status);
                return (
                  <div key={member.id} className="replay-crew-card">
                    <div className="replay-crew-header">
                      <div>
                        <span className="replay-crew-id">{member.id}</span>
                        <div className="replay-crew-name">{member.callsign}</div>
                      </div>
                      <StatusBadge status={crewStatus} />
                    </div>
                    <div>
                      <div className="replay-crew-cri">
                        <CountUp value={member.cri} duration={900} />
                      </div>
                      <div className="replay-crew-driver">{member.topDriver}</div>
                    </div>
                    <ResilienceBar value={member.cri} status={crewStatus} />
                  </div>
                );
              })}
            </div>
          </section>

          {/* Active Alerts & Copilot */}
          <section className="mb-8">
            <h2 className="replay-section-title">Mission Risk Alerts</h2>
            {scenario.alerts.length === 0 ? (
              <div className="replay-alert-card text-slate-400 text-sm">
                No active anomaly alerts detected for Sol {scenario.sol}.
              </div>
            ) : (
              <div className="replay-alerts-list">
                {scenario.alerts.map((alert) => {
                  const copilotData = copilotResponses[alert.id];
                  const isMutating = copilotMutation.isPending && copilotMutation.variables?.crewId === alert.crewId;

                  return (
                    <article
                      key={alert.id}
                      className={`replay-alert-card replay-alert-card--${alert.severity}`}
                    >
                      <div className="replay-alert-header">
                        <div>
                          <span className="text-xs font-mono font-bold uppercase text-amber-400 mr-3">
                            {alert.severity}
                          </span>
                          <span className="replay-alert-meta">
                            Crew: {alert.crewId} &bull; CRI: {alert.criFrom.toFixed(1)} &rarr; {alert.criTo.toFixed(1)} &bull; ~{alert.predictedWindowHours} h risk window
                          </span>
                        </div>
                        <ProvenanceBadge provenance={alert.provenance} />
                      </div>

                      <p className="replay-alert-message">{alert.message}</p>

                      <div className="replay-drivers-tags">
                        {alert.drivers.map((driver) => (
                          <span key={driver} className="replay-driver-tag">
                            {driver}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                        <button
                          type="button"
                          className="replay-btn replay-btn-primary text-xs"
                          onClick={() => handleAskCopilot(alert.id, alert.crewId)}
                          disabled={isMutating}
                        >
                          {isMutating ? 'Querying Copilot...' : 'Ask Copilot'}
                        </button>
                        {copilotData && (
                          <span className="text-[10px] font-mono text-cyan-400">
                            Mode: {copilotData.mode}
                          </span>
                        )}
                      </div>

                      {/* Copilot Response Panel */}
                      {copilotData && (
                        <div className="replay-copilot-box">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wide">
                              Copilot Countermeasure Guidance
                            </span>
                            <ProvenanceBadge provenance="SYNTHETIC" />
                          </div>
                          <p className="text-sm text-slate-200 mb-3">{copilotData.summary}</p>
                          
                          <div className="space-y-2 mb-3">
                            {copilotData.suggestedActions.map((action) => (
                              <div
                                key={action.title}
                                className="bg-slate-900/60 p-2.5 rounded border border-slate-800"
                              >
                                <div className="text-xs font-bold text-slate-100">{action.title}</div>
                                <div className="text-xs text-slate-300 mt-1">{action.protocol}</div>
                                <div className="text-[10px] font-mono text-slate-400 mt-1">
                                  Source: {action.source}
                                </div>
                              </div>
                            ))}
                          </div>

                          {copilotData.groundedIn && copilotData.groundedIn.length > 0 && (
                            <div className="text-[10px] font-mono text-slate-400 mb-2">
                              Grounded in: {copilotData.groundedIn.join(', ')}
                            </div>
                          )}

                          <div className="text-xs text-amber-300/80 italic border-t border-slate-800/80 pt-2">
                            {copilotData.disclaimer}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Cumulative Mission Events */}
          <section>
            <h2 className="replay-section-title">Timeline Events (Up to Sol {scenario.sol})</h2>
            <div className="replay-events-card">
              {eventsUpToSol.length === 0 ? (
                <p className="text-sm text-slate-400">No events recorded up to Sol {scenario.sol}.</p>
              ) : (
                <ul className="replay-timeline">
                  {eventsUpToSol.map((ev, index) => (
                    <li key={`${ev.sol}-${ev.type}-${index}`} className="replay-timeline-item">
                      <span className="replay-timeline-dot" aria-hidden="true" />
                      <div className="replay-timeline-sol">
                        Sol {ev.sol} {ev.crewId ? `&bull; Crew ${ev.crewId}` : ''} &bull; {ev.type}
                      </div>
                      <div className="replay-timeline-text">{ev.text}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
