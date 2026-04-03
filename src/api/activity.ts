import client from './client';

export interface ActivityStats {
  totalScreenTime: number;
  sessionCount: number;
  averageSessionDuration: number;
  dailyBreakdown: Array<{
    date: string;
    screenTime: number;
  }>;
}

export const startSession = async () => {
  const res = await client.post<{ sessionId: string }>('/api/activity/session-start');
  return res.data.sessionId;
};

export const endSession = async (sessionId: string) => {
  await client.post('/api/activity/session-end', { sessionId });
};

export const getActivityStats = async (period: 'today' | 'yesterday' | 'week' | 'month' | 'year') => {
  const res = await client.get<ActivityStats>(`/api/activity/stats?period=${period}`);
  return res.data;
};
