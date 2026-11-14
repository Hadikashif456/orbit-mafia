import type { FC } from 'react';
import { SceneStage } from './SceneStage';
import { EYE } from './scenes';

/** Screen 5: the Earth that opens into an eye. Shader: shaders/eye.ts */
export const TheWatcher: FC = () => <SceneStage scene={EYE} />;
