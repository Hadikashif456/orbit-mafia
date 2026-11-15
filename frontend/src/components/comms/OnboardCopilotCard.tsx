import { useEffect, type FC } from 'react';
import { ProvenanceBadge } from '../ProvenanceBadge';
import {
  prime,
  speak,
  cancel,
  formatAlertScreenNarration,
  useSpeaking,
  isSupported,
} from '../../lib/narration';
import type { CopilotResponse } from '../../api/types';

export interface OnboardCopilotCardProps {
  copilot: CopilotResponse;
  crewId: string;
  sol: number;
}

export const OnboardCopilotCard: FC<OnboardCopilotCardProps> = ({ copilot, crewId, sol }) => {
  const speaking = useSpeaking();

  useEffect(() => {
    return () => {
      cancel();
    };
  }, []);

  const handleReadAloud = () => {
    prime();
    speak(
      formatAlertScreenNarration({
        summary: copilot.summary,
        drivers: copilot.drivers,
        suggestedActions: copilot.suggestedActions,
        disclaimer: copilot.disclaimer,
      }),
      { isCopilot: true }
    );
  };

  const handleStop = () => {
    cancel();
  };

  return (
    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur shadow-lg flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs px-2.5 py-1 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 uppercase">
            Mode: {copilot.mode}
          </span>
          <span className="text-xs font-mono text-slate-400">
            Crew: {crewId} &bull; Sol {sol}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isSupported() ? (
            <>
              <button
                type="button"
                onClick={handleReadAloud}
                disabled={speaking}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
              >
                {speaking ? 'Speaking...' : 'Read aloud'}
              </button>
              {speaking && (
                <button
                  type="button"
                  onClick={handleStop}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border border-rose-800 transition-colors"
                >
                  Stop
                </button>
              )}
            </>
          ) : (
            <span className="text-xs font-mono text-slate-500 italic">
              Narration unavailable
            </span>
          )}
          <ProvenanceBadge provenance="SYNTHETIC" />
        </div>
      </div>

      <div className="text-xs font-mono text-cyan-300 bg-cyan-950/30 p-2.5 rounded border border-cyan-800/40">
        Onboard copilot works without Earth. Delay is simulated. Data is Inspiration4-based.
      </div>

      <div>
        <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
          Clinical Guidance Summary
        </h3>
        <p className="text-sm text-slate-100 leading-relaxed">{copilot.summary}</p>
      </div>

      {copilot.drivers.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5">
            Contributing Physiological Drivers
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {copilot.drivers.map((driver) => (
              <span
                key={driver}
                className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700"
              >
                {driver}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
          Recommended Autonomous Countermeasures
        </h3>
        <div className="space-y-2">
          {copilot.suggestedActions.map((action) => (
            <article
              key={action.title}
              className="p-3 rounded-lg bg-slate-950/60 border border-slate-800"
            >
              <h4 className="text-xs font-bold text-slate-100">{action.title}</h4>
              <p className="text-xs text-slate-300 mt-1 leading-normal">{action.protocol}</p>
              <div className="text-[10px] font-mono text-slate-400 mt-1.5">
                Source: {action.source}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="text-xs text-amber-300/80 italic border-t border-slate-800/80 pt-3">
        {copilot.disclaimer}
      </div>
    </div>
  );
};
