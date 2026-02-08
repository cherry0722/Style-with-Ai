/**
 * Phase 3A: Explainable outfit reasoning engine.
 * Works ONLY on stored wardrobe profiles. No image processing.
 * Deterministic, testable scoring.
 * Phase 3A.1: Supports partial outfits with missing[] and next-step reasons.
 * Phase 3B: Uses occasionRules for normalized occasion + formality scoring.
 *
 * @param {Object} input
 * @param {Object[]} input.items - WardrobeItem[] (Mongo docs with profile)
 * @param {Object} [input.context]
 * @param {string} [input.context.occasion] - e.g. "college", "office", "casual"
 * @param {Object} [input.context.weather]
 * @param {number} [input.context.weather.tempF]
 * @param {string} [input.context.weather.condition]
 * @param {Object} [input.context.location]
 * @param {string} [input.context.location.city]
 * @param {string} [input.context.location.region]
 * @returns {{ outfits: Array<{ items: Object[], score: number, reasons: string[], missing?: string[] }> }}
 */
const { normalizeOccasion, getOccasionRule } = require('./occasionRules');

function scoreOutfit(input) {
  const { items = [], context = {} } = input;

  if (!Array.isArray(items) || items.length === 0) {
    return { outfits: [] };
  }

  const combinations = generateOutfitCombinations(items);
  const scored = combinations.map((combo) => {
    const { score, reasons, missing } = scoreOutfitCombo(combo, context);
    const entry = { items: combo, score, reasons };
    if (missing && missing.length > 0) entry.missing = missing;
    return entry;
  });

  // Sort by score descending, return all (caller can slice top N)
  scored.sort((a, b) => b.score - a.score);
  return { outfits: scored };
}

/**
 * Generate valid outfit combinations.
 * Complete: top+bottom+shoes, dress+shoes, dress+outerwear+shoes.
 * Partial: top+bottom, top+shoes, bottom+shoes, single items.
 * Phase 3A.1: Always include partials so we can suggest even with 1 item.
 */
function generateOutfitCombinations(items) {
  const byCategory = categorizeItems(items);

  const tops = byCategory.top || [];
  const bottoms = byCategory.bottom || [];
  const shoes = byCategory.shoes || [];
  const dresses = byCategory.dress || [];
  const outerwear = byCategory.outerwear || [];

  const combos = [];

  // 1) Full outfits: top + bottom + shoes
  for (const t of tops) {
    for (const b of bottoms) {
      for (const s of shoes) {
        combos.push([t, b, s]);
      }
    }
  }

  // 2) Top + bottom (no shoes)
  for (const t of tops) {
    for (const b of bottoms) {
      combos.push([t, b]);
    }
  }

  // 3) Dress + shoes; dress alone
  for (const d of dresses) {
    for (const s of shoes) {
      combos.push([d, s]);
    }
    combos.push([d]);
  }

  // 4) Top + bottom + optional outerwear
  if (outerwear.length > 0) {
    for (const t of tops) {
      for (const b of bottoms) {
        for (const s of shoes) {
          for (const o of outerwear) {
            combos.push([t, b, s, o]);
          }
        }
      }
    }
  }

  // 5) Phase 3A.1: Partial pairs (top+shoes, bottom+shoes)
  for (const t of tops) {
    for (const s of shoes) {
      combos.push([t, s]);
    }
  }
  for (const b of bottoms) {
    for (const s of shoes) {
      combos.push([b, s]);
    }
  }

  // 6) Phase 3A.1: Single items (so we always have suggestions even with 1 item)
  for (const t of tops) combos.push([t]);
  for (const b of bottoms) combos.push([b]);
  for (const s of shoes) combos.push([s]);
  for (const d of dresses) combos.push([d]);
  for (const o of outerwear) combos.push([o]);

  return combos;
}

function categorizeItems(items) {
  const map = { top: [], bottom: [], shoes: [], dress: [], outerwear: [], accessory: [], other: [] };
  for (const item of items) {
    const cat = normalizeCategory(item);
    if (map[cat]) map[cat].push(item);
    else map.other.push(item);
  }
  return map;
}

function normalizeCategory(item) {
  const p = item.profile || item;
  const c = (p.category || p.type || "").toLowerCase();
  const t = (p.type || "").toLowerCase();
  const s = `${c} ${t}`;
  if (["top", "tops"].includes(c) || /shirt|tee|blouse|sweater|hoodie|polo/.test(t)) return "top";
  if (["bottom", "bottoms"].includes(c) || /pants|jeans|chinos|shorts|skirt/.test(t)) return "bottom";
  if (["shoes", "shoe"].includes(c) || /sneaker|boot|loafer|heel|sandal/.test(t)) return "shoes";
  if (["dress"].includes(c) || /dress/.test(t)) return "dress";
  if (["outerwear"].includes(c) || /jacket|coat|blazer|cardigan|overcoat/.test(t)) return "outerwear";
  if (["accessory"].includes(c)) return "accessory";
  return "other";
}

function scoreOutfitCombo(combo, context) {
  const reasons = [];
  let score = 0;

  const hasTop = combo.some((i) => normalizeCategory(i) === "top");
  const hasBottom = combo.some((i) => normalizeCategory(i) === "bottom");
  const hasShoes = combo.some((i) => normalizeCategory(i) === "shoes");
  const hasDress = combo.some((i) => normalizeCategory(i) === "dress");

  // --- Compute missing categories (Phase 3A.1) ---
  const missing = [];
  if (hasDress) {
    if (!hasShoes) missing.push("shoes");
  } else {
    if (!hasTop) missing.push("top");
    if (!hasBottom) missing.push("bottom");
    if (!hasShoes) missing.push("shoes");
  }

  // --- 1) Category compatibility (top + bottom + shoes preferred) ---
  // Penalize missing categories but do NOT discard
  if (hasDress && hasShoes) {
    score += 30;
    reasons.push("Complete outfit: dress and shoes");
  } else if (hasDress && combo.length === 1) {
    score += 25;
    reasons.push("Dress outfit; add shoes to complete");
  } else if (hasTop && hasBottom && hasShoes) {
    score += 30;
    reasons.push("Complete outfit: top, bottom, and shoes");
  } else if (hasTop && hasBottom) {
    score += 18;
    reasons.push("Top and bottom paired; shoes missing");
  } else if (hasTop && hasShoes) {
    score += 12;
    reasons.push("Top and shoes paired; bottom missing");
  } else if (hasBottom && hasShoes) {
    score += 12;
    reasons.push("Bottom and shoes paired; top missing");
  } else if (hasTop || hasBottom || hasShoes || hasDress) {
    score += 8;
    reasons.push("Partial outfit; missing pieces");
  } else {
    score += 2;
    reasons.push("Minimal outfit combination");
  }

  // Penalty for missing categories (do not discard, just reduce score)
  const missingPenalty = Math.min(15, missing.length * 5);
  score -= missingPenalty;
  if (missing.length > 0) {
    reasons.push(`Missing ${missing.join(", ")} (${missingPenalty} pt penalty)`);
  }

  // --- 2) Formality vs occasion match (Phase 3B: uses occasionRules) ---
  const occasionInput = context.occasion;
  const avgFormality = getAvgFormality(combo);

  if (occasionInput != null && String(occasionInput).trim()) {
    const normalizedOccasion = normalizeOccasion(occasionInput);
    const rule = getOccasionRule(normalizedOccasion);
    const match = matchFormalityToRule(avgFormality, rule);
    score += match.points;
    reasons.push(match.reason);
  } else {
    reasons.push("No occasion specified; formality not penalized");
  }

  // --- 3) Season vs weather match ---
  const weather = context.weather || {};
  const tempF = weather.tempF;

  if (typeof tempF === "number") {
    const seasonMatch = matchSeasonToWeather(combo, tempF);
    score += seasonMatch.points;
    reasons.push(seasonMatch.reason);
  } else {
    reasons.push("No weather data; season match skipped");
  }

  // --- 4) Confidence bonus ---
  const confResult = getConfidenceBonus(combo);
  score += confResult.points;
  reasons.push(confResult.reason);

  // --- 5) Penalty for missing metadata ---
  const penaltyResult = getMissingDataPenalty(combo);
  score += penaltyResult.points;
  if (penaltyResult.reason) reasons.push(penaltyResult.reason);

  // --- 6) Color compatibility (neutral bonus) ---
  const colorResult = getColorBonus(combo);
  score += colorResult.points;
  if (colorResult.reason) reasons.push(colorResult.reason);

  // --- 7) Phase 3A.1: Always include a "next step" reason for partial outfits ---
  if (missing.length > 0) {
    reasons.push(getNextStepReason(missing));
  }

  // Clamp score: 0–100 for readability; floor 1 for non-empty outfits (Phase 3B.1 demo quality)
  const raw = Math.round(score);
  score = Math.min(100, Math.max(combo.length > 0 ? 1 : 0, raw));
  return { score, reasons, missing };
}

function getNextStepReason(missing) {
  const parts = [];
  if (missing.includes("top")) parts.push("a top");
  if (missing.includes("bottom")) parts.push("pants or jeans");
  if (missing.includes("shoes")) parts.push("sneakers or shoes");
  if (parts.length === 0) return null;
  return `Add ${parts.join(" and ")} to complete this look`;
}

function getAvgFormality(combo) {
  let sum = 0;
  let n = 0;
  for (const item of combo) {
    const p = item.profile || item;
    let f = p.formality;
    if (typeof f === "string") f = parseFloat(f);
    if (typeof f === "number" && !isNaN(f)) {
      sum += Math.max(0, Math.min(10, f));
      n++;
    }
  }
  return n > 0 ? sum / n : 5;
}

/**
 * Match formality to occasion rule (Phase 3B).
 * Uses formalityRange [min, max] from getOccasionRule.
 */
function matchFormalityToRule(avgFormality, rule) {
  const [minForm, maxForm] = rule.formalityRange;
  const label = rule.label;

  if (avgFormality >= minForm && avgFormality <= maxForm) {
    return { points: 15, reason: `Formality fits ${label} occasion` };
  }
  if (avgFormality < minForm) {
    return { points: -5, reason: `Outfit may be too casual for ${label}` };
  }
  return { points: -3, reason: `Outfit may be too formal for ${label}` };
}

function matchSeasonToWeather(combo, tempF) {
  const preferredSeasons = tempToSeasons(tempF);
  let matches = 0;
  let total = 0;

  for (const item of combo) {
    const p = item.profile || item;
    const season = (p.season || "all").toLowerCase();
    if (season === "all") {
      matches += 1;
      total += 1;
    } else {
      total += 1;
      if (preferredSeasons.includes(season)) matches += 1;
    }
  }

  if (total === 0) return { points: 0, reason: "No season data in items" };
  const ratio = matches / total;
  if (ratio >= 1) return { points: 12, reason: "Suitable for current weather" };
  if (ratio >= 0.5) return { points: 6, reason: "Partly suitable for current weather" };
  return { points: -5, reason: "May not suit current weather" };
}

function tempToSeasons(tempF) {
  if (tempF < 40) return ["winter", "fall"];
  if (tempF < 60) return ["fall", "spring"];
  if (tempF < 80) return ["spring", "summer"];
  return ["summer"];
}

function getConfidenceBonus(combo) {
  let sum = 0;
  let n = 0;
  for (const item of combo) {
    const p = item.profile || item;
    const c = p.confidence;
    if (typeof c === "number" && !isNaN(c)) {
      sum += Math.max(0, Math.min(100, c));
      n++;
    }
  }
  if (n === 0) return { points: 0, reason: "No confidence data in profile" };
  const avg = sum / n;
  const points = Math.round(avg / 10); // 0–10 bonus
  return { points, reason: `High profile confidence (avg ${Math.round(avg)}%)` };
}

function getMissingDataPenalty(combo) {
  let missing = 0;
  for (const item of combo) {
    const p = item.profile || item;
    if (!p || (!p.category && !p.type)) missing++;
    else if (p.formality == null && p.season == null && p.confidence == null) missing += 0.5;
  }
  const penalty = Math.min(10, Math.round(missing * 3));
  return {
    points: -penalty,
    reason: penalty > 0 ? `Some items have missing metadata (-${penalty})` : null,
  };
}

function getColorBonus(combo) {
  const neutrals = ["black", "white", "gray", "grey", "navy", "beige", "tan", "brown", "denim"];
  let neutralCount = 0;
  for (const item of combo) {
    const p = item.profile || item;
    const color = (p.primaryColor || p.primary_color || "").toLowerCase();
    if (neutrals.some((n) => color.includes(n))) neutralCount++;
  }
  if (neutralCount >= combo.length) {
    return { points: 5, reason: "Neutral colors pair easily" };
  }
  if (neutralCount >= 1) {
    return { points: 2, reason: "Some neutral colors for versatility" };
  }
  return { points: 0, reason: null };
}

module.exports = { scoreOutfit };
