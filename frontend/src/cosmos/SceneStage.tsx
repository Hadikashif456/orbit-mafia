import { useEffect } from 'react';
import type { FC } from 'react';
import { useCosmos } from './CosmosContext';
import type { SceneDefinition } from './scenes';

/**
 * Foreground of one cosmic screen: selects its scene on the shared backdrop
 * and shows the title. The universe itself is drawn by CosmicBackdrop.
 */
export const SceneStage: FC<{ scene: SceneDefinition }> = ({ scene }) => {
  const { setScene } = useCosmos();

  useEffect(() => {
    setScene(scene.id);
  }, [scene.id, setScene]);

  return (
    <div
      key={scene.id}
      className="cosmos-rise pointer-events-none absolute bottom-16 left-5 right-44 max-w-xl sm:left-8 md:bottom-20"
      style={{ textShadow: '0 1px 16px rgba(0,0,0,0.9)' }}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.34em]" style={{ color: scene.accent }}>
        Screen {scene.index} / 02
      </p>
      <h1 className="mt-2 text-3xl font-light tracking-tight text-white sm:text-5xl">{scene.name}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{scene.tagline}</p>
    </div>
  );
};
