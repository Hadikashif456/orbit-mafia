import { useEffect, useMemo, type FC } from 'react';
import { Link } from 'react-router-dom';
import { useCosmos } from '../cosmos/CosmosContext';
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
  ChevronDown,
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
}

const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: 'triage',
    title: 'Automated Triage Queue',
    description: 'Real-time astronaut prioritization ranking crew by physiological criticality and rate of change.',
    to: '/triage',
    linkText: 'Open Queue',
    icon: Activity,
  },
  {
    id: 'comms',
    title: 'Earth Comms Latency Buffer',
    description: 'Simulates light-speed communication delays up to 22.1 minutes with autonomous offline Copilot.',
    to: '/comms',
    linkText: 'Simulate Comms',
    icon: Radio,
  },
  {
    id: 'recovery',
    title: 'Multi-Omics Recovery Curves',
    description: 'Longitudinal return-to-baseline modeling across cytokines, cardiovascular markers, and cf-mtDNA.',
    to: '/recovery',
    linkText: 'View Recovery',
    icon: Sparkles,
  },
  {
    id: 'crew',
    title: 'Crew Resilience Board',
    description: 'Traffic-light triage across all 4 astronauts with real-time CRI 0–100 and vital sparklines.',
    to: '/crew',
    linkText: 'Enter Board',
    icon: Users,
  },
  {
    id: 'demo',
    title: 'Mission Replay (Sol 140–145)',
    description: 'Interactive solar particle event playback demonstrating 48-hour early warning detection.',
    to: '/demo',
    linkText: 'Replay Event',
    icon: Play,
  },
  {
    id: 'drivers',
    title: 'Stressor Drivers Timeline',
    description: 'Compound multi-stressor decomposition isolating radiation, sleep debt, cardio, and CO2.',
    to: '/drivers',
    linkText: 'Inspect Drivers',
    icon: Layers,
  },
];

const MiniSparkline: FC<{ points: number[]; color: string }> = ({ points, color }) => {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points) - 2;
  const max = Math.max(...points) + 2;
  const span = Math.max(1, max - min);
  const width = 84;
  const height = 24;
  const coords = points
    .map((val, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((val - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastX = width;
  const lastY = height - ((points[points.length - 1] - min) / span) * (height - 4) - 2;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
};

export const CrewBoard: FC = () => {
  const { scene, setScene, setImmersive, scrollProgress } = useCosmos();
  const { sol } = useMissionSol();
  const { data: summaries, isLoading, isError, refetch } = useCrewSummaries(sol);

  const members = useMemo(() => {
    return summaries ? summaries.map((s) => ({ ...toCrewMember(s), sparkline: s.sparkline ?? [] })) : [];
  }, [summaries]);

  const primaryAlert = useMemo(() => {
    return members.find((m) => m.status === 'act_now' || m.status === 'watch');
  }, [members]);

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
      {/* ================= CINEMATIC HERO (MATCHES ref-screen-1.jpg) ================= */}
      {/* Right half stays completely open so the golden-teal ASCII Solaris ringed planet shines unobstructed */}
      <section
        aria-label="Orbit Mafia Hero"
        className="relative min-h-[calc(100dvh-4rem)] flex items-center"
      >
        <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 py-16 z-20">
          <div
            className="max-w-xl"
            style={{ textShadow: '0 4px 32px rgba(2, 6, 9, 0.95)' }}
          >
            <div className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-mono uppercase tracking-[0.22em] text-[#83e7f5] mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#83e7f5] animate-pulse" />
              <span>Autonomous Astronaut Health Guardian · Sol {sol}</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-[4.75rem] font-black uppercase leading-[0.95] tracking-tight text-white">
              Orbit Mafia
            </h1>

            <p className="mt-5 font-serif text-xl sm:text-2xl lg:text-[1.75rem] italic leading-snug text-slate-100">
              In the Silence of Space,
              <br />
              <span className="text-[#F4D6A3]">Every Heartbeat Matters.</span>
            </p>

            {/* Primary CTA Buttons — clean glass aesthetic */}
            <div className="mt-9 flex flex-wrap items-center gap-3.5">
              <Link
                to="/crew"
                className="px-6 py-3 rounded-full bg-[#83e7f5] hover:bg-[#a5eff9] text-[#03020a] font-semibold text-sm sm:text-base shadow-[0_0_28px_rgba(131,231,245,0.28)] transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Enter Crew Board</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/demo"
                className="px-6 py-3 rounded-full bg-[#070b18]/75 hover:bg-[#0e162e]/90 backdrop-blur-md border border-white/15 hover:border-[#83e7f5]/50 text-white font-medium text-sm sm:text-base transition-all cursor-pointer"
              >
                Mission Replay
              </Link>
            </div>

            {/* Ultra-clean single-line live mission status — no cluttered boxes */}
            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>{members.length || 4} Crew Online</span>
              </span>
              <span className="text-slate-600">·</span>
              {primaryAlert ? (
                <Link
                  to={`/alert/${primaryAlert.id}`}
                  className="inline-flex items-center gap-1.5 text-[#ffe0a3] hover:text-white underline-offset-4 hover:underline transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ffe0a3] animate-pulse" />
                  <span>
                    Early Warning: {primaryAlert.name} (CRI {primaryAlert.cri.toFixed(1)})
                  </span>
                </Link>
              ) : (
                <span className="text-emerald-300">All Systems Nominal</span>
              )}
              <span className="text-slate-600">·</span>
              <span>22.1m Earth Lag · 0s Edge AI</span>
            </div>
          </div>
        </div>

        {/* Subtle bottom scroll cue */}
        <a
          href="#modules"
          aria-label="Scroll to Platform Modules"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 inline-flex flex-col items-center gap-1 text-[11px] font-mono uppercase tracking-[0.2em] text-slate-400 hover:text-[#83e7f5] transition-colors"
        >
          <span>Modules</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </a>
      </section>

      {/* ================= LOWER SECTIONS WITH SOFT COSMIC SCRIM ================= */}
      {/* Smooth gradient dims the Dreamscape ASCII backdrop softly so glass cards read effortlessly */}
      <div className="relative z-20 bg-gradient-to-b from-transparent via-[#03020a]/75 to-[#03020a]/92">
        {/* ================= PLATFORM MODULES ================= */}
        <section
          id="modules"
          aria-label="Platform Modules"
          className="pt-16 pb-12 px-6 sm:px-10 lg:px-12 max-w-7xl mx-auto"
        >
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Platform Modules
            </h2>
            <p className="mt-2.5 text-sm sm:text-base text-slate-300">
              Explore autonomous health surveillance tools built for deep space operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {PLATFORM_MODULES.map((module) => {
              const IconComponent = module.icon;
              return (
                <Link
                  key={module.id}
                  to={module.to}
                  className="group p-6 rounded-2xl bg-[#070b18]/78 hover:bg-[#0b1124]/92 backdrop-blur-xl border border-white/10 hover:border-[#83e7f5]/50 transition-all duration-300 hover:-translate-y-1 shadow-[0_8px_32px_rgba(0,0,0,0.45)] flex flex-col justify-between"
                >
                  <div>
                    <div className="p-2.5 rounded-xl bg-slate-950/90 border border-white/10 text-[#83e7f5] w-fit mb-4 group-hover:border-[#83e7f5]/40 transition-colors">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-white group-hover:text-[#83e7f5] transition-colors">
                      {module.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                      {module.description}
                    </p>
                  </div>

                  <span className="mt-5 text-xs font-mono text-[#83e7f5] inline-flex items-center gap-1.5">
                    <span>{module.linkText}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ================= LIVE CREW HEALTH SNAPSHOT ================= */}
        <section
          aria-label="Live Crew Resilience Snapshot"
          className="pt-6 pb-16 px-6 sm:px-10 lg:px-12 max-w-7xl mx-auto"
        >
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#83e7f5]">
                Mission Sol {sol} · Live Telemetry
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                Crew Health Snapshot
              </h2>
            </div>
            <Link
              to="/crew"
              className="text-xs font-mono text-[#83e7f5] hover:text-white inline-flex items-center gap-1 transition-colors"
            >
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl bg-[#070b18]/80 border border-white/10 animate-pulse h-36"
                />
              ))}
            </div>
          ) : isError ? (
            <div className="p-4 rounded-xl bg-[#070b18]/85 border border-white/10 text-center">
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
                const sparkColor = isActNow ? '#ff5d73' : isAmber ? '#ffe0a3' : '#7cf5b0';
                const statusBadge = isActNow
                  ? { label: 'ACT-NOW', color: 'text-rose-300 bg-rose-950/90 border-rose-500/45' }
                  : isAmber
                  ? { label: 'WATCH', color: 'text-[#ffe0a3] bg-amber-950/80 border-amber-500/45' }
                  : { label: 'OPTIMAL', color: 'text-[#7cf5b0] bg-emerald-950/80 border-emerald-500/40' };

                return (
                  <Link
                    key={member.id}
                    to={`/crew/${member.id}`}
                    className={`group p-5 rounded-2xl bg-[#070b18]/82 backdrop-blur-xl border transition-all duration-200 hover:-translate-y-1 block ${
                      isActNow
                        ? 'border-rose-500/45 hover:border-rose-400'
                        : isAmber
                        ? 'border-amber-500/45 hover:border-amber-400'
                        : 'border-white/10 hover:border-[#83e7f5]/50'
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

                    <h3 className="text-lg font-bold text-white truncate group-hover:text-[#83e7f5] transition-colors">
                      {member.name}
                    </h3>
                    <div className="text-xs text-slate-300 truncate mt-0.5">{member.role}</div>

                    <div className="mt-4 pt-3 border-t border-white/10 flex items-end justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono text-slate-400 block uppercase">
                          CRI
                        </span>
                        <span
                          className={`text-2xl font-bold font-mono ${
                            isActNow
                              ? 'text-rose-400'
                              : isAmber
                              ? 'text-[#ffe0a3]'
                              : 'text-[#7cf5b0]'
                          }`}
                        >
                          {member.cri.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <MiniSparkline points={member.sparkline} color={sparkColor} />
                        <span className="text-[11px] font-mono text-[#83e7f5] flex items-center gap-1">
                          <span>Inspect</span>
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
