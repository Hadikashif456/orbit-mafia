import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import clsx from 'clsx';
import { AsciiRenderer } from './AsciiRenderer';
import { useCosmos } from './CosmosContext';
import { useLowPower } from '../hooks/useLowPower';

import { SCENES, getScene } from './scenes';
import type { SceneId } from './scenes';

const TRANSITION_SECONDS = 2.2;
const MAX_DPR = 1.0;
const TARGET_FPS = 30;
const FRAME_MIN_MS = 1000 / TARGET_FPS;

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
 * Optimized with 30fps cap, DPR=1, and pause when tab is inactive.
 */
export const CosmicBackdrop: FC = () => {
  const isDeviceLowPower = useLowPower();
  const { scene, immersive, scrollProgress, camera, bgAnimation } = useCosmos();
  const isLowPower = isDeviceLowPower || !bgAnimation;

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
    if (isLowPower) return;

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

    const fit = (): void => {
      const rect = container.getBoundingClientRect();
      renderer.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, MAX_DPR), 1);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);

    let shown: SceneId = targetRef.current;
    let incoming: SceneId = shown;
    let mix = 0;
    let scrollPos = Math.round(scrollProgress.current * LAST);
    let wasScrollDriven = false;
    let time = reducedMotion ? 24 : 0;
    let lastRenderTime = performance.now();
    let raf = 0;

    const onVisibilityChange = (): void => {
      if (!document.hidden) {
        lastRenderTime = performance.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const tick = (now: number): void => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;

      const elapsed = now - lastRenderTime;
      if (elapsed < FRAME_MIN_MS) return;
      lastRenderTime = now;

      const dt = Math.min(elapsed, 50) / 1000;
      if (!reducedMotion) time += dt;

      let from: SceneId;
      let to: SceneId;
      let blend: number;
      if (immersiveRef.current) {
        const goal = scrollGoal(scrollProgress.current);
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
          shown = SCROLL_ORDER[Math.round(scrollPos)];
          incoming = shown;
          mix = 0;
          wasScrollDriven = false;
        }
        const target = targetRef.current;
        if (target !== incoming) {
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
      document.removeEventListener('visibilitychange', onVisibilityChange);
      renderer.dispose();
    };
  }, [camera, scrollProgress, isLowPower]);

  if (isLowPower) {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 20%, #0f172a 0%, #020617 100%)',
        }}
      >
        <div
          className={clsx(
            'absolute inset-0 bg-slate-950 transition-opacity duration-1000 ease-out',
            immersive ? 'opacity-0' : 'opacity-70',
          )}
        />
      </div>
    );
  }

  const definition = getScene(scene);
  const showCanvas = !failed;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none"
      style={{ background: showCanvas ? definition.background : definition.fallback }}
    >
      {showCanvas && <canvas ref={canvasRef} className="block h-full w-full" />}
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
