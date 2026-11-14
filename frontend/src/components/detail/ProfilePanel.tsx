import type { FC } from 'react';
import type { DetailSnapshot } from '../../types/astronaut';
import { getCriChange } from '../../utils/criChange';
import { InputBars } from './InputBars';

interface ProfilePanelProps {
  snapshot: DetailSnapshot;
}

export const ProfilePanel: FC<ProfilePanelProps> = ({ snapshot }) => (
  <section className={`detail-panel detail-panel--${snapshot.band.toLowerCase()} detail-profile-panel`} aria-labelledby="profile-heading">
    <div className="detail-profile-copy">
      <h2 id="profile-heading">{snapshot.name}</h2>
      <p>{snapshot.role}</p>
    </div>
    <div className="detail-cri">
      <div className="detail-cri-summary">
        <span className="detail-cri-label">CRI</span>
        <strong>{snapshot.cri}</strong>
        <span className={`detail-band detail-band--${snapshot.band.toLowerCase()}`}>
          <i aria-hidden="true" />{snapshot.band}
        </span>
      </div>
      <div className="detail-cri-bar"><span style={{ width: `${snapshot.cri}%` }} /></div>
      {getCriChange(snapshot.trend) && <small>CRI change: {getCriChange(snapshot.trend)}</small>}
    </div>
    <InputBars snapshot={snapshot} />
  </section>
);
