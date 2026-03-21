/**
 * Planner API — GET range, POST upsert, PATCH by date.
 * Auth token is attached by client interceptor.
 */
import client from './client';

export type PlannerSlotLabel = 'morning' | 'afternoon' | 'evening' | 'custom';
export type PlannerStatus = 'planned' | 'worn' | 'skipped';

export interface PlannerPlan {
  slotLabel: PlannerSlotLabel;
  occasion: string;
  outfitId: string;
  status: PlannerStatus;
  notes?: string;
}

export interface PlannerEntry {
  date: string;
  plans: PlannerPlan[];
}

export interface PlannerRangeResponse {
  entries: PlannerEntry[];
}

const PLANNER_PATH = '/api/planner';

export async function getPlannerRange(from: string, to: string): Promise<PlannerRangeResponse> {
  if (__DEV__) {
    console.log('[Planner API] GET range', { from, to });
  }
  const res = await client.get<PlannerRangeResponse>(PLANNER_PATH, {
    params: { from, to },
  });
  return res.data;
}

export async function postPlanner(date: string, plans: PlannerPlan[]): Promise<{ entry: PlannerEntry }> {
  if (__DEV__) {
    console.log('[Planner API] POST date', date);
  }
  const res = await client.post<{ entry: PlannerEntry }>(PLANNER_PATH, { date, plans });
  return res.data;
}

export async function patchPlanner(date: string, plans: PlannerPlan[]): Promise<{ entry: PlannerEntry }> {
  if (__DEV__) {
    console.log('[Planner API] PATCH date', date);
  }
  const res = await client.patch<{ entry: PlannerEntry }>(`${PLANNER_PATH}/${date}`, { plans });
  return res.data;
}
