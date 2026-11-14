import { useEffect } from 'react';
import type { FC, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { isEditableTarget } from './CameraController';
import type { MoveDirection } from './CameraController';
import { CosmicDreamscape } from './CosmicDreamscape';
import { useCosmos } from './CosmosContext';
import { ObsidianSolaris } from './ObsidianSolaris';
import { SCENES, getScene } from './scenes';

const PAD_BUTTON =
  'pointer-events-auto flex h-11 w-11 touch-none items-center justify-center rounded-md border border-white/15 bg-black/45 text-slate-200 backdrop-blur-sm transition-colors hover:border-white/40 hover:text-white active:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70';

/**
 * Host for the two cosmic screens. It keeps the camera controls live while
 * either screen is open and provides the scene switch and on-screen pad.
 */
export const CosmicSceneSwitcher: FC = () => {
  const { scene, setImmersive, camera } = useCosmos();
  const navigate = useNavigate();
  const accent = getScene(scene).accent;

  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);

  // 1 and 2 jump between the screens.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.altKey || e.ctrlKey || e.metaKey || isEditableTarget(e.target)) return;
      const target = SCENES.find((s) => String(Number(s.index)) === e.key);
      if (target) navigate(`/cosmos/${target.path}`);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  const padButton = (direction: MoveDirection, label: string, icon: JSX.Element, position: string): JSX.Element => {
    const press = (e: ReactPointerEvent<HTMLButtonElement>): void => {
      e.currentTarget.setPointerCapture(e.pointerId);
      camera.setHeld(direction, true);
    };
    const release = (): void => camera.setHeld(direction, false);
    // detail === 0 means the click came from the keyboard, not a pointer.
    const click = (e: ReactMouseEvent<HTMLButtonElement>): void => {
      if (e.detail === 0) camera.nudge(direction);
    };
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        className={clsx(PAD_BUTTON, position)}
        onPointerDown={press}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onClick={click}
      >
        {icon}
      </button>
    );
  };

  return (
    <section
      aria-label="Cosmic screens"
      className="relative min-h-[calc(100dvh-6rem)] overflow-hidden"
      style={{ ['--cosmos-accent' as string]: accent }}
    >
      {/* Lower-third: a soft floor of shadow so the caption and controls stay readable. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/85 via-black/45 to-transparent"
      />

      <Routes>
        <Route index element={<Navigate to="dreamscape" replace />} />
        <Route path="dreamscape" element={<CosmicDreamscape />} />
        <Route path="solaris" element={<ObsidianSolaris />} />
        <Route path="*" element={<Navigate to="dreamscape" replace />} />
      </Routes>

      {/* Scene switch */}
      <nav
        aria-label="Switch cosmic screen"
        className="absolute right-5 top-6 flex flex-col items-end gap-1.5 font-mono text-[11px] uppercase tracking-[0.22em] sm:right-8 sm:top-8"
      >
        {SCENES.map((s) => (
          <NavLink
            key={s.id}
            to={`/cosmos/${s.path}`}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-md border px-3 py-2 backdrop-blur-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70',
                isActive
                  ? 'border-[color:var(--cosmos-accent)] bg-black/55 text-white'
                  : 'border-white/10 bg-black/30 text-slate-400 hover:border-white/30 hover:text-slate-100',
              )
            }
          >
            <span style={{ color: s.accent }}>{s.index}</span>
            <span>{s.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Key hints */}
      <p className="pointer-events-none absolute bottom-7 left-5 hidden font-mono text-[11px] uppercase leading-6 tracking-[0.2em] text-slate-400 sm:left-8 md:block">
        <span className="text-slate-200">← →</span> drift
        <span className="mx-3 text-slate-600">/</span>
        <span className="text-slate-200">↑ ↓</span> travel
        <span className="mx-3 text-slate-600">/</span>
        <span className="text-slate-200">scroll</span> zoom
        <span className="mx-3 text-slate-600">/</span>
        <span className="text-slate-200">1 2</span> screen
      </p>

      {/* On-screen movement pad */}
      <div
        role="group"
        aria-label="Camera movement"
        className="pointer-events-none absolute bottom-6 right-5 grid grid-cols-3 grid-rows-2 gap-1.5 sm:right-8"
      >
        <button
          type="button"
          aria-label="Reset view"
          title="Reset view"
          className={clsx(PAD_BUTTON, 'col-start-1 row-start-1')}
          onClick={() => camera.reset()}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
        {padButton('forward', 'Move forward', <ArrowUp className="h-4 w-4" aria-hidden="true" />, 'col-start-2 row-start-1')}
        {padButton('left', 'Move left', <ArrowLeft className="h-4 w-4" aria-hidden="true" />, 'col-start-1 row-start-2')}
        {padButton('back', 'Move back', <ArrowDown className="h-4 w-4" aria-hidden="true" />, 'col-start-2 row-start-2')}
        {padButton('right', 'Move right', <ArrowRight className="h-4 w-4" aria-hidden="true" />, 'col-start-3 row-start-2')}
      </div>
    </section>
  );
};
