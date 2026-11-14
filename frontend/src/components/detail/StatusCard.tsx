import type { FC } from 'react';
import { Link } from 'react-router-dom';
import type { AstronautSnapshot } from '../../types/astronaut';
import { getStatusSummary } from '../../utils/statusSummary';

interface StatusCardProps {
  snapshot: AstronautSnapshot;
}

export const getBandLabel = (status: AstronautSnapshot['status']): string =>
  status === 'watch' ? 'Amber' : status === 'act_now' ? 'Red' : 'Green';

export const StatusCard: FC<StatusCardProps> = ({ snapshot }) => {
  const band = getBandLabel(snapshot.status);
  const needsAction = band !== 'Green';
  return (
    <section className={`detail-status detail-status--${band.toLowerCase()}`} aria-labelledby="status-heading">
      <span className="detail-eyebrow">Current band</span>
      <h2 id="status-heading">{band === 'Green' ? 'Normal / Safe' : band === 'Amber' ? 'Watch' : 'Alert'}</h2>
      <div className="detail-status-band"><i aria-hidden="true" />{band}</div>
      <div className="detail-status-summary">{getStatusSummary(snapshot.status).map((line) => <p key={line}>{line}</p>)}</div>
      {needsAction && <Link className="detail-alert-button" to={`/alert/${snapshot.id}`} aria-label="View alert and recommended actions">View details</Link>}
    </section>
  );
};
