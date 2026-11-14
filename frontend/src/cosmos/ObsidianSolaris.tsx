import type { FC } from 'react';
import { SceneStage } from './SceneStage';
import { SOLARIS } from './scenes';

/** Screen 2: the dark, photographic eclipse. Shader: shaders/solaris.ts */
export const ObsidianSolaris: FC = () => <SceneStage scene={SOLARIS} />;
