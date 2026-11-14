import type { CameraProfile } from './CameraController';
import { ASTRONAUT_FRAG } from './shaders/astronaut';
import { CRIMSON_FRAG } from './shaders/crimson';
import { DREAMSCAPE_FRAG } from './shaders/dreamscape';
import { EYE_FRAG } from './shaders/eye';
import { SOLARIS_FRAG } from './shaders/solaris';

export type SceneId = 'dreamscape' | 'solaris' | 'crimson' | 'astronaut' | 'eye';

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
  index: '02',
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
    accel: 3.0,
    maxSpeed: 0.85,
    damping: 2.6,
    driftX: 0.035,
    driftY: 0.02,
    driftZ: 0.03,
    driftRate: 0.05,
    parallax: 0.035,
  },
};

export const SOLARIS: SceneDefinition = {
  id: 'solaris',
  index: '01',
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
    accel: 2.6,
    maxSpeed: 0.75,
    damping: 2.4,
    driftX: 0.02,
    driftY: 0.012,
    driftZ: 0.045,
    driftRate: 0.03,
    parallax: 0.022,
  },
};

export const CRIMSON: SceneDefinition = {
  id: 'crimson',
  index: '03',
  name: 'Crimson Singularity',
  tagline: 'A black void full of stars, ringed in red and wrapped in drifting cloud.',
  path: 'crimson',
  accent: '#FF5C86',
  background: '#040205',
  fallback:
    'radial-gradient(circle at 50% 48%, #040205 0, #040205 24%, rgba(240,36,90,0.75) 25%, rgba(194,18,63,0.30) 34%, transparent 60%), #040205',
  fragment: CRIMSON_FRAG,
  fx: { glow: 0.22, grain: 0.04, vignette: 0.65, gain: 1.1 },
  camera: {
    accel: 2.8,
    maxSpeed: 0.8,
    damping: 2.5,
    driftX: 0.03,
    driftY: 0.016,
    driftZ: 0.035,
    driftRate: 0.045,
    parallax: 0.03,
  },
};

export const ASTRONAUT: SceneDefinition = {
  id: 'astronaut',
  index: '04',
  name: 'Edge of Everything',
  tagline: 'An astronaut sits on a ledge above the stars, legs swinging, the Earth far away.',
  path: 'astronaut',
  accent: '#BFE3F2',
  background: '#030812',
  fallback:
    'radial-gradient(70% 60% at 25% 65%, rgba(95,163,194,0.45), transparent 70%), radial-gradient(50% 50% at 70% 30%, rgba(44,92,134,0.35), transparent 75%), #030812',
  fragment: ASTRONAUT_FRAG,
  fx: { glow: 0.2, grain: 0.045, vignette: 0.6, gain: 1.1 },
  camera: {
    accel: 2.6,
    maxSpeed: 0.75,
    damping: 2.5,
    driftX: 0.02,
    driftY: 0.01,
    driftZ: 0.025,
    driftRate: 0.04,
    parallax: 0.03,
  },
};

export const EYE: SceneDefinition = {
  id: 'eye',
  index: '05',
  name: 'The Watcher',
  tagline: 'The Earth opens like an eye at the heart of a galaxy, looks at you, and closes.',
  path: 'eye',
  accent: '#7FD0F5',
  background: '#02030A',
  fallback:
    'radial-gradient(circle at 50% 49%, #050B1E 0, #0A1F4D 7%, #1E6FD0 13%, #F4EDE4 14%, #1D6BB8 22%, #0A2A66 29%, rgba(95,168,255,0.5) 30%, transparent 34%), #02030A',
  fragment: EYE_FRAG,
  fx: { glow: 0.18, grain: 0.04, vignette: 0.6, gain: 1.1 },
  // Large pointer parallax: on this screen it also steers the eye's gaze.
  camera: {
    accel: 2.6,
    maxSpeed: 0.75,
    damping: 2.5,
    driftX: 0.015,
    driftY: 0.008,
    driftZ: 0.03,
    driftRate: 0.04,
    parallax: 0.11,
  },
};

/** In scroll order: the cosmos page walks through these top to bottom. */
export const SCENES: readonly SceneDefinition[] = [SOLARIS, DREAMSCAPE, CRIMSON, ASTRONAUT, EYE];

export const getScene = (id: SceneId): SceneDefinition => SCENES.find((s) => s.id === id) ?? SOLARIS;
