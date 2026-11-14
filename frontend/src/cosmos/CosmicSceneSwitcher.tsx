import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import { useLocation } from 'react-router-dom';
import { CosmicDreamscape } from './CosmicDreamscape';
import { CrimsonSingularity } from './CrimsonSingularity';
import { LoneAstronaut } from './LoneAstronaut';
import { useCosmos } from './CosmosContext';
import { ObsidianSolaris } from './ObsidianSolaris';
import { SCENES } from './scenes';
import { TheWatcher } from './TheWatcher';

/**
 * The cosmos page: five screens stacked into one scroll. Scrolling down
 * walks Obsidian Solaris, Cosmic Dreamscape, Crimson Singularity, Edge of
 * Everything, then The Watcher; scrolling up walks back. This component reports
 * the scroll position; CosmicBackdrop does the blending.
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
  const alertRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const crimsonIndex = SCENES.findIndex((s) => s.id === 'crimson');
    const measure = (): void => {
      const range = document.documentElement.scrollHeight - window.innerHeight;
      scrollProgress.current = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0;
      // The ALERT sits in the void of the crimson screen. It is pinned to the
      // viewport (the void does not scroll), so it is faded in and out by how
      // close the scroll is to that screen. Set directly, to avoid re-rendering.
      const alert = alertRef.current;
      if (alert) {
        const distance = Math.abs(scrollProgress.current * (SCENES.length - 1) - crimsonIndex);
        // Fully visible across the middle of the screen's stretch of scroll.
        const shown = Math.min(1, Math.max(0, (1 - distance * 2.6) * 1.8));
        alert.style.opacity = String(shown);
        alert.style.visibility = shown > 0 ? 'visible' : 'hidden';
      }
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
      </div>
      <CosmicDreamscape />
      <CrimsonSingularity />
      <LoneAstronaut />
      <TheWatcher />

      {/* Warning inside the void on the crimson screen. */}
      <h2
        ref={alertRef}
        className="pointer-events-none fixed left-1/2 top-[48%] z-10"
        style={{ opacity: 0, visibility: 'hidden' }}
      >
        <span className="cosmos-alert" data-text="ALERT">
          ALERT
        </span>
      </h2>
    </section>
  );
};
