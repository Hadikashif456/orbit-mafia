import { useEffect, useState, useMemo, type FC } from 'react';
import { GlassSwitcher, type GlassVariant } from '../components/GlassSwitcher';
import { CrewGrid } from '../components/crew/CrewGrid';
import { useCosmos } from '../cosmos/CosmosContext';
import { useMissionSol } from '../context/SolContext';
import { useCrewSummaries } from '../hooks/useCrewSummaries';
import { toCrewMember } from '../api/adapters';

const getSavedGlass = (): GlassVariant => {
  if (typeof window === 'undefined') return 'clear';
  const saved = window.localStorage.getItem('vital-orbit-glass');
  return saved === 'frosted' || saved === 'liquid' ? saved : 'clear';
};

export const CrewBoardPage: FC = () => {
  const [glass, setGlass] = useState<GlassVariant>(getSavedGlass);
  const { scene, setScene } = useCosmos();
  const { sol } = useMissionSol();
  const { data: summaries, isLoading, isError, error, refetch } = useCrewSummaries(sol);

  const members = useMemo(() => {
    return summaries ? summaries.map(toCrewMember) : [];
  }, [summaries]);

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
          <span className="crew-eyebrow">Mission Sol {sol} / Crew Status</span>
          <h1>Crew Board</h1>
          <p>Live resilience readout for every crew member. Tap a card for detail.</p>
        </header>
        {isLoading && (
          <p className="detail-role">Loading crew resilience summaries...</p>
        )}
        {isError && (
          <div>
            <p className="detail-role">Failed to load crew resilience: {error?.message || 'Error loading crew'}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="detail-role underline mt-2 hover:text-white cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}
        {!isLoading && !isError && <CrewGrid members={members} />}
      </div>
      <GlassSwitcher value={glass} onChange={setGlass} />
    </section>
  );
};
