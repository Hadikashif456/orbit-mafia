import { useEffect, useState, type FC } from 'react';
import { GlassSwitcher, type GlassVariant } from '../components/GlassSwitcher';
import { CrewGrid } from '../components/crew/CrewGrid';
import { useCosmos } from '../cosmos/CosmosContext';
import { CREW_MEMBERS } from '../data/crew';

const getSavedGlass = (): GlassVariant => {
  if (typeof window === 'undefined') return 'clear';
  const saved = window.localStorage.getItem('vital-orbit-glass');
  return saved === 'frosted' || saved === 'liquid' ? saved : 'clear';
};

export const CrewBoardPage: FC = () => {
  const [glass, setGlass] = useState<GlassVariant>(getSavedGlass);
  const { scene, setScene } = useCosmos();

  useEffect(() => {
    const previousScene = scene;
    setScene('dreamscape');
    return () => setScene(previousScene);
  }, [setScene]);

  return (
    <section className="crew-board-page" data-glass={glass}>
      <svg className="crew-liquid-filter" aria-hidden="true">
        <defs>
          <filter id="crew-liquid">
            <feTurbulence baseFrequency="0.015" numOctaves="1" seed="3" type="fractalNoise" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <div className="crew-board-content">
        <header className="crew-board-heading">
          <span className="crew-eyebrow">Mission Sol 144 / Crew Status</span>
          <h1>Crew Board</h1>
          <p>Live resilience readout for every crew member. Tap a card for detail.</p>
        </header>
        <CrewGrid members={CREW_MEMBERS} />
      </div>
      <GlassSwitcher value={glass} onChange={setGlass} />
    </section>
  );
};
