import type { FC } from 'react';
import type { Provenance } from '../api/types';

interface ProvenanceBadgeProps {
  provenance: Provenance;
}

export const ProvenanceBadge: FC<ProvenanceBadgeProps> = ({ provenance }) => {
  const getBadgeStyle = (prov: Provenance) => {
    switch (prov) {
      case 'REAL_OSDR':
        return 'bg-emerald-950/80 border-emerald-600/50 text-emerald-300';
      case 'SYNTHETIC':
        return 'bg-cyan-950/80 border-cyan-600/50 text-cyan-300';
      case 'CURATED':
        return 'bg-purple-950/80 border-purple-600/50 text-purple-300';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${getBadgeStyle(
        provenance
      )}`}
    >
      {provenance}
    </span>
  );
};
