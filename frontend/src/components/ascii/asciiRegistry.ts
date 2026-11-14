import type { ComponentType } from 'react';
import { CosmicDreamscape, type AsciiSceneProps } from './scenes/CosmicDreamscape';
import { ObsidianSolaris } from './scenes/ObsidianSolaris';

export type AsciiSceneId = 'cosmicDreamscape' | 'obsidianSolaris';

export const ASCII_SCENES: Record<AsciiSceneId, ComponentType<AsciiSceneProps>> = {
  cosmicDreamscape: CosmicDreamscape,
  obsidianSolaris: ObsidianSolaris,
};

export const DEFAULT_SCENE: AsciiSceneId = 'cosmicDreamscape';
