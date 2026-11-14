import type { FC } from 'react';
import type { SceneDefinition } from './scenes';

/**
 * One full-height panel of the cosmos page. It is deliberately empty: it
 * gives its scene a screen's worth of scroll. The universe itself is drawn
 * by CosmicBackdrop, and which scene shows depends on the scroll position.
 */
export const SceneStage: FC<{ scene: SceneDefinition }> = ({ scene }) => (
  <div role="img" aria-label={`${scene.name}. ${scene.tagline}`} className="min-h-[100dvh]" />
);
