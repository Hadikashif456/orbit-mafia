import { useState, type FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrewSummaries } from '../hooks/useCrewSummaries';
import { useCri } from '../hooks/useCri';
import { useScenario } from '../hooks/useScenario';
import { useCopilotExplanation } from '../hooks/useCopilot';
import { IncidentReportView } from '../components/report/IncidentReportView';
import { ErrorBoundary } from '../components/ErrorBoundary';

const AVAILABLE_CREW = ['C001', 'C002', 'C003', 'C004'] as const;

const CREW_ROLES: Record<string, string> = {
  C001: 'Mission Commander',
  C002: 'Medical Officer',
  C003: 'Mission Specialist',
  C004: 'Flight Engineer',
};

export const IncidentReportContent: FC = () => {
  const { id = 'C001' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sol, setSol] = useState<number>(145);

  const { data: crewList } = useCrewSummaries(sol);
  const currentCrew = crewList?.find((c) => c.id === id);

  const { data: criResult, isLoading: criLoading, isError: criError } = useCri(id, sol);
  const { data: scenario, isLoading: scenarioLoading } = useScenario(sol);
  const { data: copilot, isLoading: copilotLoading } = useCopilotExplanation(id, sol);

  const handleCrewChange = (newId: string) => {
    navigate(`/report/${newId}`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
      {/* Controls Bar (Hidden during printing) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur">
        {/* Crew Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Select Crew:</span>
          <div className="flex gap-1.5">
            {AVAILABLE_CREW.map((crewId) => (
              <button
                key={crewId}
                type="button"
                onClick={() => handleCrewChange(crewId)}
                className={`px-3 py-1 rounded text-xs font-mono font-medium border transition-colors ${
                  id === crewId
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-200'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {crewId}
              </button>
            ))}
          </div>
        </div>

        {/* Sol Selector */}
        <div className="flex items-center gap-3">
          <label htmlFor="report-sol" className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Mission Sol:
          </label>
          <div className="flex items-center gap-2">
            <input
              id="report-sol"
              type="range"
              min={1}
              max={145}
              value={sol}
              onChange={(e) => setSol(Number(e.target.value))}
              className="w-28 sm:w-36 accent-cyan-400"
            />
            <span className="text-xs font-mono font-bold text-cyan-300 w-12">Sol {sol}</span>
          </div>
        </div>

        {/* Print Button */}
        <div>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono font-bold text-xs tracking-wider uppercase transition-colors shadow-lg shadow-cyan-950/50"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Report Body */}
      {criLoading || scenarioLoading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center">
          <p className="text-sm font-mono text-cyan-400 animate-pulse">
            Compiling commander incident summary for {id} at Sol {sol}...
          </p>
        </div>
      ) : criError || !criResult ? (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-8 text-center text-red-300 font-mono text-sm">
          Failed to load incident report telemetry for crew {id} at Sol {sol}.
        </div>
      ) : (
        <IncidentReportView
          crewId={id}
          crewName={currentCrew?.callsign}
          role={CREW_ROLES[id] || 'Flight Specialist'}
          sol={sol}
          criResult={criResult}
          allEvents={scenario?.events}
          alerts={scenario?.alerts}
          copilotResponse={copilot}
          copilotLoading={copilotLoading}
        />
      )}
    </div>
  );
};

export const IncidentReportPage: FC = () => {
  return (
    <ErrorBoundary>
      <IncidentReportContent />
    </ErrorBoundary>
  );
};
export default IncidentReportPage;
