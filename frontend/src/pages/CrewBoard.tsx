import { useEffect, type FC } from 'react';
import { Link } from 'react-router-dom';
import { CosmicDreamscape } from '../cosmos/CosmicDreamscape';
import { useCosmos } from '../cosmos/CosmosContext';
import { ObsidianSolaris } from '../cosmos/ObsidianSolaris';
import { SCENES } from '../cosmos/scenes';

/**
 * The backdrop reads scroll progress as 0..1 across every scene in SCENES.
 * This page only stacks the first screens, so a full scroll here must stop on
 * its last screen (Cosmic Dreamscape) rather than run on to the later scenes.
 */
const LAST_SCREEN = SCENES.findIndex((s) => s.id === 'dreamscape');
const PROGRESS_SPAN = LAST_SCREEN / (SCENES.length - 1);

/**
 * Home: two full-height screens in one scroll. Screen 1 is Obsidian Solaris
 * with the team name; screen 2 is Cosmic Dreamscape with nothing on top of it.
 * There are no on-screen controls: drag up/down or Ctrl + wheel moves in and
 * out, the arrow keys drift, double-click resets (see CameraController.attach).
 */
export const CrewBoard: FC = () => {
  const { scene, setScene, setImmersive, scrollProgress } = useCosmos();

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
    <section aria-label="Cosmic screens" className="relative cursor-ns-resize select-none">
      <div className="relative">
        <ObsidianSolaris />
        <div
          className="absolute left-6 sm:left-[8%] top-[25%] sm:top-[30%] max-w-xl z-20"
          style={{ textShadow: '0 2px 28px rgba(0,0,0,0.9)' }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-badge text-cyan-300 text-xs font-mono mb-4">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            AUTONOMOUS ASTRONAUT HEALTH GUARDIAN
          </div>
          <h1 className="text-5xl font-black uppercase leading-none tracking-tight text-white sm:text-6xl lg:text-7xl">
            Orbit Mafia
          </h1>
          <p className="mt-4 max-w-[22rem] font-serif text-lg italic leading-snug text-slate-200 sm:mt-5 sm:max-w-[28rem] sm:text-xl lg:text-2xl">
            In the Silence of Space,{' '}
            <span className="whitespace-nowrap text-[#F4D6A3]">Every Heartbeat Matters.</span>
          </p>
          <div className="mt-8 flex items-center gap-4">
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
      <CosmicDreamscape />
    </section>
  );
};
