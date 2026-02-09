/**
 * Outfits history API — GET /api/outfits?limit=50
 * Auth token is attached by client interceptor.
 */
import client from './client';

export interface OutfitHistoryItem {
  id: string;
  occasion?: string;
  context?: unknown;
  engine?: string;
  pythonUsed?: boolean;
  pythonError?: string | null;
  items?: unknown[];
  lockedItemIds?: string[];
  reasons?: string[];
  tags?: string[];
  createdAt?: string;
}

export interface OutfitsResponse {
  outfits: OutfitHistoryItem[];
}

const OUTFITS_PATH = '/api/outfits';

export async function getOutfits(limit: number = 50): Promise<OutfitsResponse> {
  if (__DEV__) {
    console.log('[Outfits API] GET outfits', { limit });
  }
  const res = await client.get<OutfitsResponse>(OUTFITS_PATH, {
    params: { limit },
  });
  return res.data;
}
