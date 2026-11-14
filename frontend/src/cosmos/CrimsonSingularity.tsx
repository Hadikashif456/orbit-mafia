import type { FC } from 'react';
import { SceneStage } from './SceneStage';
import { CRIMSON } from './scenes';

/** Screen 3: the star-filled void in crimson cloud. Shader: shaders/crimson.ts */
export const CrimsonSingularity: FC = () => <SceneStage scene={CRIMSON} />;
