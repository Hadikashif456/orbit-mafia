import { createContext, useContext, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { FC, ReactNode } from 'react';
import { CameraController } from './CameraController';
import { SCENES } from './scenes';
import type { SceneId } from './scenes';

interface CosmosValue {
  /** Scene the backdrop should be showing. */
  scene: SceneId;
  setScene: (id: SceneId) => void;
  /** True on the cosmos screens: full brightness, camera controls live. */
  immersive: boolean;
  setImmersive: (on: boolean) => void;
  /**
   * How far the cosmos page is scrolled, 0 (top) to 1 (bottom). While
   * immersive, this drives the blend from the first scene to the second.
   * A ref, not state, so scrolling never re-renders React.
   */
  scrollProgress: MutableRefObject<number>;
  camera: CameraController;
}

const CosmosContext = createContext<CosmosValue | null>(null);

/** Open on the scene named in the URL, so a deep link never starts on the wrong one. */
const initialScene = (): SceneId => {
  if (typeof window === 'undefined') return 'solaris';
  const match = SCENES.find((s) => window.location.pathname.startsWith(`/cosmos/${s.path}`));
  return match ? match.id : 'solaris';
};

export const CosmosProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [scene, setScene] = useState<SceneId>(initialScene);
  const [immersive, setImmersive] = useState(false);
  const scrollProgress = useRef(0);
  const camera = useMemo(() => new CameraController(), []);
  const value = useMemo(
    () => ({ scene, setScene, immersive, setImmersive, scrollProgress, camera }),
    [scene, immersive, camera],
  );
  return <CosmosContext.Provider value={value}>{children}</CosmosContext.Provider>;
};

export const useCosmos = (): CosmosValue => {
  const value = useContext(CosmosContext);
  if (!value) throw new Error('useCosmos must be used inside CosmosProvider');
  return value;
};
