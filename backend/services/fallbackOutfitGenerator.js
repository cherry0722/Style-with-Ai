/**
 * Phase 2: Node fallback outfit generator — scored selection.
 *
 * Uses ONLY available wardrobe items (v2.availability.status !== 'unavailable').
 * Returns up to 3 outfits; supports lockedItemIds (preserve those, fill rest).
 *
 * Phase 2 upgrade:
 *   - Generates bounded candidate combos (capped at MAX_CANDIDATES)
 *   - Scores each via scoreOutfitCombo (formality, weather, color, confidence)
 *   - Adds isFavorite bonus
 *   - Selects top 3 diverse outfits (penalizes repeat top/bottom usage)
 *   - regenerate/swap now pick best-scored replacement instead of first-fit
 *
 * Deterministic, no LLM.
 */
const { randomUUID } = require('crypto');
const { scoreOutfitCombo } = require('./reasoning/scoreOutfit');

/** Safety cap — never score more than this many combos per request. */
const MAX_CANDIDATES = 200;

/** Bonus points per isFavorite item in a combo. */
const FAVORITE_BONUS = 3;

/** Diversity penalty when a top or bottom is reused across selected outfits. */
const DIVERSITY_PENALTY = 15;

const CATEGORIES = ['top', 'bottom', 'shoes', 'outerwear', 'accessories'];
const NORMALIZE_MAP = {
  top: ['top', 'tops', 'shirt', 'tee', 'blouse', 'sweater', 'hoodie', 'polo'],
  bottom: ['bottom', 'bottoms', 'pants', 'jeans', 'chinos', 'shorts', 'skirt'],
  shoes: ['shoes', 'shoe', 'sneaker', 'boot', 'loafer', 'heel', 'sandal'],
  dress: ['dress'],
  outerwear: ['outerwear', 'jacket', 'coat', 'blazer', 'cardigan', 'overcoat'],
  accessories: ['accessory', 'accessories'],
};

function normalizeCategory(item) {
  const p = item.profile || item;
  const c = (p.category || p.type || '').toLowerCase();
  const t = (p.type || '').toLowerCase();
  for (const [cat, keywords] of Object.entries(NORMALIZE_MAP)) {
    if (keywords.some((k) => c.includes(k) || t.includes(k))) return cat;
  }
  if (c === 'dress' || t.includes('dress')) return 'dress';
  return 'other';
}

function filterAvailable(items) {
  return items.filter((i) => {
    const v2 = i.v2 || {};
    const status = (v2.availability && v2.availability.status) || 'available';
    return status !== 'unavailable';
  });
}

function groupByCategory(items) {
  const byCat = { top: [], bottom: [], shoes: [], dress: [], outerwear: [], accessories: [], other: [] };
  for (const item of items) {
    const cat = normalizeCategory(item);
    if (byCat[cat]) byCat[cat].push(item);
    else byCat.other.push(item);
  }
  return byCat;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Count favorite items in a combo.
 */
function countFavorites(combo) {
  let n = 0;
  for (const item of combo) {
    if (item.isFavorite) n++;
  }
  return n;
}

/**
 * Score a combo using the existing scoreOutfitCombo engine + favorites boost.
 * @param {Object[]} combo - array of wardrobe items
 * @param {Object} context - { occasion?, weather? }
 * @returns {{ score: number, reasons: string[], missing: string[] }}
 */
function scoreCandidateCombo(combo, context) {
  const result = scoreOutfitCombo(combo, context);
  const favCount = countFavorites(combo);
  if (favCount > 0) {
    result.score += favCount * FAVORITE_BONUS;
    result.reasons.push(`Includes ${favCount} favorite${favCount > 1 ? 's' : ''} (+${favCount * FAVORITE_BONUS})`);
  }
  return result;
}

/**
 * Build a signature string from item IDs (sorted) for dedup.
 */
function comboSignature(combo) {
  return combo.map((i) => String(i._id)).sort().join('-');
}

// ── Candidate generation (bounded) ───────────────────────────────────────────

/**
 * Generate candidate outfit combos from categorized items.
 * Stops once MAX_CANDIDATES is reached to prevent explosion.
 *
 * Priority order:
 *   1. Full outfits: top + bottom + shoes (highest category score)
 *   2. Dress + shoes
 *   3. Top + bottom + shoes + outerwear
 *   4. Top + bottom (no shoes) — only if we haven't hit the cap
 *
 * Within each category list, favorites are sorted first.
 */
function generateBoundedCandidates(byCat, lockedItems) {
  const combos = [];
  const seen = new Set();
  const lockedIds = new Set(lockedItems.map((i) => String(i._id)));

  // Sort each category: favorites first for earlier exploration
  const sortFavFirst = (arr) => [...arr].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));

  const tops = sortFavFirst(byCat.top || []);
  const bottoms = sortFavFirst(byCat.bottom || []);
  const shoes = sortFavFirst(byCat.shoes || []);
  const dresses = sortFavFirst(byCat.dress || []);
  const outerwear = sortFavFirst(byCat.outerwear || []);

  function addCombo(parts) {
    if (combos.length >= MAX_CANDIDATES) return false;
    // Merge locked items into combo
    const ids = new Set(parts.map((i) => String(i._id)));
    const full = [...parts];
    for (const li of lockedItems) {
      if (!ids.has(String(li._id))) {
        full.push(li);
        ids.add(String(li._id));
      }
    }
    const sig = comboSignature(full);
    if (seen.has(sig)) return true; // skip dupe but continue
    seen.add(sig);
    combos.push(full);
    return combos.length < MAX_CANDIDATES;
  }

  // 1) Full outfits: top + bottom + shoes
  outer1:
  for (const t of tops) {
    for (const b of bottoms) {
      for (const s of shoes) {
        if (!addCombo([t, b, s])) break outer1;
      }
    }
  }

  // 2) Dress + shoes
  outer2:
  for (const d of dresses) {
    for (const s of shoes) {
      if (!addCombo([d, s])) break outer2;
    }
  }

  // 3) Top + bottom + shoes + outerwear
  if (outerwear.length > 0 && combos.length < MAX_CANDIDATES) {
    outer3:
    for (const t of tops.slice(0, 3)) {
      for (const b of bottoms.slice(0, 3)) {
        for (const s of shoes.slice(0, 2)) {
          for (const o of outerwear) {
            if (!addCombo([t, b, s, o])) break outer3;
          }
        }
      }
    }
  }

  // 4) Top + bottom (no shoes) — partial, lower priority
  if (combos.length < MAX_CANDIDATES) {
    outer4:
    for (const t of tops.slice(0, 4)) {
      for (const b of bottoms.slice(0, 4)) {
        if (!addCombo([t, b])) break outer4;
      }
    }
  }

  return combos;
}

// ── Diverse selection ────────────────────────────────────────────────────────

/**
 * Greedy selection of top N diverse outfits from scored candidates.
 * After picking the best, penalize subsequent candidates that reuse the same
 * top or bottom item to encourage variety.
 */
function selectDiverse(scoredCandidates, n) {
  if (scoredCandidates.length <= n) return scoredCandidates;

  // Work on copies so we don't mutate original scores
  const pool = scoredCandidates.map((c) => ({ ...c, adjustedScore: c.score }));
  const selected = [];
  const usedItemIds = new Set();

  for (let pick = 0; pick < n && pool.length > 0; pick++) {
    // Sort by adjusted score descending
    pool.sort((a, b) => b.adjustedScore - a.adjustedScore);
    const best = pool.shift();
    selected.push(best);

    // Track top/bottom IDs used for diversity
    for (const item of best.items) {
      const cat = normalizeCategory(item);
      if (cat === 'top' || cat === 'bottom') {
        usedItemIds.add(String(item._id));
      }
    }

    // Penalize remaining candidates that reuse these items
    for (const c of pool) {
      let penalty = 0;
      for (const item of c.items) {
        if (usedItemIds.has(String(item._id))) {
          penalty += DIVERSITY_PENALTY;
        }
      }
      c.adjustedScore = c.score - penalty;
    }
  }

  return selected;
}

// ── Main generation ──────────────────────────────────────────────────────────

/**
 * Generate up to 3 scored, diverse outfits from available items.
 *
 * @param {Object[]} availableItems - lean wardrobe docs (with _id, profile, v2, isFavorite)
 * @param {string[]} [lockedItemIds] - item IDs that must appear in each outfit
 * @param {Object} [context] - { occasion?, weather?: { tempF?, condition? } }
 * @returns {{ outfitId: string, items: Object[], lockedItemIds: string[], reasons: string[], score: number }[]}
 */
function generateThreeOutfits(availableItems, lockedItemIds = [], context = {}) {
  const locked = Array.isArray(lockedItemIds) ? lockedItemIds.map(String) : [];
  const idToItem = new Map(availableItems.map((i) => [String(i._id), i]));
  const lockedItems = locked.map((id) => idToItem.get(id)).filter(Boolean);

  // Exclude locked items from free pools
  const lockedIdSet = new Set(locked);
  const freeItems = availableItems.filter((i) => !lockedIdSet.has(String(i._id)));
  const byCat = groupByCategory(freeItems);

  // Generate bounded candidates
  const candidates = generateBoundedCandidates(byCat, lockedItems);

  if (candidates.length === 0) {
    // Absolute fallback: return whatever single items we have
    const singles = availableItems.slice(0, 3).map((item) => ({
      outfitId: randomUUID(),
      items: [item],
      lockedItemIds: locked,
      reasons: ['Only individual items available.'],
      score: 1,
    }));
    return singles;
  }

  // Score all candidates
  const scored = candidates.map((combo) => {
    const { score, reasons, missing } = scoreCandidateCombo(combo, context);
    const entry = {
      outfitId: randomUUID(),
      items: combo,
      lockedItemIds: locked,
      reasons,
      score,
    };
    if (missing && missing.length > 0) entry.missing = missing;
    return entry;
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Select top 3 with diversity
  return selectDiverse(scored, 3);
}

// ── Regenerate (scored) ──────────────────────────────────────────────────────

/**
 * Regenerate: replace unlocked categories with the best-scored alternatives.
 *
 * @param {Object[]} availableItems
 * @param {string[]} lockedItemIds - items to keep
 * @param {Object[]} currentItems - current outfit items
 * @param {Object} [context] - { occasion?, weather? }
 */
function regenerateOutfit(availableItems, lockedItemIds, currentItems, context = {}) {
  const locked = Array.isArray(lockedItemIds) ? lockedItemIds.map(String) : [];
  const byCat = groupByCategory(availableItems);
  const idToItem = new Map(availableItems.map((i) => [String(i._id), i]));
  const lockedSet = new Set(locked);
  const currentIds = new Set((currentItems || []).map((i) => String(i._id != null ? i._id : i.id)));

  const unlocked = (currentItems || []).filter((i) => !lockedSet.has(String(i._id != null ? i._id : i.id)));
  const categoriesToReplace = new Set(unlocked.map((i) => normalizeCategory(i)));

  // Collect locked items
  const keptItems = [];
  for (const id of locked) {
    const item = idToItem.get(id);
    if (item) keptItems.push(item);
  }

  // For each category to replace, gather candidate replacements (excluding current + kept)
  const keptIds = new Set(keptItems.map((i) => String(i._id)));
  const replacementCandidates = {};
  for (const cat of ['top', 'bottom', 'shoes', 'outerwear']) {
    if (!categoriesToReplace.has(cat)) continue;
    const list = byCat[cat] || [];
    replacementCandidates[cat] = list.filter((i) =>
      !keptIds.has(String(i._id)) && !currentIds.has(String(i._id))
    );
  }

  // Build all possible replacement combos (bounded: max 2 items per category → small cross product)
  const catsToFill = Object.keys(replacementCandidates).filter((c) => replacementCandidates[c].length > 0);
  let combos = [keptItems.slice()];

  for (const cat of catsToFill) {
    const options = replacementCandidates[cat].slice(0, 4); // cap per category
    const next = [];
    for (const base of combos) {
      for (const opt of options) {
        next.push([...base, opt]);
        if (next.length >= MAX_CANDIDATES) break;
      }
      if (next.length >= MAX_CANDIDATES) break;
    }
    combos = next;
  }

  // Score and pick best
  let bestCombo = keptItems;
  let bestScore = -Infinity;
  for (const combo of combos) {
    const { score } = scoreCandidateCombo(combo, context);
    if (score > bestScore) {
      bestScore = score;
      bestCombo = combo;
    }
  }

  const changedItemIds = bestCombo
    .map((i) => String(i._id))
    .filter((id) => !currentIds.has(id));

  return { items: bestCombo, lockedItemIds: locked, changedItemIds };
}

// ── Swap (scored) ────────────────────────────────────────────────────────────

/**
 * Swap: replace only the requested category with the best-scored alternative.
 *
 * @param {Object[]} availableItems
 * @param {Object[]} currentItems - current outfit items
 * @param {string} category - category to swap
 * @param {Object} [context] - { occasion?, weather? }
 */
function swapCategory(availableItems, currentItems, category, context = {}) {
  const byCat = groupByCategory(availableItems);
  const currentIds = new Set((currentItems || []).map((i) => String(i._id != null ? i._id : i.id)));
  const cat = String(category || '').toLowerCase();
  if (!CATEGORIES.includes(cat) && cat !== 'dress') {
    return { items: currentItems, changedItemIds: [] };
  }

  const list = byCat[cat] || byCat.other || [];
  const other = (currentItems || []).filter((i) => normalizeCategory(i) !== cat);
  const candidates = list.filter((i) => !currentIds.has(String(i._id)));

  if (candidates.length === 0) {
    return { items: currentItems, changedItemIds: [] };
  }

  // Score each candidate by building the full combo and scoring
  let bestPick = candidates[0];
  let bestScore = -Infinity;
  for (const c of candidates.slice(0, 10)) { // cap to avoid large loops
    const combo = [...other, c];
    const { score } = scoreCandidateCombo(combo, context);
    if (score > bestScore) {
      bestScore = score;
      bestPick = c;
    }
  }

  const newItems = [...other, bestPick];
  return { items: newItems, changedItemIds: [String(bestPick._id)] };
}

module.exports = {
  filterAvailable,
  generateThreeOutfits,
  regenerateOutfit,
  swapCategory,
  normalizeCategory,
  groupByCategory,
};
