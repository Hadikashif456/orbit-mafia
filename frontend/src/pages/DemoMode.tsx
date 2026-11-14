import type { FC } from 'react';

export const DemoMode: FC = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-100">
        Mission Timeline Demo Mode
      </h1>
      <p className="text-sm text-slate-400 mt-1">
        Replay Sol 140–145: SPE radiation spike, CRI drop, and Copilot countermeasure trigger.
      </p>
    </div>
  );
};
