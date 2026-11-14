import { createContext, useContext, useMemo, useState } from 'react';
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
  camera: CameraController;
}

const CosmosContext = createContext<CosmosValue | null>(null);

/** Open on the scene named in the URL, so a deep link never starts on the wrong one. */
const initialScene = (): SceneId => {
  if (typeof window === 'undefined') return 'dreamscape';
  const match = SCENES.find((s) => window.location.pathname.startsWith(`/cosmos/${s.path}`));
  return match ? match.id : 'dreamscape';
};

export const CosmosProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [scene, setScene] = useState<SceneId>(initialScene);
  const [immersive, setImmersive] = useState(false);
  const camera = useMemo(() => new CameraController(), []);
  const value = useMemo(
    () => ({ scene, setScene, immersive, setImmersive, camera }),
    [scene, immersive, camera],
  );
  return <CosmosContext.Provider value={value}>{children}</CosmosContext.Provider>;
};

export const useCosmos = (): CosmosValue => {
  const value = useContext(CosmosContext);
  if (!value) throw new Error('useCosmos must be used inside CosmosProvider');
  return value;
};
