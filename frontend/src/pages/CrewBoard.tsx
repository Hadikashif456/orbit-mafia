import { useEffect, type FC } from 'react';
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
          className="pointer-events-none absolute left-5 top-[16%] sm:left-[6%] sm:top-[34%]"
          style={{ textShadow: '0 2px 28px rgba(0,0,0,0.9)' }}
        >
          <h1 className="text-5xl font-black uppercase leading-none tracking-tight text-white sm:text-6xl lg:text-7xl">
            Orbit Mafia
          </h1>
          <p className="mt-4 max-w-[19rem] font-serif text-lg italic leading-snug text-slate-200 sm:mt-5 sm:max-w-[24rem] sm:text-xl lg:text-2xl">
            In the Silence of Space,{' '}
            <span className="whitespace-nowrap text-[#F4D6A3]">Every Heartbeat Matters.</span>
          </p>
        </div>
      </div>
      <CosmicDreamscape />
    </section>
  );
};
