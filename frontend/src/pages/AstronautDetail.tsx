import type { FC } from 'react';
import { useParams } from 'react-router-dom';

export const AstronautDetail: FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-100">
        Astronaut Health Detail: {id}
      </h1>
      <p className="text-sm text-slate-400 mt-1">
        Physiological vitals trends, CRI stress breakdown, and NASA OSDR biomarker panel.
      </p>
    </div>
  );
};
