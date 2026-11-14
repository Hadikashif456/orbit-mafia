import type { FC } from 'react';
import { Link } from 'react-router-dom';
import type { CrewMember } from '../../types/crew';
import { getCrewStatus, getTrendLabel } from '../../utils/crew';
import { ResilienceBar } from './ResilienceBar';
import { StatusBadge } from './StatusBadge';

interface CrewCardProps {
  member: CrewMember;
  index: number;
}

export const CrewCard: FC<CrewCardProps> = ({ member, index }) => {
  const status = getCrewStatus(member);
  return (
    <Link
      to={`/crew/${member.id}`}
      className={`crew-card explore-glass-effect card-${index + 1} status-${status}`}
      aria-label={`Open astronaut detail for ${member.name}`}
    >
      <span className="crew-card__scrim" aria-hidden="true" />
      <div className="crew-card__content">
        <span className="crew-code">{member.code}</span>
        <div className="crew-card-heading">
          <h2>{member.name}</h2>
          <p>{member.role}</p>
        </div>
        <span className="cri-label">Crew Resilience Index</span>
        <strong className="cri-value">{member.cri}</strong>
        <ResilienceBar value={member.cri} status={status} />
        <StatusBadge status={status} />
        <span className="crew-trend">{getTrendLabel(member)}</span>
      </div>
    </Link>
  );
};
