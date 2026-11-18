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
const IMMERSIVE_FPS = 24;
const DATA_PAGE_FPS = 12;
const BASE_QUALITY = 1.25;
const SLOW_FRAME_MS = 28;

/** On immersive screens, scrolling walks through the scenes in this order. */
const SCROLL_ORDER: readonly SceneId[] = SCENES.map((s) => s.id);
const LAST = SCROLL_ORDER.length - 1;

const scrollGoal = (progress: number): number => {
  const along = Math.min(1, Math.max(0, progress)) * LAST;
  const index = Math.min(LAST - 1, Math.floor(along));
  const local = Math.min(1, Math.max(0, (along - index - 0.12) / 0.76));
  return index + local * local * (3 - 2 * local);
};

const easeInOut = (t: number): number => t * t * (3 - 2 * t);

/**
 * The signature animated WebGL2 ASCII universe (Obsidian Solaris, Cosmic Dreamscape,
 * Crimson Singularity), mounted once behind the entire application.
 *
 * Performance architecture:
 * - Instant CSS gradient fallback at 0ms before WebGL initializes.
 * - Deferred WebGL2 setup avoids StrictMode double-compilation and unblocks first paint.
 * - Lazy per-scene shader compilation + idle pre-warm of the scroll target ('dreamscape').
 * - Adaptive quality throttling: if GPU frame time exceeds 28ms, automatically increases
 *   cell size to guarantee silky-smooth UI scrolling on integrated laptop GPUs.
 * - Drops to 12fps on data/chart pages and pauses completely when the tab is hidden.
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
  const [ready, setReady] = useState(false);

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

    let cancelled = false;
    let cleanupRenderer: (() => void) | null = null;
    let warmupTimer = 0;

    const initWebGL = (): void => {
      if (cancelled) return;

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

      let quality = BASE_QUALITY;
      let slowFrameStreak = 0;

      const fit = (): void => {
        const rect = container.getBoundingClientRect();
        renderer.resize(
          rect.width,
          rect.height,
          Math.min(window.devicePixelRatio || 1, MAX_DPR),
          quality,
        );
      };
      fit();
      const observer = new ResizeObserver(fit);
      observer.observe(container);

      // Pre-warm 'dreamscape' during idle time after initial load so scrolling never stutters
      warmupTimer = window.setTimeout(() => {
        if (!cancelled && !document.hidden) {
          renderer.warmup('dreamscape');
        }
      }, 1400);

      let shown: SceneId = targetRef.current;
      let incoming: SceneId = shown;
      let mix = 0;
      let scrollPos = Math.round(scrollProgress.current * LAST);
      let wasScrollDriven = false;
      let time = reducedMotion ? 24 : 0;
      let lastRenderTime = performance.now() - 100;
      let raf = 0;
      let hasPaintedFirstFrame = false;

      const onVisibilityChange = (): void => {
        if (!document.hidden) {
          lastRenderTime = performance.now();
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);

      const tick = (now: number): void => {
        raf = requestAnimationFrame(tick);
        if (document.hidden) return;

        const targetFps = immersiveRef.current ? IMMERSIVE_FPS : DATA_PAGE_FPS;
        const frameMinMs = 1000 / targetFps;
        const elapsed = now - lastRenderTime;
        if (elapsed < frameMinMs) return;
        lastRenderTime = now;

        const dt = Math.min(elapsed, 60) / 1000;
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
        const renderStart = performance.now();
        renderer.render({
          time,
          camera: camera.update(dt, time, profile, reducedMotion),
          from,
          to,
          mix: blend,
        });
        const renderMs = performance.now() - renderStart;

        if (!hasPaintedFirstFrame) {
          hasPaintedFirstFrame = true;
          setReady(true);
        } else if (renderMs > SLOW_FRAME_MS && quality < 2.1) {
          slowFrameStreak += 1;
          if (slowFrameStreak >= 3) {
            slowFrameStreak = 0;
            quality = Math.min(2.1, quality + 0.35);
            fit();
          }
        } else {
          slowFrameStreak = 0;
        }
      };
      raf = requestAnimationFrame(tick);

      cleanupRenderer = () => {
        cancelAnimationFrame(raf);
        window.clearTimeout(warmupTimer);
        observer.disconnect();
        motionQuery.removeEventListener('change', onMotionChange);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        renderer.dispose();
      };
    };

    const initTimer = window.setTimeout(initWebGL, 40);

    return () => {
      cancelled = true;
      window.clearTimeout(initTimer);
      window.clearTimeout(warmupTimer);
      if (cleanupRenderer) {
        cleanupRenderer();
      }
      setReady(false);
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
      style={{ background: definition.fallback }}
    >
      {showCanvas && (
        <canvas
          ref={canvasRef}
          className={clsx(
            'block h-full w-full transition-opacity duration-700 ease-out',
            ready ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      {/* Scrim: keeps data screens crisp and readable; lifts away on the immersive Solaris hero. */}
      <div
        className={clsx(
          'absolute inset-0 bg-[#03020a] transition-opacity duration-1000 ease-out',
          immersive ? 'opacity-0' : 'opacity-75',
        )}
      />
    </div>
  );
};
