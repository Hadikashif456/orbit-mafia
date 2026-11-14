import type { FC } from 'react';
import { Link } from 'react-router-dom';
import type { DetailBand, DetailSnapshot } from '../../types/astronaut';
import { getStatusSummary } from '../../utils/statusSummary';

interface StatusCardProps {
  snapshot: DetailSnapshot;
}

export const getBandLabel = (band: DetailBand): string => band;

export const StatusCard: FC<StatusCardProps> = ({ snapshot }) => {
  const band = getBandLabel(snapshot.band);
  const needsAction = band !== 'Green';
  return (
    <section className={`detail-status detail-status--${band.toLowerCase()}`} aria-labelledby="status-heading">
      <span className="detail-eyebrow">Current band</span>
      <h2 id="status-heading">{band === 'Green' ? 'Normal' : band === 'Amber' ? 'Watch' : 'Alert'}</h2>
      <div className="detail-status-band"><i aria-hidden="true" />{band}</div>
      <div className="detail-status-summary">{getStatusSummary(snapshot).map((line) => <p key={line}>{line}</p>)}</div>
      {needsAction && <Link className="detail-alert-button" to={`/alert/${snapshot.id}`} aria-label="View alert and recommended actions">View details</Link>}
    </section>
  );
};
