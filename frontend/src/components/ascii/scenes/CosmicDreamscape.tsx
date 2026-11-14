import type { CSSProperties, FC, RefObject } from 'react';
import { CosmicBackdrop } from '../../../cosmos/CosmicBackdrop';

export interface AsciiSceneProps {
  className?: string;
  style?: CSSProperties;
  canvasRefExternal?: RefObject<HTMLCanvasElement>;
  loopDurationSeconds?: number;
  interactiveParallax?: boolean;
}

/**
 * Adapter for the existing generative ASCII renderer. Keeping this boundary
 * typed makes the scene replaceable without changing page or card code.
 */
export const CosmicDreamscape: FC<AsciiSceneProps> = ({ className, style }) => (
  <div className={className} style={style}>
    <CosmicBackdrop />
  </div>
);
