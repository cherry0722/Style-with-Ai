import topOutfits from "../data/topOutfits";
import { Garment, OutfitSuggestion, OutfitTemplate } from "../types";
import { ENABLE_AI } from "../config";
import aiClient from "../api/aiClient";

function colorAffinity(needed: OutfitTemplate["preferredColors"], cat: string, garment: Garment) {
  if (!needed) return 0.2; // base score if no prefs
  const prefs = needed[cat as keyof NonNullable<typeof needed>];
  if (!prefs || prefs.length === 0) return 0.2;
  const matches = garment.colors.filter((c) => (prefs as any)?.includes(c)).length;
  return matches > 0 ? 0.6 : 0.1; // crude scoring
}

/**
 * Local rule-based recommendation (fallback when AI is disabled)
 */
function localRuleBasedRecommend(
  closet: Garment[],
  context: OutfitTemplate["context"],
  topK: number
): OutfitSuggestion[] {
  const templates = topOutfits.filter((t) => t.context === context);
  const out: OutfitSuggestion[] = [];

  for (const t of templates) {
    // Greedy fill by category
    const chosen: Garment[] = [];
    let score = 0;
    for (const cat of t.recipe) {
      const candidates = closet.filter((g) => g.category === cat);
      if (candidates.length === 0) {
        score -= 1; // missing piece
        continue;
      }
      // rank by color preference
      const ranked = candidates
        .map((g) => ({ g, s: colorAffinity(t.preferredColors, cat, g) }))
        .sort((a, b) => b.s - a.s);
      if (ranked[0]) {
        chosen.push(ranked[0].g);
        score += ranked[0].s;
      }
    }
    if (chosen.length > 0) {
      out.push({ id: `${t.id}-${out.length}`, items: chosen, score, context: t.context });
    }
  }

  return out
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Main recommendation function - uses local rule-based logic when AI is disabled
 */
export function recommend(closet: Garment[], context: OutfitTemplate["context"], topK = 5): OutfitSuggestion[] {
  // If AI is disabled, use local rule-based recommendation
  if (!ENABLE_AI) {
    return localRuleBasedRecommend(closet, context, topK);
  }
  
  // When AI is enabled, this function could call the Python backend
  // For now, fall back to local logic until AI integration is complete
  // TODO: Implement AI backend call when EXPO_PUBLIC_ENABLE_AI=true
  return localRuleBasedRecommend(closet, context, topK);
}

// ============================================================================
// Python AI Backend Integration (Phase 2.2)
// ============================================================================

export interface WeatherInput {
  summary?: string;
  tempF?: number;
  precipChance?: number;
}

export interface LocationInput {
  latitude: number;
  longitude: number;
  name?: string;
}

export interface SuggestOutfitRequest {
  user_id: string;
  location: LocationInput;
  weather: WeatherInput;
}

export interface OutfitItemDetail {
  id: string;
  imageUrl?: string | null;
  category?: string | null;
  color?: string | null;
  tags?: string[];
  seasonTags?: string[];
  occasionTags?: string[];
  isFavorite?: boolean;
}

export interface OutfitFromAI {
  items: string[];
  why: string;
  items_detail?: OutfitItemDetail[] | null;
}

export interface SuggestOutfitResponse {
  outfits: OutfitFromAI[];
  context: {
    location: any;
    weather: any;
  };
  used_memory: boolean;
}

/**
 * Call the Python AI backend to get an outfit suggestion for a given user.
 * This uses the /suggest_outfit endpoint on the AI_BASE_URL.
 */
export async function suggestOutfitForUser(
  userId: string,
  location: LocationInput,
  weather: WeatherInput
): Promise<SuggestOutfitResponse> {
  if (!ENABLE_AI) {
    console.warn('[Recommender] ENABLE_AI is false. Returning fallback stub.');
    return {
      outfits: [],
      context: { reason: 'AI disabled via config' },
      used_memory: false,
    };
  }

  const payload: SuggestOutfitRequest = {
    user_id: userId,
    location,
    weather,
  };

  console.log('[Recommender] Calling /suggest_outfit with payload:', payload);

  const res = await aiClient.post<SuggestOutfitResponse>('/suggest_outfit', payload);
  return res.data;
}