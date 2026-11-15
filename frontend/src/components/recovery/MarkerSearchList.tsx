import { useState, useEffect, useMemo, type FC } from 'react';

export interface MarkerSearchListProps {
  markers: string[];
  selectedMarker: string;
  onSelectMarker: (marker: string) => void;
  className?: string;
}

export const MarkerSearchList: FC<MarkerSearchListProps> = ({
  markers,
  selectedMarker,
  onSelectMarker,
  className,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // 200ms debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      // Sanitize: strip dangerous characters, enforce max 40 chars
      const sanitized = searchTerm.replace(/[<>{}[\]\\]/g, '').slice(0, 40);
      setDebouncedSearch(sanitized);
    }, 200);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  const filteredMarkers = useMemo(() => {
    if (!debouncedSearch.trim()) return markers;
    const lower = debouncedSearch.trim().toLowerCase();
    return markers.filter((m) => m.toLowerCase().includes(lower));
  }, [markers, debouncedSearch]);

  return (
    <div className={`flex flex-col gap-2 ${className || ''}`}>
      <div className="relative">
        <input
          type="text"
          maxLength={40}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value.slice(0, 40))}
          placeholder="Filter 68 immune analytes..."
          className="w-full px-3 py-1.5 text-xs rounded bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition-colors"
          aria-label="Filter biomarkers by name"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-slate-200"
            aria-label="Clear search"
          >
            &times;
          </button>
        )}
      </div>

      <div
        className="max-h-40 overflow-y-auto rounded border border-slate-800 bg-slate-950/70 p-1 flex flex-wrap gap-1"
        role="listbox"
        aria-label="Available biomarker analytes"
      >
        {filteredMarkers.length === 0 ? (
          <span className="text-xs text-slate-500 px-2 py-1 italic">
            No matching analytes found
          </span>
        ) : (
          filteredMarkers.map((marker) => {
            const isSelected = marker === selectedMarker;
            return (
              <button
                key={marker}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelectMarker(marker)}
                className={`text-xs px-2 py-1 rounded transition-colors font-mono text-left ${
                  isSelected
                    ? 'bg-cyan-900/80 text-cyan-200 font-bold border border-cyan-600'
                    : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
                }`}
              >
                {marker}
              </button>
            );
          })
        )}
      </div>
      <span className="text-[10px] font-mono text-slate-500">
        Showing {filteredMarkers.length} of {markers.length} analytes
      </span>
    </div>
  );
};
