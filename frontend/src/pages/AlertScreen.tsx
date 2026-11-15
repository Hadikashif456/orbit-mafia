import { useEffect, type FC } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCosmos } from '../cosmos/CosmosContext';
import { CRIMSON, SCENES } from '../cosmos/scenes';
import { useMissionSol } from '../context/SolContext';
import { useCri } from '../hooks/useCri';
import { useCopilotExplanation } from '../hooks/useCopilot';
import { statusToBand } from '../api/adapters';

export const AlertScreen: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { scene, immersive, scrollProgress, setScene, setImmersive } = useCosmos();
  const { sol } = useMissionSol();

  const { data: cri, isLoading: criLoading, error: criError } = useCri(id, sol);
  const { data: copilot, isLoading: copilotLoading, error: copilotError } = useCopilotExplanation(id, sol);

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

  if (criLoading || copilotLoading) {
    return (
      <main className="alert-screen">
        <p className="text-slate-300">Loading risk assessment and Copilot countermeasures...</p>
      </main>
    );
  }

  if (criError || copilotError || !copilot) {
    return (
      <main className="alert-screen">
        <p className="text-rose-400">
          Failed to load alert data: {criError?.message || copilotError?.message || 'Alert data is unavailable.'}
        </p>
      </main>
    );
  }

  const band = cri ? statusToBand(cri.status) : 'Amber';
  const alertTone = band === 'Amber' ? 'amber' : band === 'Red' ? 'red' : 'green';
  const heading = band === 'Amber' ? 'Warning' : band === 'Red' ? 'Alert' : 'Normal';

  return (
    <main className="alert-screen">
      <article className={`alert-card alert-card--${alertTone}`} aria-labelledby="alert-heading">
        <div className="alert-card-heading">
          <div>
            <span className="detail-eyebrow">Mission Sol {sol} / Crew Alert</span>
            <h1 id="alert-heading">{heading}</h1>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mt-0.5">
              Mode: {copilot.mode}
            </span>
          </div>
          <Link to={`/crew/${id}`} className="alert-back-link">Back to detail</Link>
        </div>
        <p className="alert-summary">{copilot.summary}</p>
        <div className="alert-columns">
          <section aria-labelledby="drivers-heading">
            <h2 id="drivers-heading">Drivers</h2>
            {copilot.drivers.length > 0 ? (
              <ul>{copilot.drivers.map((driver) => <li key={driver}>{driver}</li>)}</ul>
            ) : (
              <p>No active drivers.</p>
            )}
          </section>
          <section aria-labelledby="recommendations-heading">
            <h2 id="recommendations-heading">Recommendations</h2>
            <div className="alert-recommendations">
              {copilot.suggestedActions.map((action) => (
                <article key={action.title}>
                  <h3>{action.title}</h3>
                  <p>{action.protocol}</p>
                  <p className="text-xs text-slate-400 mt-1 font-mono">Source: {action.source}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
        <p className="alert-disclaimer">{copilot.disclaimer}</p>
      </article>
    </main>
  );
};
