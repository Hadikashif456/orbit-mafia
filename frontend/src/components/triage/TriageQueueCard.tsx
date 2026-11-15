import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { CountUp } from '../CountUp';
import { StatusBadge } from '../crew/StatusBadge';
import { ResilienceBar } from '../crew/ResilienceBar';
import { ProvenanceBadge } from '../ProvenanceBadge';
import { statusToCrewStatus } from '../../api/adapters';
import type { RankedCrewMember } from '../../lib/triage';

export interface TriageQueueCardProps {
  item: RankedCrewMember;
}

export const TriageQueueCard: FC<TriageQueueCardProps> = ({ item }) => {
  const { rank, member, recentDrop, reason } = item;
  const crewStatus = statusToCrewStatus(member.status);

  const getRankBadgeClasses = (r: number) => {
    switch (r) {
      case 1:
        return 'bg-rose-500/20 text-rose-300 border-rose-500/50';
      case 2:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/50';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <article
      className="p-5 rounded-xl border border-slate-700/80 bg-slate-900/95 shadow-xl flex flex-col gap-4"
      aria-label={`Triage rank ${rank}: ${member.callsign} (${member.id})`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`font-mono text-xs font-bold px-2.5 py-1 rounded-md border ${getRankBadgeClasses(
              rank
            )}`}
          >
            PRIORITY #{rank}
          </span>
          <div>
            <span className="font-mono text-xs text-cyan-400 block">{member.id}</span>
            <h2 className="text-base font-bold text-white leading-tight">{member.callsign}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={crewStatus} />
          <ProvenanceBadge provenance={member.provenance} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 py-2 border-y border-slate-800/80">
        <div>
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
            CRI Score
          </span>
          <div className="font-mono text-2xl font-extrabold text-white">
            <CountUp value={member.cri} duration={900} />
          </div>
        </div>
        <div>
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
            Top Driver
          </span>
          <div className="text-sm font-semibold text-slate-200 mt-0.5 truncate">
            {member.topDriver}
          </div>
          {recentDrop > 0 && (
            <span className="text-[10px] font-mono text-rose-400 block mt-0.5">
              &darr; -{recentDrop} pt drop
            </span>
          )}
        </div>
      </div>

      <ResilienceBar value={member.cri} status={crewStatus} />

      <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded border border-slate-800/80 leading-relaxed">
        {reason}
      </p>

      <div className="flex items-center justify-end gap-3 pt-1">
        <Link
          to={`/crew/${member.id}`}
          className="text-xs font-mono font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
        >
          View Telemetry
        </Link>
        <Link
          to={`/alert/${member.id}`}
          className="text-xs font-mono font-medium px-3 py-1.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/60 transition-colors"
        >
          View Risk Alert
        </Link>
      </div>
    </article>
  );
};
