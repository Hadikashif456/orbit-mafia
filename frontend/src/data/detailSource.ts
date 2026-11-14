// The CSV import is the single source for Crew Board and detail telemetry.

import demoCsv from '../../../data/demo_month.csv?raw';
import type { CrewMember, CrewStatus } from '../types/crew';
import type { DailyRow, DetailBand, DetailSnapshot } from '../types/astronaut';

interface CrewMetadata {
  id: string;
  code: string;
  name: string;
  role: string;
}

const CREW_METADATA: readonly CrewMetadata[] = [
  { id: 'C001', code: 'CM-01', name: 'Dr. Kenji Mori', role: 'Medical Officer' },
  { id: 'C002', code: 'CM-02', name: 'Emily Carter', role: 'Mission Commander' },
  { id: 'C003', code: 'CM-03', name: 'Yuki Tanaka', role: 'Flight Engineer' },
  { id: 'C004', code: 'CM-04', name: 'Eman Fatima', role: 'Bioastronautics & Systems Lead' },
];

const SOURCE_IDS = ['astro-1', 'astro-2', 'astro-3', 'astro-4'] as const;
const sourceIdFor = (id: string): string => {
  const index = Number(id.slice(-1)) - 1;
  return SOURCE_IDS[index] ?? id;
};

const parseRows = (csv: string): DailyRow[] => {
  const lines = csv.trim().split(/\r?\n/);
  const headers = lines[0]?.split(',') ?? [];
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    return {
      day: Number(row.day),
      crew_id: row.crew_id,
      sleep: Number(row.sleep),
      cardio: Number(row.cardio),
      radiation: Number(row.radiation),
      exercise: Number(row.exercise),
      mood: Number(row.mood),
      cri: Number(row.cri),
      band: row.band,
    };
  });
};

const DAILY_ROWS = parseRows(demoCsv);

const bandToStatus = (band: DetailBand): CrewStatus =>
  band === 'Red' ? 'act_now' : band === 'Amber' ? 'watch' : 'optimal';

const rowsFor = (id: string): DailyRow[] =>
  DAILY_ROWS.filter((row) => row.crew_id === sourceIdFor(id));

export const getDailyRows = (id: string, range: 'sol7' | 'sol30'): DailyRow[] => {
  const rows = rowsFor(id);
  return range === 'sol7' ? rows.slice(-7) : rows;
};

export const getAstronautSnapshot = (id: string): DetailSnapshot | null => {
  const metadata = CREW_METADATA.find((member) => member.id === id || sourceIdFor(member.id) === id);
  const rows = rowsFor(id);
  const last = rows[rows.length - 1];
  if (!metadata || !last) return null;

  return {
    id: metadata.id,
    name: metadata.name,
    role: metadata.role,
    cri: last.cri,
    band: last.band as DetailBand,
    sleep: last.sleep,
    cardio: last.cardio,
    radiation: last.radiation,
    exercise: last.exercise,
    mood: last.mood,
    trend: rows.slice(-6).map((row) => row.cri),
    data_label: 'Synthetic demo data',
  };
};

export const getCrewMembers = (): readonly CrewMember[] =>
  CREW_METADATA.map((metadata) => {
    const rows = rowsFor(metadata.id);
    const latest = rows[rows.length - 1];
    const previous = rows[rows.length - 2] ?? latest;
    const band = (latest?.band ?? 'Green') as DetailBand;
    return {
      ...metadata,
      cri: latest?.cri ?? 0,
      previousCri: previous?.cri ?? latest?.cri ?? 0,
      status: bandToStatus(band),
    };
  });
