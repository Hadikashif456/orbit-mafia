import { useEffect, type FC } from 'react';
import { useCosmos } from '../cosmos/CosmosContext';
import { ObsidianSolaris } from '../cosmos/ObsidianSolaris';

export const CrewBoard: FC = () => {
  const { scene, setScene, setImmersive } = useCosmos();

  useEffect(() => {
    const previousScene = scene;
    setScene('solaris');
    setImmersive(true);
    return () => {
      setScene(previousScene);
      setImmersive(false);
    };
  }, [setImmersive, setScene]);

  return (
    <section aria-label="Obsidian Solaris" className="relative cursor-ns-resize select-none">
      <div className="relative">
        <ObsidianSolaris />
        <div
          className="pointer-events-none absolute left-5 top-[16%] sm:left-[6%] sm:top-[34%]"
          style={{ textShadow: '0 2px 28px rgba(0,0,0,0.9)' }}
        >
          <h1 className="text-5xl font-black uppercase leading-none tracking-tight text-white sm:text-6xl lg:text-7xl">
            Orbit Mafia
          </h1>
          <p className="mt-4 max-w-[19rem] font-serif text-lg italic leading-snug text-slate-200 sm:mt-5 sm:max-w-[24rem] sm:text-xl lg:text-2xl">
            In the Silence of Space,{' '}
            <span className="whitespace-nowrap text-[#F4D6A3]">Every Heartbeat Matters.</span>
          </p>
        </div>
      </div>
    </section>
  );
};
