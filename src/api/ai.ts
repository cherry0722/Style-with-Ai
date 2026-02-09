/**
 * AI API — reasoned outfits (Node /api/ai/reasoned_outfits).
 * Uses the main api client so JWT is attached automatically.
 */
import client from './client';

export interface ReasonedOutfitsRequest {
  occasion?: string;
  context?: {
    location?: { latitude?: number; longitude?: number; lat?: number; lon?: number; lng?: number; city?: string; region?: string };
    weather?: { tempF?: number; condition?: string };
  };
  lockedItemIds?: string[];
}

export interface WardrobeItemInOutfit {
  id?: string;
  _id?: string;
  userId?: string;
  imageUrl: string;
  cleanImageUrl?: string | null;
  profile?: Record<string, unknown> | null;
  category?: string | null;
  type?: string | null;
  primaryColor?: string | null;
}

export interface ReasonedOutfitEntry {
  outfitId?: string;
  items: WardrobeItemInOutfit[];
  reasons?: string[];
  score?: number;
  missing?: string[];
}

export interface ReasonedOutfitsResponse {
  message?: string;
  outfits: ReasonedOutfitEntry[];
  contextUsed?: {
    occasion?: string;
    weatherUsed?: boolean;
    tempF?: number | null;
    locationUsed?: boolean;
  };
  engine: 'python' | 'node_fallback' | 'fallback';
  pythonUsed: boolean;
  pythonError: string | null;
}

const REASONED_OUTFITS_PATH = '/api/ai/reasoned_outfits';

/** POST /api/ai/reasoned_outfits — JWT required. Uses API_BASE_URL (Node); Node fallback when Python down. */
export async function getReasonedOutfits(
  body: ReasonedOutfitsRequest
): Promise<ReasonedOutfitsResponse> {
  if (__DEV__) console.log('[AI API] POST', REASONED_OUTFITS_PATH);
  const res = await client.post<ReasonedOutfitsResponse>(REASONED_OUTFITS_PATH, body);
  return res.data;
}
