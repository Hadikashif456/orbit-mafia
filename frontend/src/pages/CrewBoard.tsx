import type { FC } from 'react';

export const CrewBoard: FC = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-100">
        Crew Resilience Board
      </h1>
      <p className="text-sm text-slate-400 mt-1">
        Real-time Crew Resilience Index (CRI) overview for 4 crew members.
      </p>
    </div>
  );
};
