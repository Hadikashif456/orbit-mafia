import { useEffect, type FC } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCosmos } from '../cosmos/CosmosContext';
import { CRIMSON, SCENES } from '../cosmos/scenes';
import fakeData from '../data/fake_data.json';
import { getAstronautSnapshot } from '../data/detailSource';

type AlertData = (typeof fakeData)[keyof typeof fakeData];

export const AlertScreen: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { scene, immersive, scrollProgress, setScene, setImmersive } = useCosmos();
  const snapshot = id ? getAstronautSnapshot(id) : null;
  const data = id ? fakeData[`${id}:142` as keyof typeof fakeData] as AlertData | undefined : undefined;
  const band = snapshot?.band;

  useEffect(() => {
    const previousScene = scene;
    const previousImmersive = immersive;
    const previousProgress = scrollProgress.current;
    setScene(CRIMSON.id);
    scrollProgress.current = SCENES.findIndex((item) => item.id === CRIMSON.id) / (SCENES.length - 1);
    setImmersive(true);
    return () => {
      setScene(previousScene);
      setImmersive(previousImmersive);
      scrollProgress.current = previousProgress;
    };
  }, [scrollProgress, setImmersive, setScene]);

  if (!snapshot || !data || !band) {
    return <main className="alert-screen"><p>Alert data is unavailable for this crew member.</p></main>;
  }

  const alertTone = band === 'Amber' ? 'amber' : band === 'Red' ? 'red' : 'green';
  const heading = band === 'Amber' ? 'Warning' : band === 'Red' ? 'Alert' : 'Normal';

  return (
    <main className="alert-screen">
      <article className={`alert-card alert-card--${alertTone}`} aria-labelledby="alert-heading">
        <div className="alert-card-heading">
          <div>
            <span className="detail-eyebrow">Mission Sol 142 / Crew Alert</span>
            <h1 id="alert-heading">{heading}</h1>
          </div>
          <Link to={`/crew/${id}`} className="alert-back-link">Back to detail</Link>
        </div>
        <p className="alert-summary">{data.summary}</p>
        <div className="alert-columns">
          <section aria-labelledby="drivers-heading">
            <h2 id="drivers-heading">Drivers</h2>
            {data.drivers.length > 0 ? (
              <ul>{data.drivers.map((driver) => <li key={driver}>{driver}</li>)}</ul>
            ) : (
              <p>No active drivers.</p>
            )}
          </section>
          <section aria-labelledby="recommendations-heading">
            <h2 id="recommendations-heading">Recommendations</h2>
            <div className="alert-recommendations">
              {data.suggestedActions.map((action) => (
                <article key={action.title}>
                  <h3>{action.title}</h3>
                  <p>{action.protocol}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
        <p className="alert-disclaimer">{data.disclaimer}</p>
      </article>
    </main>
  );
};
