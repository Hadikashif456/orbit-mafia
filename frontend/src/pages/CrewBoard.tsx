import { useEffect, useMemo, type FC } from 'react';
import { Link } from 'react-router-dom';
import { CosmicDreamscape } from '../cosmos/CosmicDreamscape';
import { useCosmos } from '../cosmos/CosmosContext';
import { ObsidianSolaris } from '../cosmos/ObsidianSolaris';
import { SCENES } from '../cosmos/scenes';
import { useMissionSol } from '../context/SolContext';
import { useCrewSummaries } from '../hooks/useCrewSummaries';
import { toCrewMember } from '../api/adapters';
import {
  Users,
  Activity,
  Radio,
  Play,
  Layers,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

const LAST_SCREEN = SCENES.findIndex((s) => s.id === 'dreamscape');
const PROGRESS_SPAN = LAST_SCREEN / (SCENES.length - 1);

interface PlatformModule {
  id: string;
  title: string;
  description: string;
  to: string;
  linkText: string;
  icon: typeof Activity;
  badge?: string;
}

const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: 'triage',
    title: 'Automated Triage Queue',
    description: 'Real-time astronaut prioritization ranking crew by physiological criticality and rate of change.',
    to: '/triage',
    linkText: 'Open Queue',
    icon: Activity,
    badge: 'AUTONOMOUS',
  },
  {
    id: 'comms',
    title: 'Earth Comms Latency Buffer',
    description: 'Simulates light-speed communication delays up to 22.1 minutes with autonomous offline Copilot.',
    to: '/comms',
    linkText: 'Simulate Comms',
    icon: Radio,
    badge: '22-MIN LAG',
  },
  {
    id: 'recovery',
    title: 'Multi-Omics Recovery Curves',
    description: 'Longitudinal return-to-baseline modeling across cytokines, cardiovascular markers, and cf-mtDNA.',
    to: '/recovery',
    linkText: 'View Recovery',
    icon: Sparkles,
    badge: 'NASA OSDR',
  },
  {
    id: 'crew',
    title: 'Crew Resilience Board',
    description: 'Traffic-light triage across all 4 astronauts with real-time CRI 0–100 and vital sparklines.',
    to: '/crew',
    linkText: 'Enter Board',
    icon: Users,
    badge: '4 ASTRONAUTS',
  },
  {
    id: 'demo',
    title: 'Mission Replay (Sol 140–145)',
    description: 'Interactive solar particle event playback demonstrating 48-hour early warning detection.',
    to: '/demo',
    linkText: 'Replay Event',
    icon: Play,
    badge: '48H ALERT',
  },
  {
    id: 'drivers',
    title: 'Stressor Drivers Timeline',
    description: 'Compound multi-stressor decomposition isolating radiation, sleep debt, cardio, and CO2.',
    to: '/drivers',
    linkText: 'Inspect Drivers',
    icon: Layers,
    badge: 'COMPOUND CRI',
  },
];

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
    <div className="relative min-h-screen text-slate-100 select-text cursor-default">
      {/* ================= HERO SECTION ================= */}
      <section aria-label="Hero Overview" className="relative min-h-[85vh] flex items-center">
        <ObsidianSolaris />
        <div
          className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 z-20 text-center sm:text-left"
          style={{ textShadow: '0 2px 28px rgba(0,0,0,0.9)' }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-800/70 text-cyan-300 text-xs font-mono mb-6 shadow-md shadow-cyan-950/40">
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

          <p className="mt-4 max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed font-sans">
            Predictive physiological intelligence calculating the explainable Crew Resilience
            Index (CRI 0–100), detecting multi-stressor degradation ~48 hours early with 0s Earth
            signal dependency during communication blackouts.
          </p>

          {/* Quick Telemetry Ticker */}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-mono">
            <span className="px-3 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-slate-300">
              MISSION SOL: <strong className="text-cyan-400">{sol}</strong>
            </span>
            <span className="px-3 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-slate-300">
              CREW MONITORED: <strong className="text-white">4 ASTRONAUTS</strong>
            </span>
            <span className="px-3 py-1 rounded-md bg-amber-950/80 border border-amber-700/60 text-amber-300">
              WARNING: <strong>1 ACTIVE (CMDR B)</strong>
            </span>
            <span className="px-3 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-slate-300">
              COMMS LAG: <strong className="text-cyan-400">22.1 MIN</strong>
            </span>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/crew"
              className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm sm:text-base shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Enter Crew Board</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/demo"
              className="px-5 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700 text-slate-200 font-medium text-sm sm:text-base transition-all cursor-pointer flex items-center gap-2"
            >
              <span>Mission Replay (Sol 140–145)</span>
            </Link>
            <a
              href="#modules"
              className="px-4 py-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-cyan-300 font-mono text-xs sm:text-sm transition-all cursor-pointer"
            >
              View Modules ↓
            </a>
          </div>
        </div>
      </section>

      {/* ================= PLATFORM MODULES SECTION ================= */}
      <section
        id="modules"
        aria-label="Platform Modules"
        className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-20"
      >
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/70 text-cyan-300 text-xs font-mono tracking-widest uppercase mb-3 shadow-sm">
            <span>MISSION PLATFORM MODULES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Platform Modules
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-300 leading-relaxed">
            Explore autonomous health surveillance tools built for deep space operations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PLATFORM_MODULES.map((module) => {
            const IconComponent = module.icon;
            return (
              <Link
                key={module.id}
                to={module.to}
                className="group p-6 rounded-2xl bg-slate-900/85 hover:bg-slate-900/95 border border-slate-800 hover:border-cyan-500/60 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-cyan-950/40 backdrop-blur-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-cyan-400 group-hover:border-cyan-700/60 group-hover:scale-105 transition-all shadow-md">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    {module.badge && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-950/80 border border-cyan-800/70 text-cyan-300">
                        {module.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {module.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                    {module.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs font-mono font-medium text-cyan-400 group-hover:text-cyan-300 inline-flex items-center gap-1.5">
                    <span>{module.linkText}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    OPEN →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ================= LIVE CREW FLEET TELEMETRY STRIP ================= */}
      <section
        aria-label="Live Crew Resilience Snapshot"
        className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-20"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-mono uppercase text-cyan-400 tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Mission Sol {sol} Fleet Status</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Live Crew Health Snapshot
            </h3>
          </div>
          <Link
            to="/crew"
            className="text-xs font-mono text-cyan-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-cyan-600 transition-all"
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
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 animate-pulse h-36"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
            <p className="text-sm text-slate-300">Unable to load live fleet telemetry.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 px-3 py-1 text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 rounded hover:bg-cyan-900"
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
                  className={`p-5 rounded-2xl bg-slate-900/90 border transition-all duration-200 hover:-translate-y-1 hover:shadow-xl block ${
                    isActNow
                      ? 'border-rose-500/50 hover:border-rose-400 hover:shadow-rose-950/50'
                      : isAmber
                      ? 'border-amber-500/50 hover:border-amber-400 hover:shadow-amber-950/50'
                      : 'border-slate-800 hover:border-cyan-500/50 hover:shadow-cyan-950/40'
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

                  <h4 className="text-lg font-bold text-white truncate">{member.name}</h4>
                  <div className="text-xs text-slate-300 truncate mt-0.5">{member.role}</div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-baseline justify-between">
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

      {/* Cosmic background canvas behind sections */}
      <div className="relative z-10 pointer-events-none">
        <CosmicDreamscape />
      </div>
    </div>
  );
};
