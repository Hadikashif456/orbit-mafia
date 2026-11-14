import type { FC } from 'react';
import type { AstronautSnapshot } from '../../types/astronaut';
import { getBandLabel } from './StatusCard';
import { InputBars } from './InputBars';

interface ProfilePanelProps {
  snapshot: AstronautSnapshot;
}

export const ProfilePanel: FC<ProfilePanelProps> = ({ snapshot }) => (
  <section className={`detail-panel detail-panel--${snapshot.status === 'watch' ? 'amber' : snapshot.status === 'act_now' ? 'red' : 'green'} detail-profile-panel`} aria-labelledby="profile-heading">
    <div className="detail-avatar" aria-hidden="true">
      <span>+-----+</span>
      <span>|  ◉  |</span>
      <span>| /|\\ |</span>
      <span>+-----+</span>
    </div>
    <div className="detail-profile-copy">
      <span className="detail-eyebrow">Crew member</span>
      <h2 id="profile-heading">{snapshot.name}</h2>
      <p>{snapshot.role}</p>
      <span className="detail-code">{snapshot.id.replace('C00', 'CM-')}</span>
    </div>
    <div className="detail-cri">
      <span>CRI</span>
      <strong>{snapshot.cri}</strong>
      <div className="detail-cri-bar"><span style={{ width: `${snapshot.cri}%` }} /></div>
      <span className={`detail-band detail-band--${snapshot.status === 'watch' ? 'amber' : snapshot.status === 'act_now' ? 'red' : 'green'}`}>
        <i aria-hidden="true" />{getBandLabel(snapshot.status)}
      </span>
      <small>CRI change: {snapshot.cri === 61 ? '82 → 61' : `${snapshot.cri} → ${snapshot.cri}`}</small>
    </div>
    <InputBars snapshot={snapshot} />
  </section>
);
