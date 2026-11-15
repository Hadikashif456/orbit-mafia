import type { FC } from 'react';
import { formatCountdown } from '../../lib/comms';

export interface EarthLinkControlsProps {
  isEarthLinkLost: boolean;
  onToggleLink: (lost: boolean) => void;
  delayMinutes: number;
  onDelayChange: (mins: number) => void;
  remainingSeconds: number;
}

export const EarthLinkControls: FC<EarthLinkControlsProps> = ({
  isEarthLinkLost,
  onToggleLink,
  delayMinutes,
  onDelayChange,
  remainingSeconds,
}) => {
  return (
    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur shadow-lg flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-mono uppercase text-slate-400 block tracking-wider">
            Deep-Space Comms Array
          </span>
          <h2 className="text-lg font-bold text-white">Earth Ground Link Status</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleLink(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all ${
              !isEarthLinkLost
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-600 shadow-sm shadow-emerald-900/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            LINK: OK
          </button>
          <button
            type="button"
            onClick={() => onToggleLink(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all ${
              isEarthLinkLost
                ? 'bg-rose-950/70 text-rose-300 border-rose-600 shadow-sm shadow-rose-900/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            LINK: LOST
          </button>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <label htmlFor="delay-slider" className="text-slate-300">
            SIMULATED light-time delay (one-way):
          </label>
          <span className="text-cyan-400 font-bold">{delayMinutes} min</span>
        </div>
        <input
          id="delay-slider"
          type="range"
          min={3}
          max={22}
          step={1}
          value={delayMinutes}
          onChange={(e) => onDelayChange(Number(e.target.value))}
          className="w-full accent-cyan-400 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] font-mono text-slate-500">
          <span>3 min (Orbital / Lunar boundary)</span>
          <span>14 min (Mars nominal)</span>
          <span>22 min (Mars opposition)</span>
        </div>
      </div>

      {isEarthLinkLost ? (
        <div className="p-4 rounded-lg bg-rose-950/30 border border-rose-900/50 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-rose-400 font-bold block uppercase tracking-wider">
              Earth Link Blackout
            </span>
            <span className="text-xs text-slate-300">
              No real-time ground intervention. Onboard autonomous copilot operating locally.
            </span>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] font-mono text-slate-400 block uppercase">
              Earth reply in
            </span>
            <span className="text-xl font-mono font-extrabold text-amber-400">
              {formatCountdown(remainingSeconds)}
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-900/50 flex items-center justify-between">
          <div className="text-xs text-slate-300">
            Ground telemetry downlink nominal. Light-time latency:{' '}
            <span className="font-mono text-emerald-400 font-bold">{delayMinutes} min</span> one-way.
          </div>
        </div>
      )}
    </div>
  );
};
