import type { FC } from 'react';
import { SceneStage } from './SceneStage';
import { ASTRONAUT } from './scenes';

/** Screen 4: the astronaut on the ledge. Shader: shaders/astronaut.ts */
export const LoneAstronaut: FC = () => <SceneStage scene={ASTRONAUT} />;
