import type { Provenance } from '../api/types';

export interface TrustEntry {
  id: string;
  datasetOrMetric: string;
  provenance: Provenance;
  source: string;
  whatItFeedsInCRI: string;
  limitation: string;
}

export const TRUST_ENTRIES: TrustEntry[] = [
  {
    id: 'osdr-579',
    datasetOrMetric: 'Proteomics & Inflammatory Biomarkers (HD71, Alamar)',
    provenance: 'REAL_OSDR',
    source: 'NASA OSDR OSD-579 (Inspiration4 Proteomics Profile)',
    whatItFeedsInCRI: 'Feeds the Inflammation CRI contribution (CRP, Fibrinogen, cytokine drift)',
    limitation: '4 civilian crew, 7 discrete flight timepoints, 3-day LEO orbital flight (not Mars/deep-space).',
  },
  {
    id: 'osdr-580',
    datasetOrMetric: 'Comprehensive Metabolic Panel (CMP Chemistry)',
    provenance: 'REAL_OSDR',
    source: 'NASA OSDR OSD-580 (Inspiration4 Clinical Laboratory Chemistry)',
    whatItFeedsInCRI: 'Establishes metabolic drift; verifies physiological stability against clinical ranges',
    limitation: 'Reference ranges only exist for CMP; sample size limited to 4 crew across orbital mission.',
  },
  {
    id: 'vitals-cardio',
    datasetOrMetric: 'Cardiovascular Telemetry (Heart Rate & HRV)',
    provenance: 'SYNTHETIC',
    source: 'Physiological heuristic generator calibrated on spaceflight autonomic drift',
    whatItFeedsInCRI: 'Feeds Cardiovascular CRI contribution via resting HR elevation and HRV suppression',
    limitation: 'Synthetic daily measurements rather than continuous ambulatory telemetry.',
  },
  {
    id: 'vitals-sleep',
    datasetOrMetric: 'Sleep Architecture & Rest Hours',
    provenance: 'SYNTHETIC',
    source: 'Simulated circadian rhythm and rest log model',
    whatItFeedsInCRI: 'Feeds Sleep Debt CRI contribution using 3-day and cumulative rolling windows',
    limitation: 'Modeled sleep durations without polysomnography or EEG actigraphy.',
  },
  {
    id: 'vitals-radiation',
    datasetOrMetric: 'Ambient Space Radiation Telemetry',
    provenance: 'SYNTHETIC',
    source: 'Synthetic Solar Particle Event (SPE) burst dosimeter model',
    whatItFeedsInCRI: 'Feeds Radiation CRI penalty (acute spike and cumulative millisievert load)',
    limitation: 'Modeled radiation surge peaking at 9.0 mSv; not hardware dosimeter streaming.',
  },
  {
    id: 'vitals-mood',
    datasetOrMetric: 'Psychological Well-Being Rating',
    provenance: 'SYNTHETIC',
    source: 'Simulated 1-5 psychometric daily mood self-assessment',
    whatItFeedsInCRI: 'Feeds Mood CRI contribution reflecting isolation and mission workload stress',
    limitation: 'Synthetic questionnaire values; subjective qualitative proxy.',
  },
  {
    id: 'knowledge-curated',
    datasetOrMetric: 'Clinical Countermeasure Knowledge Base',
    provenance: 'CURATED',
    source: 'NASA Human Research Program (HRP) Evidence Reports & Standard Countermeasures',
    whatItFeedsInCRI: 'Grounds Copilot action suggestions and protocol citations',
    limitation: 'Terrestrial & ISS operational analogs; recommendations are advisory, not diagnostic.',
  },
];

export function filterTrustEntries(entries: TrustEntry[], filterProvenance?: Provenance | 'ALL'): TrustEntry[] {
  if (!filterProvenance || filterProvenance === 'ALL') {
    return entries;
  }
  return entries.filter((entry) => entry.provenance === filterProvenance);
}
