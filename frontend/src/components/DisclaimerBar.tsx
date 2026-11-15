import type { FC } from 'react';
import { ShieldAlert } from 'lucide-react';

export const DisclaimerBar: FC = () => {
  return (
    <div
      role="alert"
      className="bg-slate-950/90 border-b border-slate-800 text-slate-300 px-4 py-2 text-xs flex items-center justify-center gap-2 font-mono tracking-wide"
    >
      <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
      <span>
        Risk flags and suggested countermeasures only. Not a medical diagnosis.
      </span>
    </div>
  );
};
