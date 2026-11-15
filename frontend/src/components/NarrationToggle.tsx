import type { FC } from 'react';
import { isSupported } from '../lib/narration';

export interface NarrationToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  className?: string;
}

export const NarrationToggle: FC<NarrationToggleProps> = ({
  enabled,
  onToggle,
  className,
}) => {
  if (!isSupported()) {
    return (
      <span className="text-xs font-mono text-slate-500 italic py-1 px-2">
        Narration unavailable in this browser
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={() => onToggle(!enabled)}
      className={
        className ||
        `replay-btn text-xs font-mono transition-colors ${
          enabled ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800' : 'text-slate-400'
        }`
      }
    >
      Narration: {enabled ? 'ON' : 'OFF'}
    </button>
  );
};
