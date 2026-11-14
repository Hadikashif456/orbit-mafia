import type { FC } from 'react';
import { ASCII_SCENES, DEFAULT_SCENE, type AsciiSceneId } from './asciiRegistry';

interface AsciiBackgroundProps {
  scene?: AsciiSceneId;
}

export const AsciiBackground: FC<AsciiBackgroundProps> = ({ scene = DEFAULT_SCENE }) => {
  const Scene = ASCII_SCENES[scene];
  return <Scene className="crew-ascii-background" />;
};
