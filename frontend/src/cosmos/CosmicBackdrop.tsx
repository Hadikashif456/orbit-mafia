import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import clsx from 'clsx';
import { AsciiRenderer } from './AsciiRenderer';
import { useCosmos } from './CosmosContext';
import { SCENES, getScene } from './scenes';
import type { SceneId } from './scenes';

const TRANSITION_SECONDS = 2.2;
const MAX_DPR = 2;
const MAX_QUALITY_SCALE = 1.6;
/** On the cosmos page, scrolling walks through the scenes in this order. */
const SCROLL_ORDER: readonly SceneId[] = SCENES.map((s) => s.id);
const LAST = SCROLL_ORDER.length - 1;

/**
 * Where the scroll should put us, as a position along SCROLL_ORDER
 * (0 = first scene, 1 = second, 1.5 = half-way between second and third).
 * Each scene holds still for the first and last part of its stretch.
 */
const scrollGoal = (progress: number): number => {
  const along = Math.min(1, Math.max(0, progress)) * LAST;
  const index = Math.min(LAST - 1, Math.floor(along));
  const local = Math.min(1, Math.max(0, (along - index - 0.12) / 0.76));
  return index + local * local * (3 - 2 * local);
};

const easeInOut = (t: number): number => t * t * (3 - 2 * t);

/**
 * The animated ASCII universe, mounted once behind the whole application.
 * It never takes pointer events, so buttons, links, forms and scrolling in the
 * foreground behave exactly as before.
 */
export const CosmicBackdrop: FC = () => {
  const { scene, immersive, scrollProgress, camera } = useCosmos();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef<SceneId>(scene);
  const immersiveRef = useRef(immersive);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    targetRef.current = scene;
  }, [scene]);

  useEffect(() => {
    immersiveRef.current = immersive;
    camera.setInteractive(immersive);
  }, [camera, immersive]);

  useEffect(() => camera.attach(window), [camera]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let renderer: AsciiRenderer;
    try {
      renderer = new AsciiRenderer(canvas, SCENES);
    } catch (error) {
      console.error('[cosmos] Falling back to a static background:', error);
      setFailed(true);
      return;
    }

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;
    const onMotionChange = (e: MediaQueryListEvent): void => {
      reducedMotion = e.matches;
    };
    motionQuery.addEventListener('change', onMotionChange);

    let quality = 1;
    const fit = (): void => {
      const rect = container.getBoundingClientRect();
      renderer.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, MAX_DPR), quality);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);

    let shown: SceneId = targetRef.current;
    let incoming: SceneId = shown;
    let mix = 0;
    let scrollPos = Math.round(scrollProgress.current * LAST);
    let wasScrollDriven = false;
    // Reduced motion freezes the scene on a composed frame instead of animating.
    let time = reducedMotion ? 24 : 0;
    let last = performance.now();
    let frameAverage = 16;
    let slowFrames = 0;
    let raf = 0;

    const tick = (now: number): void => {
      raf = requestAnimationFrame(tick);
      const elapsed = now - last;
      last = now;
      const dt = Math.min(elapsed, 50) / 1000;
      if (!reducedMotion) time += dt;

      // Adaptive resolution: if frames stay slow, use larger character cells.
      if (elapsed < 250) {
        frameAverage = frameAverage * 0.95 + elapsed * 0.05;
        slowFrames = frameAverage > 26 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
        if (slowFrames > 120 && quality < MAX_QUALITY_SCALE) {
          quality = Math.min(MAX_QUALITY_SCALE, quality * 1.25);
          slowFrames = 0;
          frameAverage = 16;
          fit();
        }
      }

      let from: SceneId;
      let to: SceneId;
      let blend: number;
      if (immersiveRef.current) {
        // Cosmos page: the scroll position is the transition. The position
        // chases the scroll target so wheel steps become one smooth dissolve.
        const goal = scrollGoal(scrollProgress.current);
        // Arriving on the page (including by a link to a later screen):
        // start on the right scene instead of dissolving there from the first.
        if (!wasScrollDriven) scrollPos = goal;
        scrollPos += (goal - scrollPos) * (reducedMotion ? 1 : 1 - Math.exp(-4.5 * dt));
        if (Math.abs(goal - scrollPos) < 0.0005) scrollPos = goal;
        const index = Math.min(LAST, Math.floor(scrollPos + 0.0005));
        const part = Math.max(0, scrollPos - index);
        from = SCROLL_ORDER[index];
        to = SCROLL_ORDER[Math.min(LAST, index + 1)];
        blend = part < 0.001 ? 0 : part;
        wasScrollDriven = true;
      } else {
        if (wasScrollDriven) {
          // Leaving the cosmos page: carry on from whichever scene was showing.
          shown = SCROLL_ORDER[Math.round(scrollPos)];
          incoming = shown;
          mix = 0;
          wasScrollDriven = false;
        }
        const target = targetRef.current;
        if (target !== incoming) {
          // A new request mid-transition: settle on whichever scene is dominant.
          if (mix > 0.5) shown = incoming;
          incoming = target;
          mix = 0;
        }
        if (incoming !== shown) {
          mix += dt / (reducedMotion ? 0.5 : TRANSITION_SECONDS);
          if (mix >= 1) {
            shown = incoming;
            mix = 0;
          }
        }
        from = shown;
        to = incoming;
        blend = easeInOut(mix);
      }

      const profile = getScene(blend > 0.5 ? to : from).camera;
      renderer.render({
        time,
        camera: camera.update(dt, time, profile, reducedMotion),
        from,
        to,
        mix: blend,
      });
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      motionQuery.removeEventListener('change', onMotionChange);
      renderer.dispose();
    };
  }, [camera, scrollProgress]);

  const definition = getScene(scene);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none"
      style={{ background: failed ? definition.fallback : definition.background }}
    >
      {!failed && <canvas ref={canvasRef} className="block h-full w-full" />}
      {/* Scrim: keeps data screens readable; lifts away on the cosmos screens. */}
      <div
        className={clsx(
          'absolute inset-0 bg-slate-950 transition-opacity duration-1000 ease-out',
          immersive ? 'opacity-0' : 'opacity-70',
        )}
      />
    </div>
  );
};
