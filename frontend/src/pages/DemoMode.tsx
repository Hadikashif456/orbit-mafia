import { useEffect, type FC } from 'react';
import { useCosmos } from '../cosmos/CosmosContext';
import { EYE } from '../cosmos/scenes';

export const DemoMode: FC = () => {
  const { scene, immersive, scrollProgress, setScene, setImmersive } = useCosmos();

  useEffect(() => {
    const previousScene = scene;
    const previousImmersive = immersive;
    const previousProgress = scrollProgress.current;
    setScene(EYE.id);
    scrollProgress.current = 1;
    setImmersive(true);
    return () => {
      setScene(previousScene);
      setImmersive(previousImmersive);
      scrollProgress.current = previousProgress;
    };
  }, [scrollProgress, setImmersive, setScene]);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-100">
        Mission Timeline Demo Mode
      </h1>
      <p className="text-sm text-slate-400 mt-1">
        Replay Sol 140–145: SPE radiation spike, CRI drop, and Copilot countermeasure trigger.
      </p>
    </div>
  );
};
