import { useEffect, type FC } from 'react';
import { useProvenance } from '../hooks/useProvenance';
import { useBiomarkers } from '../hooks/useBiomarkers';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { CRI_WEIGHTS, STATUS_THRESHOLDS } from '../lib/constants';
import { ASTRONAUT as DATA_SCENE } from '../cosmos/scenes';
import { useCosmos } from '../cosmos/CosmosContext';
import '../styles/about.css';

const DISCLAIMER_TEXT = 'Risk flags and suggested countermeasures only. Not a medical diagnosis.';

export const DataMethod: FC = () => {
  const { scene, setScene } = useCosmos();
  const { data: provenance, isLoading: provLoading } = useProvenance();
  const { data: biomarkers, isLoading: bioLoading } = useBiomarkers('C001', ['CRP', 'Fibrinogen']);

  useEffect(() => {
    const previousScene = scene;
    setScene(DATA_SCENE.id);
    return () => setScene(previousScene);
  }, [setScene]);

  return (
    <div className="about-page">
      <header className="about-header detail-panel explore-glass-effect">
        <span className="about-eyebrow">Data & Scientific Methodology</span>
        <h1>Data & Method</h1>
        <p>
          Disclosures regarding data provenance, NASA Open Science Data Repository (OSDR) citations,
          heuristic Crew Resilience Index (CRI) formulation, and synthetic telemetry fields.
        </p>
      </header>

      <div className="about-grid">
        {/* Regulatory & Safety Policy */}
        <section className="about-card detail-panel explore-glass-effect">
          <h2>Operational Policy & Regulatory Notice</h2>
          <p className="text-sm text-slate-300">
            {provenance?.policy ||
              "Risk flags and suggested countermeasures only. The words 'diagnose', 'detects disease', and 'treats' are strictly forbidden."}
          </p>
          <div className="about-disclaimer-box">
            <strong>Safety Disclaimer:</strong> {DISCLAIMER_TEXT}
          </div>
        </section>

        {/* Datasets & Citations */}
        <section className="about-card detail-panel explore-glass-effect">
          <h2>Provenance & NASA OSDR Datasets</h2>
          {provLoading ? (
            <p className="text-sm text-slate-400">Loading provenance metadata...</p>
          ) : (
            <div className="about-table-wrap">
              <table className="about-table">
                <thead>
                  <tr>
                    <th>Dataset ID</th>
                    <th>Title</th>
                    <th>Citation</th>
                    <th>Access Date</th>
                    <th>Provenance</th>
                  </tr>
                </thead>
                <tbody>
                  {provenance?.datasets.map((d) => (
                    <tr key={d.id}>
                      <td className="font-mono text-cyan-400">{d.id}</td>
                      <td>{d.title}</td>
                      <td className="text-slate-400">{d.citation}</td>
                      <td className="font-mono text-xs">{d.accessDate}</td>
                      <td>
                        <ProvenanceBadge provenance={d.provenance} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {provenance?.replayNote && (
            <p className="text-xs text-slate-400 mt-4 italic">
              <strong>Replay Note:</strong> {provenance.replayNote}
            </p>
          )}
        </section>

        {/* Heuristic CRI Formula */}
        <section className="about-card detail-panel explore-glass-effect">
          <h2>Crew Resilience Index (CRI) Formulation</h2>
          <p className="text-sm text-slate-300 mb-3">
            The CRI synthesizes multiple physiological and operational telemetry streams into a composite resilience index (0–100).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-2">Term Weights (Sum: 1.00)</h3>
              <ul className="text-sm space-y-1 font-mono text-slate-300">
                {Object.entries(CRI_WEIGHTS).map(([key, weight]) => (
                  <li key={key} className="flex justify-between py-1 border-b border-slate-800">
                    <span className="capitalize">{key}:</span>
                    <span className="text-cyan-400">{weight.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-2">Status Thresholds</h3>
              <ul className="text-sm space-y-1 font-mono text-slate-300">
                <li className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-emerald-400">Green (Optimal):</span>
                  <span>CRI &ge; {STATUS_THRESHOLDS.GREEN_MIN}</span>
                </li>
                <li className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-amber-400">Amber (Watch):</span>
                  <span>{STATUS_THRESHOLDS.AMBER_MIN} &le; CRI &lt; {STATUS_THRESHOLDS.GREEN_MIN}</span>
                </li>
                <li className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-rose-400">Red (Act Now):</span>
                  <span>CRI &lt; {STATUS_THRESHOLDS.AMBER_MIN}</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Synthetic Fields */}
        <section className="about-card detail-panel explore-glass-effect">
          <h2>Synthetic Telemetry Fields</h2>
          <p className="text-sm text-slate-300 mb-3">
            The following time-series telemetry attributes are synthetically generated for operational scenario simulation:
          </p>
          <ul className="about-list">
            {(provenance?.syntheticFields ?? [
              'vitals.hr',
              'vitals.hrv',
              'vitals.sleep_hours',
              'vitals.radiation_msv',
              'vitals.exercise_min',
              'vitals.mood',
            ]).map((field) => (
              <li key={field} className="about-pill">
                {field}
              </li>
            ))}
          </ul>
        </section>

        {/* Real NASA OSDR Biomarkers Table */}
        <section className="about-card detail-panel explore-glass-effect">
          <div className="flex items-center justify-between mb-2">
            <h2>Real NASA OSDR Biomarkers (OSD-575 / LSDS-8)</h2>
            <ProvenanceBadge provenance="REAL_OSDR" />
          </div>
          <p className="text-sm text-slate-300">
            Blood inflammatory and cardiovascular biomarkers for C001 (CRP and Fibrinogen) across mission timepoints:
          </p>
          {bioLoading ? (
            <p className="text-sm text-slate-400 mt-2">Loading biomarker data...</p>
          ) : (
            <div className="about-table-wrap">
              <table className="about-table">
                <thead>
                  <tr>
                    <th>Timepoint</th>
                    <th>Analyte</th>
                    <th>Value</th>
                    <th>Unit</th>
                    <th>Reference Range</th>
                    <th>Provenance</th>
                  </tr>
                </thead>
                <tbody>
                  {biomarkers && biomarkers.length > 0 ? (
                    biomarkers.map((b, idx) => (
                      <tr key={`${b.timepoint}-${b.name}-${idx}`}>
                        <td className="font-mono text-cyan-400">{b.timepoint}</td>
                        <td className="font-semibold text-slate-200">{b.name}</td>
                        <td className="font-mono text-slate-100">{b.value.toLocaleString()}</td>
                        <td className="text-slate-400 text-xs">{b.unit}</td>
                        <td className="font-mono text-xs text-slate-400">
                          {b.refMin !== null && b.refMin !== undefined && b.refMax !== null && b.refMax !== undefined
                            ? `${b.refMin.toLocaleString()} – ${b.refMax.toLocaleString()}`
                            : 'N/A'}
                        </td>
                        <td>
                          <ProvenanceBadge provenance={b.provenance} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-slate-400 text-center py-4">
                        No biomarker telemetry returned for query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
