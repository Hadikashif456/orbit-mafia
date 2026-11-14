import { useState, type FC } from 'react';
import { Link, useParams } from 'react-router-dom';
import { InputsChart } from '../components/detail/InputsChart';
import { CriBreakdown } from '../components/detail/CriBreakdown';
import { ProfilePanel } from '../components/detail/ProfilePanel';
import { StatusCard } from '../components/detail/StatusCard';
import { useAstronaut } from '../hooks/useAstronaut';

type DetailTab = 'profile' | 'graph' | 'status';

export const AstronautDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { snapshot, trendResponse, loading, error } = useAstronaut(id);
  const [tab, setTab] = useState<DetailTab>('status');

  if (loading) return <main className="detail-screen"><p className="detail-role">Loading astronaut telemetry...</p></main>;
  if (error || !snapshot) return <main className="detail-screen"><p className="detail-role">{error ?? 'Astronaut data is unavailable.'}</p></main>;

  const activeTab = snapshot.status === 'optimal' || snapshot.status === 'stable' ? (tab === 'status' ? 'profile' : tab) : tab;
  const setActiveTab = (next: DetailTab): void => setTab(next);

  return (
    <main className="detail-screen" data-glass="clear">
      <div className="detail-layout">
        <header className="detail-title-row">
          <span className="detail-eyebrow">Mission Sol 144 / Astronaut Detail</span>
          <Link to="/crew" className="detail-back-link">Back to Crew Board</Link>
          <span className="synthetic-chip">Synthetic demo data</span>
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
          <InputsChart snapshot={snapshot} trendResponse={trendResponse} />
          <aside className="detail-info-panel">
            <CriBreakdown snapshot={snapshot} compact />
            <StatusCard snapshot={snapshot} />
          </aside>
        </div>
        <div className={`detail-mobile-panel detail-mobile-panel--${activeTab}`}>
          {activeTab === 'profile' && <ProfilePanel snapshot={snapshot} />}
          {activeTab === 'graph' && <InputsChart snapshot={snapshot} trendResponse={trendResponse} />}
          {activeTab === 'status' && <aside className="detail-info-panel"><CriBreakdown snapshot={snapshot} compact /><StatusCard snapshot={snapshot} /></aside>}
        </div>
      </div>
    </main>
  );
};
