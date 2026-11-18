import { useEffect, useState, type FC } from 'react';
import { Link, useParams } from 'react-router-dom';
import { InputsChart } from '../components/detail/InputsChart';
import type { GlassVariant } from '../components/GlassSwitcher';
import { ProfilePanel } from '../components/detail/ProfilePanel';
import { StatusCard } from '../components/detail/StatusCard';
import { ASTRONAUT as DETAIL_SCENE } from '../cosmos/scenes';
import { useCosmos } from '../cosmos/CosmosContext';
import { useAstronaut } from '../hooks/useAstronaut';
import { useMissionSol } from '../context/SolContext';
import { isUsingMock } from '../api/client';

type DetailTab = 'profile' | 'graph' | 'status';

export const AstronautDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { scene, setScene } = useCosmos();
  const { sol } = useMissionSol();
  const { snapshot, rows, loading, error } = useAstronaut(id);
  const [tab, setTab] = useState<DetailTab>('status');
  const [glass] = useState<GlassVariant>(() => {
    if (typeof window === 'undefined') return 'clear';
    const saved = window.localStorage.getItem('vital-orbit-glass');
    return saved === 'frosted' || saved === 'liquid' ? saved : 'clear';
  });

  useEffect(() => {
    const previousScene = scene;
    setScene(DETAIL_SCENE.id);
    return () => setScene(previousScene);
  }, [setScene]);

  if (loading) return <section className="detail-screen"><p className="detail-role">Loading astronaut telemetry...</p></section>;
  if (error || !snapshot) return <section className="detail-screen"><p className="detail-role">{error ?? 'Astronaut data is unavailable.'}</p></section>;

  const activeTab = snapshot.band === 'Green' ? (tab === 'status' ? 'profile' : tab) : tab;
  const setActiveTab = (next: DetailTab): void => setTab(next);

  return (
    <section className="detail-screen" data-glass={glass}>
      <div className="detail-layout">
        <header className="detail-title-row">
          <div className="flex items-center gap-3">
            <span className="detail-eyebrow">Mission Sol {sol} / Astronaut Detail</span>
            {isUsingMock() && <span className="synthetic-chip">Offline mock data</span>}
          </div>
          <Link to="/crew" className="detail-back-link">Back to Crew Board</Link>
        </header>
        <div className="detail-tabs" role="tablist" aria-label="Astronaut detail sections">
          {(['profile', 'graph', 'status'] as const).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={activeTab === item} onClick={() => setActiveTab(item)}>
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        <div className="detail-content-grid">
          <ProfilePanel snapshot={snapshot} />
          <InputsChart rows={rows} band={snapshot.band} dataLabel={snapshot.data_label} />
          <aside className="detail-info-panel">
            <StatusCard snapshot={snapshot} />
          </aside>
        </div>
        <div className={`detail-mobile-panel detail-mobile-panel--${activeTab}`}>
          {activeTab === 'profile' && <ProfilePanel snapshot={snapshot} />}
          {activeTab === 'graph' && <InputsChart rows={rows} band={snapshot.band} dataLabel={snapshot.data_label} />}
          {activeTab === 'status' && <aside className="detail-info-panel"><StatusCard snapshot={snapshot} /></aside>}
        </div>
      </div>
    </section>
  );
};
