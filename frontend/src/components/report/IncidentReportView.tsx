import type { FC } from 'react';
import type { CRIResult, ScenarioEvent, Alert, CopilotResponse } from '../../api/types';
import { buildIncidentReportData } from '../../lib/report';
import { ProvenanceBadge } from '../ProvenanceBadge';

interface IncidentReportViewProps {
  crewId: string;
  crewName?: string;
  role?: string;
  sol: number;
  criResult: CRIResult;
  allEvents?: ScenarioEvent[];
  alerts?: Alert[];
  copilotResponse?: CopilotResponse;
  copilotLoading?: boolean;
}

export const IncidentReportView: FC<IncidentReportViewProps> = ({
  crewId,
  crewName = 'Astronaut',
  role = 'Flight Specialist',
  sol,
  criResult,
  allEvents,
  alerts,
  copilotResponse,
  copilotLoading,
}) => {
  const report = buildIncidentReportData({
    crewId,
    sol,
    criResult,
    allEvents,
    alerts,
  });

  return (
    <article className="incident-report-print max-w-4xl mx-auto rounded-xl border border-slate-800 bg-slate-900/70 p-6 md:p-8 space-y-6 text-slate-100 print:bg-white print:text-black print:border-none print:p-0 print:m-0">
      {/* Report Classification Header */}
      <header className="border-b border-slate-700/80 pb-5 space-y-2 print:border-black print:pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold tracking-widest text-cyan-400 print:text-black uppercase">
              MISSION COMMAND PROTOCOL // INCIDENT SUMMARY
            </span>
            <span className="text-xs text-slate-500 print:text-black">•</span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/50 text-amber-300 print:border-black print:text-black print:bg-transparent">
              SIMULATED
            </span>
          </div>
          <div className="print:hidden">
            <ProvenanceBadge provenance="SYNTHETIC" />
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 pt-1">
          <div>
            <h1 className="text-2xl md:text-3xl font-mono font-bold text-white print:text-black">
              {crewName} <span className="text-slate-400 font-mono text-lg print:text-black">({crewId})</span>
            </h1>
            <p className="text-xs font-mono text-slate-400 print:text-black">
              Role: {role} • Sol {sol} Telemetry Snapshot
            </p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-black/40 px-4 py-2 text-right print:border-black print:bg-transparent">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 print:text-black">
              Current CRI Score
            </div>
            <div className="text-2xl font-mono font-bold text-cyan-400 print:text-black">
              {report.cri.toFixed(1)}{' '}
              <span className="text-xs font-semibold uppercase text-amber-400 print:text-black">
                ({report.status})
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Active Alerts */}
      <section className="print-avoid-break space-y-3">
        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300 print:text-black border-b border-slate-800 print:border-gray-300 pb-1">
          1. Active Operational Alerts & Risk Flags
        </h2>
        {report.alerts.length === 0 ? (
          <p className="text-xs font-mono text-slate-400 print:text-black italic">
            No active safety alerts logged for {crewId} at Sol {sol}.
          </p>
        ) : (
          <div className="space-y-2">
            {report.alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded border border-red-900/50 bg-red-950/20 p-3 text-xs font-mono print:border-black print:bg-transparent"
              >
                <div className="flex items-center justify-between text-red-300 print:text-black font-semibold">
                  <span>Alert ID: {alert.id} [{alert.severity.toUpperCase()}]</span>
                  <span>CRI: {alert.criFrom.toFixed(1)} → {alert.criTo.toFixed(1)}</span>
                </div>
                <p className="mt-1 text-slate-200 print:text-black">{alert.message}</p>
                <div className="mt-2 text-slate-400 print:text-black text-[11px]">
                  <strong>Key Drivers:</strong> {alert.drivers.join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Top 3 Recovery Levers */}
      <section className="print-avoid-break space-y-3">
        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300 print:text-black border-b border-slate-800 print:border-gray-300 pb-1">
          2. Primary Physiological Recovery Levers (Top 3)
        </h2>
        {report.topLevers.length === 0 ? (
          <p className="text-xs font-mono text-slate-400 print:text-black italic">
            No deficit detected. Crew member resilience is at optimal baseline (100).
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {report.topLevers.map((lever, idx) => (
              <div
                key={lever.factor}
                className="rounded border border-slate-800 bg-black/30 p-3 text-xs font-mono print:border-black print:bg-transparent"
              >
                <div className="text-[10px] uppercase text-slate-500 print:text-black font-bold">
                  Priority #{idx + 1}
                </div>
                <div className="font-semibold text-slate-200 print:text-black mt-1">
                  {lever.label}
                </div>
                <div className="mt-2 text-emerald-400 print:text-black text-sm font-bold">
                  +{lever.points.toFixed(1)} CRI pts
                </div>
                <div className="text-[11px] text-slate-400 print:text-black mt-0.5">
                  {lever.percentageOfDeficit.toFixed(1)}% of total deficit
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Scenario Events Timeline Up to Sol */}
      <section className="print-avoid-break space-y-3">
        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300 print:text-black border-b border-slate-800 print:border-gray-300 pb-1">
          3. Incident & Scenario Event Log (Up to Sol {sol})
        </h2>
        {report.events.length === 0 ? (
          <p className="text-xs font-mono text-slate-400 print:text-black italic">
            No mission events recorded prior to Sol {sol}.
          </p>
        ) : (
          <ul className="space-y-1.5 text-xs font-mono divide-y divide-slate-800/60 print:divide-gray-300">
            {report.events.slice(0, 5).map((evt, i) => (
              <li key={`${evt.sol}-${i}`} className="pt-1.5 flex items-start justify-between gap-4">
                <div>
                  <span className="font-semibold text-cyan-400 print:text-black">Sol {evt.sol}: </span>
                  <span className="text-slate-200 print:text-black">{evt.text}</span>
                </div>
                <span className="text-[10px] text-slate-500 print:text-black uppercase whitespace-nowrap">
                  {evt.type}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Copilot Clinical Advisory & Actions */}
      <section className="print-avoid-break space-y-3">
        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300 print:text-black border-b border-slate-800 print:border-gray-300 pb-1">
          4. Medical Copilot Countermeasure Guidance
        </h2>
        {copilotLoading ? (
          <p className="text-xs font-mono text-slate-500 print:text-black animate-pulse">
            Querying clinical copilot countermeasures...
          </p>
        ) : copilotResponse ? (
          <div className="space-y-3 text-xs">
            <div className="rounded border border-slate-800 bg-black/20 p-3 print:border-black print:bg-transparent">
              <span className="font-mono font-bold text-slate-300 print:text-black">Assessment Summary: </span>
              <span className="text-slate-200 print:text-black">{copilotResponse.summary}</span>
            </div>

            {copilotResponse.suggestedActions.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-mono font-semibold text-slate-300 print:text-black text-xs">
                  Prescribed Protocol Countermeasures:
                </div>
                <ul className="list-disc list-inside space-y-1 font-mono text-slate-300 print:text-black pl-1">
                  {copilotResponse.suggestedActions.map((action, i) => (
                    <li key={i}>
                      <strong className="text-slate-100 print:text-black">{action.title}</strong>{' '}
                      <span className="text-slate-400 print:text-black">({action.source})</span>: {action.protocol}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs font-mono text-slate-400 print:text-black italic">
            Copilot countermeasure analysis available upon trigger.
          </p>
        )}
      </section>

      {/* Mandatory Disclaimer & Commander Signoff */}
      <footer className="print-avoid-break border-t border-slate-700/80 pt-4 space-y-2 text-xs font-mono text-slate-400 print:border-black print:text-black">
        <div className="p-2.5 rounded bg-black/40 border border-slate-800 text-[11px] print:border-black print:bg-transparent">
          <strong>Operational Policy:</strong> Risk flags and suggested countermeasures only. Not a medical diagnosis.
          Telemetry calibrated against Inspiration4 LEO mission profile.
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 print:text-black pt-1">
          <span>ORBIT MAFIA AUTONOMOUS RESILIENCE PLATFORM</span>
          <span>REPORT STAMP: SOL {sol} // CREW {crewId}</span>
        </div>
      </footer>
    </article>
  );
};
