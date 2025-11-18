import topOutfits from "../data/topOutfits";
import { Garment, OutfitSuggestion, OutfitTemplate } from "../types";
import { ENABLE_AI, AI_BASE_URL } from "../config";
import client from "../api/client";
import { getCurrentLocation, getWeatherData } from "./weather";
import { useSettings } from "../store/settings";

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
 * Call the backend AI agent endpoint to get outfit suggestions
 */
async function callAIBackendRecommend(
  userId: string,
  latitude: number,
  longitude: number,
  tempF: number,
  weatherSummary: string,
  topK: number
): Promise<OutfitSuggestion[] | null> {
  try {
    const payload = {
      user_id: userId,
      location: { latitude, longitude, name: "Current Location" },
      weather: { tempF, summary: weatherSummary, precipChance: 0 },
    };

    const response = await client.post(`${AI_BASE_URL}/agent/suggest_outfit`, payload);
    
    if (response.data && response.data.outfits && Array.isArray(response.data.outfits)) {
      // Map backend response to OutfitSuggestion format
      const suggestions: OutfitSuggestion[] = response.data.outfits.map((outfit: any, idx: number) => {
        const suggestion: any = {
          id: `ai-${idx}`,
          items: outfit.items || [],
          score: 0.9, // High score for AI suggestions
          context: "ai_generated",
        };
        // Store the "why" explanation from backend
        if (outfit.why) {
          suggestion.why = outfit.why;
        }
        return suggestion;
      });
      return suggestions.slice(0, topK);
    }
    return null;
  } catch (error) {
    console.warn("[Recommender] Backend AI call failed, falling back to rule-based:", error);
    return null;
  }
}

/**
 * Main recommendation function - calls AI backend when enabled, falls back to rule-based
 */
export async function recommend(
  closet: Garment[],
  context: OutfitTemplate["context"],
  userId?: string,
  topK = 5
): Promise<OutfitSuggestion[]> {
  // If AI is disabled, use local rule-based recommendation
  if (!ENABLE_AI) {
    return localRuleBasedRecommend(closet, context, topK);
  }

  // AI is enabled: try to call backend
  if (userId) {
    try {
      const settings = useSettings.getState();
      const location = await getCurrentLocation();
      const weatherResult = await getWeatherData(settings, false);
      
      if (location && weatherResult.weather) {
        const tempF = weatherResult.weather.temperature || 70;
        const summary = weatherResult.weather.condition || "Clear";
        
        const aiSuggestions = await callAIBackendRecommend(
          userId,
          location.latitude,
          location.longitude,
          tempF,
          summary,
          topK
        );
        
        if (aiSuggestions && aiSuggestions.length > 0) {
          console.log("[Recommender] Using AI backend suggestions:", aiSuggestions.length);
          return aiSuggestions;
        }
      }
    } catch (error) {
      console.warn("[Recommender] Error calling AI backend:", error);
    }
  }

  // Fallback to rule-based if AI failed or no user ID
  console.log("[Recommender] Falling back to rule-based recommendation");
  return localRuleBasedRecommend(closet, context, topK);
}