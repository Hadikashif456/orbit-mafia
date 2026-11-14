import { useEffect, type FC } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCosmos } from '../cosmos/CosmosContext';
import { CRIMSON } from '../cosmos/scenes';
import fakeData from '../data/fake_data.json';

type AlertData = (typeof fakeData)[keyof typeof fakeData];

export const AlertScreen: FC = () => {
  const { id = 'C004' } = useParams<{ id: string }>();
  const { scene, setScene } = useCosmos();
  const data = (fakeData[`${id}:142` as keyof typeof fakeData] ?? fakeData['C004:142']) as AlertData;

  useEffect(() => {
    const previousScene = scene;
    setScene(CRIMSON.id);
    return () => setScene(previousScene);
  }, [setScene]);

  return (
    <main className="alert-screen">
      <article className="alert-card" aria-labelledby="alert-heading">
        <div className="alert-card-heading">
          <div>
            <span className="detail-eyebrow">Mission Sol 142 / Crew Alert</span>
            <h1 id="alert-heading">Alert</h1>
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
