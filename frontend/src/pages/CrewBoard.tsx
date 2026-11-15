import { useEffect, useMemo, type FC } from 'react';
import { Link } from 'react-router-dom';
import { useCosmos } from '../cosmos/CosmosContext';
import { SCENES } from '../cosmos/scenes';
import { useMissionSol } from '../context/SolContext';
import { useCrewSummaries } from '../hooks/useCrewSummaries';
import { toCrewMember } from '../api/adapters';
import { Users, ChevronRight, ExternalLink } from 'lucide-react';

const LAST_SCREEN = SCENES.findIndex((s) => s.id === 'dreamscape');
const PROGRESS_SPAN = LAST_SCREEN / (SCENES.length - 1);

export const CrewBoard: FC = () => {
  const { scene, setScene, setImmersive, scrollProgress } = useCosmos();
  const { sol } = useMissionSol();
  const { data: summaries, isLoading, isError, refetch } = useCrewSummaries(sol);

  const members = useMemo(() => {
    return summaries ? summaries.map(toCrewMember) : [];
  }, [summaries]);

  useEffect(() => {
    const previousScene = scene;
    const measure = (): void => {
      const range = document.documentElement.scrollHeight - window.innerHeight;
      const along = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0;
      scrollProgress.current = along * PROGRESS_SPAN;
    };
    measure();
    setScene('solaris');
    setImmersive(true);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      setScene(previousScene);
      setImmersive(false);
      scrollProgress.current = 0;
    };
  }, [scrollProgress, setImmersive, setScene]);

  return (
    <div className="relative text-slate-100 select-text cursor-default">
      {/* ================= HERO OVERVIEW ================= */}
      <section aria-label="Hero Overview" className="relative py-12 sm:py-16 lg:py-20 flex items-center z-20">
        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-start">
          <div
            className="max-w-2xl text-left"
            style={{ textShadow: '0 2px 28px rgba(0,0,0,0.9)' }}
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-badge text-cyan-300 text-xs font-mono mb-4">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>AUTONOMOUS CREW HEALTH RESILIENCE · MOON & MARS TRANSIT</span>
            </div>

            <h1 className="text-5xl font-black uppercase leading-none tracking-tight text-white sm:text-6xl lg:text-7xl">
              Orbit <span className="text-cyan-400">Mafia</span>
            </h1>

            <p className="mt-5 max-w-2xl font-serif text-xl sm:text-2xl lg:text-3xl italic leading-snug text-slate-200">
              In the Silence of Space,{' '}
              <span className="whitespace-nowrap text-[#ffe0a3]">Every Heartbeat Matters.</span>
            </p>

           

            {/* Quick Telemetry Ticker */}
            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-mono">
              <span className="px-3 py-1 rounded-md bg-slate-900/80 backdrop-blur-md border border-white/[0.08] text-slate-300 shadow-sm">
                MISSION SOL: <strong className="text-cyan-400">{sol}</strong>
              </span>
              <span className="px-3 py-1 rounded-md bg-slate-900/80 backdrop-blur-md border border-white/[0.08] text-slate-300 shadow-sm">
                CREW MONITORED: <strong className="text-white">4 ASTRONAUTS</strong>
              </span>
              <span className="px-3 py-1 rounded-md bg-amber-950/60 backdrop-blur-md border border-amber-500/40 text-amber-300 shadow-sm">
                WARNING: <strong>1 ACTIVE (CMDR B)</strong>
              </span>
              <span className="px-3 py-1 rounded-md bg-slate-900/80 backdrop-blur-md border border-white/[0.08] text-slate-300 shadow-sm">
                COMMS LAG: <strong className="text-cyan-400">22.1 MIN</strong>
              </span>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/crew"
                className="glass-btn-primary group px-6 py-3 text-sm sm:text-base cursor-pointer"
              >
                <span>Enter Crew Board</span>
                <span className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">→</span>
              </Link>
              <Link
                to="/demo"
                className="glass-btn-secondary px-5 py-3 text-sm sm:text-base cursor-pointer"
              >
                <span>Mission Replay</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= LIVE CREW FLEET TELEMETRY STRIP ================= */}
      <section
        aria-label="Live Crew Resilience Snapshot"
        className="pb-16 pt-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-20"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-mono uppercase text-cyan-400 tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Mission Sol {sol} Fleet Status</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Live Crew Health Snapshot
            </h2>
          </div>
          <Link
            to="/crew"
            className="text-xs font-mono text-cyan-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-btn-sm transition-all"
          >
            <span>Full Crew Board</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Dynamic Crew Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/[0.08] animate-pulse h-36"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
            <p className="text-sm text-slate-300">Unable to load live fleet telemetry.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 px-3 py-1 text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 rounded hover:bg-cyan-900 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {members.map((member) => {
              const isAmber = member.status === 'watch';
              const isActNow = member.status === 'act_now';
              const statusBadge = isActNow
                ? { label: 'ACT-NOW', color: 'text-rose-400 bg-rose-950/80 border-rose-800' }
                : isAmber
                ? { label: 'WATCH', color: 'text-amber-300 bg-amber-950/80 border-amber-800' }
                : { label: 'OPTIMAL', color: 'text-emerald-400 bg-emerald-950/80 border-emerald-800' };

              return (
                <Link
                  key={member.id}
                  to={`/crew/${member.id}`}
                  className={`p-5 rounded-2xl bg-slate-900/75 backdrop-blur-md border transition-all duration-200 hover:-translate-y-1 hover:shadow-xl block ${
                    isActNow
                      ? 'border-rose-500/50 hover:border-rose-400 hover:shadow-rose-950/50'
                      : isAmber
                      ? 'border-amber-500/50 hover:border-amber-400 hover:shadow-amber-950/50'
                      : 'border-white/[0.1] hover:border-cyan-500/50 hover:shadow-cyan-950/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs text-slate-400">{member.code}</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${statusBadge.color}`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white truncate">{member.name}</h3>
                  <div className="text-xs text-slate-300 truncate mt-0.5">{member.role}</div>

                  <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 block uppercase">
                        CRI Resilience
                      </span>
                      <span
                        className={`text-2xl font-bold font-mono ${
                          isActNow
                            ? 'text-rose-400'
                            : isAmber
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                        }`}
                      >
                        {member.cri.toFixed(1)}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-cyan-400 flex items-center gap-1 group-hover:underline">
                      <span>Inspect</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
