import topOutfits from "../data/topOutfits";
import { Garment, OutfitSuggestion, OutfitTemplate } from "../types";

function colorAffinity(needed: OutfitTemplate["preferredColors"], cat: string, garment: Garment) {
  if (!needed) return 0.2; // base score if no prefs
  const prefs = needed[cat as keyof NonNullable<typeof needed>];
  if (!prefs || prefs.length === 0) return 0.2;
  const matches = garment.colors.filter((c) => (prefs as any)?.includes(c)).length;
  return matches > 0 ? 0.6 : 0.1; // crude scoring
}

export function recommend(closet: Garment[], context: OutfitTemplate["context"], topK = 5): OutfitSuggestion[] {
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