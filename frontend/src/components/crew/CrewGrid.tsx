import type { FC } from 'react';
import type { CrewMember } from '../../types/crew';
import { CrewCard } from './CrewCard';

interface CrewGridProps {
  members: readonly CrewMember[];
}

export const CrewGrid: FC<CrewGridProps> = ({ members }) => (
  <div className="crew-grid">
    {members.map((member, index) => <CrewCard key={member.id} member={member} index={index} />)}
  </div>
);
