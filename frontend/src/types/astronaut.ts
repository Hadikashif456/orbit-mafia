import type { CrewStatus } from './crew';

export interface AstronautSnapshot {
  id: string;
  name: string;
  role: string;
  day: number;
  sleep: number;
  cardio: number;
  radiation: number;
  exercise: number;
  mood: number;
  cri: number;
  status: CrewStatus;
}

export interface DailyRow {
  day: number;
  crew_id: string;
  sleep: number;
  cardio: number;
  radiation: number;
  exercise: number;
  mood: number;
  cri: number;
  band: string;
}

export type DetailBand = 'Green' | 'Amber' | 'Red';

export interface DetailSnapshot {
  id: string;
  name: string;
  role: string;
  cri: number;
  band: DetailBand;
  sleep: number;
  cardio: number;
  radiation: number;
  exercise: number;
  mood: number;
  trend: readonly number[];
  data_label: string;
}
