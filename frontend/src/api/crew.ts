import { z } from 'zod';
import { getMockCriValues, getMockDailyRows } from '../data/mockDaily';
import type { AstronautSnapshot } from '../types/astronaut';
import { CREW_MEMBERS } from '../data/crew';
import { apiClient } from './client';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DAILY_MODE = import.meta.env.VITE_MOCK_DAILY_MODE === 'full' ? 'full' : 'cri-only';

const snapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  day: z.number(),
  sleep: z.number(),
  cardio: z.number(),
  radiation: z.number(),
  exercise: z.number(),
  mood: z.number(),
  cri: z.number(),
  status: z.enum(['act_now', 'watch', 'stable', 'optimal']),
});

const getMockSnapshot = (id: string): AstronautSnapshot => {
  const member = CREW_MEMBERS.find((candidate) => candidate.id === id) ?? CREW_MEMBERS[0];
  const rows = getMockDailyRows(id);
  const last = rows[rows.length - 1];
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    day: last?.day ?? 144,
    sleep: last?.sleep ?? 70,
    cardio: last?.cardio ?? 70,
    radiation: last?.radiation ?? 55,
    exercise: last?.exercise ?? 70,
    mood: last?.mood ?? 70,
    cri: member.id === 'C002' ? 61 : member.cri,
    status: member.id === 'C002' ? 'watch' : member.status === 'act_now' ? 'act_now' : member.status === 'optimal' ? 'optimal' : 'stable',
  };
};

export async function getCrew(id: string): Promise<AstronautSnapshot> {
  if (USE_MOCK) return getMockSnapshot(id);
  return apiClient(`/crew/${id}`, snapshotSchema);
}

export async function getTrend(id: string): Promise<unknown> {
  if (USE_MOCK) {
    return MOCK_DAILY_MODE === 'full' ? getMockDailyRows(id) : getMockCriValues(id);
  }
  return apiClient(`/crew/${id}/trend`, z.unknown());
}
