import { useState, type FC } from 'react';
import type { Provenance } from '../../api/types';
import { ProvenanceBadge } from '../ProvenanceBadge';
import { TRUST_ENTRIES, filterTrustEntries, type TrustEntry } from '../../lib/trust';

interface TrustTableProps {
  entries?: TrustEntry[];
}

export const TrustTable: FC<TrustTableProps> = ({ entries = TRUST_ENTRIES }) => {
  const [filter, setFilter] = useState<Provenance | 'ALL'>('ALL');

  const filtered = filterTrustEntries(entries, filter);

  return (
    <div className="space-y-4">
      {/* Provenance Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400 font-mono uppercase tracking-wider mr-2">Filter Provenance:</span>
        {(['ALL', 'REAL_OSDR', 'SYNTHETIC', 'CURATED'] as const).map((prov) => (
          <button
            key={prov}
            type="button"
            onClick={() => setFilter(prov)}
            aria-pressed={filter === prov}
            className={`px-3 py-1 rounded text-xs font-mono font-medium border transition-colors ${
              filter === prov
                ? 'bg-slate-700/80 border-slate-400 text-white shadow-sm'
                : 'bg-slate-900/60 border-slate-700/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {prov}
          </button>
        ))}
        <span className="text-xs text-slate-500 font-mono ml-auto">
          Showing {filtered.length} of {entries.length} data streams
        </span>
      </div>

      {/* Responsive Table Container */}
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60 backdrop-blur">
        <table className="w-full text-left border-collapse text-xs md:text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-800/40 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
              <th className="py-3 px-4 font-semibold">Dataset / Telemetry Stream</th>
              <th className="py-3 px-4 font-semibold">Provenance</th>
              <th className="py-3 px-4 font-semibold">Origin & Source Citation</th>
              <th className="py-3 px-4 font-semibold">Role in CRI Scoring</th>
              <th className="py-3 px-4 font-semibold">Operational Limitations</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4 font-medium text-slate-100">{item.datasetOrMetric}</td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <ProvenanceBadge provenance={item.provenance} />
                </td>
                <td className="py-3 px-4 text-slate-400 font-mono text-xs">{item.source}</td>
                <td className="py-3 px-4 text-slate-300">{item.whatItFeedsInCRI}</td>
                <td className="py-3 px-4 text-amber-300/80 font-mono text-xs leading-relaxed">
                  {item.limitation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
