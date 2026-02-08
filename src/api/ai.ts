/**
 * AI API — reasoned outfits (Node /api/ai/reasoned_outfits).
 * Uses the main api client so JWT is attached automatically.
 */
import client from './client';

export interface ReasonedOutfitsRequest {
  occasion?: string;
  location?: { latitude?: number; longitude?: number; lat?: number; lon?: number; lng?: number; city?: string; region?: string };
  weather?: { tempF?: number; condition?: string };
}

export interface WardrobeItemInOutfit {
  _id: string;
  userId?: string;
  imageUrl: string;
  cleanImageUrl?: string | null;
  profile?: Record<string, unknown> | null;
  category?: string | null;
  type?: string | null;
  primaryColor?: string | null;
}

export interface ReasonedOutfitEntry {
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
  engine: 'python' | 'fallback';
  pythonUsed: boolean;
  pythonError: string | null;
}

/** POST /api/ai/reasoned_outfits — JWT required. */
export async function getReasonedOutfits(
  body: ReasonedOutfitsRequest
): Promise<ReasonedOutfitsResponse> {
  const res = await client.post<ReasonedOutfitsResponse>('/api/ai/reasoned_outfits', body);
  return res.data;
}
