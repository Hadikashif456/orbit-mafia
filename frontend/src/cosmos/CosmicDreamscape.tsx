import type { FC } from 'react';
import { SceneStage } from './SceneStage';
import { DREAMSCAPE } from './scenes';

/** Screen 1: the colourful, painterly universe. Shader: shaders/dreamscape.ts */
export const CosmicDreamscape: FC = () => <SceneStage scene={DREAMSCAPE} />;
