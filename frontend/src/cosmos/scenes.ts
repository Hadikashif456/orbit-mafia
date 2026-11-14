import type { CameraProfile } from './CameraController';
import { DREAMSCAPE_FRAG } from './shaders/dreamscape';
import { SOLARIS_FRAG } from './shaders/solaris';

export type SceneId = 'dreamscape' | 'solaris';

export interface SceneDefinition {
  id: SceneId;
  index: string;
  name: string;
  tagline: string;
  /** Route segment under /cosmos. */
  path: string;
  /** Accent colour for the HUD. */
  accent: string;
  /** Deep-space background colour, also used by the non-WebGL fallback. */
  background: string;
  /** CSS gradient shown when WebGL2 is unavailable. */
  fallback: string;
  fragment: string;
  /** Composite look: bloom, film grain, vignette, exposure. */
  fx: { glow: number; grain: number; vignette: number; gain: number };
  camera: CameraProfile;
}

export const DREAMSCAPE: SceneDefinition = {
  id: 'dreamscape',
  index: '01',
  name: 'Cosmic Dreamscape',
  tagline: 'A ringed giant, a turning galaxy, and gas the colour of orchids.',
  path: 'dreamscape',
  accent: '#D9B8FF',
  background: '#03020A',
  fallback:
    'radial-gradient(60% 50% at 62% 48%, rgba(181,108,255,0.28), transparent 70%), radial-gradient(40% 45% at 18% 45%, rgba(131,231,245,0.16), transparent 70%), #03020A',
  fragment: DREAMSCAPE_FRAG,
  fx: { glow: 0.2, grain: 0.035, vignette: 0.55, gain: 1.1 },
  camera: {
    accel: 1.5,
    maxSpeed: 0.42,
    damping: 2.4,
    driftX: 0.035,
    driftY: 0.02,
    driftZ: 0.03,
    driftRate: 0.05,
    parallax: 0.035,
  },
};

export const SOLARIS: SceneDefinition = {
  id: 'solaris',
  index: '02',
  name: 'Obsidian Solaris',
  tagline: 'An eclipsed sun behind copper rings. Darker, colder, closer to real.',
  path: 'solaris',
  accent: '#D6A568',
  background: '#020609',
  fallback:
    'radial-gradient(45% 40% at 58% 30%, rgba(244,214,163,0.26), transparent 70%), radial-gradient(60% 60% at 30% 70%, rgba(18,67,75,0.45), transparent 75%), #020609',
  fragment: SOLARIS_FRAG,
  fx: { glow: 0.12, grain: 0.05, vignette: 0.75, gain: 1.08 },
  // Heavier and slower: this scene should feel like a long lens on a real body.
  camera: {
    accel: 1.1,
    maxSpeed: 0.32,
    damping: 2.0,
    driftX: 0.02,
    driftY: 0.012,
    driftZ: 0.045,
    driftRate: 0.03,
    parallax: 0.022,
  },
};

export const SCENES: readonly SceneDefinition[] = [DREAMSCAPE, SOLARIS];

export const getScene = (id: SceneId): SceneDefinition => (id === 'solaris' ? SOLARIS : DREAMSCAPE);
