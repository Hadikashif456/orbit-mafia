import { useEffect } from 'react';
import type { FC } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { CosmicDreamscape } from './CosmicDreamscape';
import { CrimsonSingularity } from './CrimsonSingularity';
import { useCosmos } from './CosmosContext';
import { ObsidianSolaris } from './ObsidianSolaris';
import { SCENES } from './scenes';

/**
 * The cosmos page: three screens stacked into one scroll. Scrolling down
 * turns Obsidian Solaris into Cosmic Dreamscape, then into Crimson
 * Singularity; scrolling up walks back. This component reports the scroll
 * position; CosmicBackdrop does the blending.
 *
 * There are no on-screen controls. The camera is driven by the mouse and
 * keyboard (see CameraController.attach): drag up/down or Ctrl + wheel to
 * move in and out, arrow keys to drift, double-click to reset.
 */
export const CosmicSceneSwitcher: FC = () => {
  const { setScene, setImmersive, scrollProgress } = useCosmos();
  const { pathname } = useLocation();
  // A link such as /cosmos/crimson opens already scrolled to that screen.
  const startIndex = Math.max(0, SCENES.findIndex((s) => pathname.includes(s.path)));

  useEffect(() => {
    const measure = (): void => {
      const range = document.documentElement.scrollHeight - window.innerHeight;
      scrollProgress.current = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0;
    };
    if (startIndex > 0) {
      const range = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, (range * startIndex) / (SCENES.length - 1));
    }
    measure();
    setImmersive(true);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      // Other pages keep whichever scene was on screen as their dim backdrop.
      setScene(SCENES[Math.round(scrollProgress.current * (SCENES.length - 1))].id);
      setImmersive(false);
      scrollProgress.current = 0;
    };
  }, [scrollProgress, setImmersive, setScene, startIndex]);

  return (
    <section aria-label="Cosmic screens" className="relative cursor-ns-resize select-none">
      <div className="relative">
        <ObsidianSolaris />
        {/* Team name, set beside the planet on the opening screen. */}
        <div
          className="pointer-events-none absolute left-5 top-[16%] sm:left-[6%] sm:top-[34%]"
          style={{ textShadow: '0 2px 28px rgba(0,0,0,0.9)' }}
        >
          <h1 className="text-5xl font-black uppercase leading-none tracking-tight text-white sm:text-6xl lg:text-7xl">
            Orbit Mafia
          </h1>
          {/* Punch line: a quiet italic serif against the heavy name, with the
              second half picked out in the scene's gold. */}
          <p className="mt-4 max-w-[19rem] font-serif text-lg italic leading-snug text-slate-200 sm:mt-5 sm:max-w-[24rem] sm:text-xl lg:text-2xl">
            In the Silence of Space,{' '}
            <span className="whitespace-nowrap text-[#F4D6A3]">Every Heartbeat Matters.</span>
          </p>
        </div>
        {/* Scroll cue: belongs to the first screen, so it leaves with it. */}
        <p className="pointer-events-none absolute inset-x-0 bottom-5 flex flex-col items-center gap-1 font-mono text-[11px] uppercase tracking-[0.3em] text-slate-300">
          Scroll
          <ChevronDown className="cosmos-bob h-4 w-4" aria-hidden="true" />
        </p>
      </div>
      <CosmicDreamscape />
      <CrimsonSingularity />
    </section>
  );
};
