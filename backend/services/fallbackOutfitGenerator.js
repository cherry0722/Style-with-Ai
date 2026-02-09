/**
 * Phase 1: Node fallback outfit generator. Deterministic, no LLM.
 * Uses ONLY available wardrobe items (v2.availability.status !== 'unavailable').
 * Returns 3 outfits; supports lockedItemIds (preserve those, fill rest).
 * regenerate: replace only unlocked categories.
 * swap: replace only the requested category.
 */
const { randomUUID } = require('crypto');

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
  const s = `${c} ${t}`;
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

/**
 * Generate 3 outfits from available items. If lockedItemIds provided, preserve those and fill rest.
 * @param {Object[]} availableItems - lean wardrobe docs (with _id, profile, v2)
 * @param {string[]} [lockedItemIds] - item IDs that must appear in each outfit (filled first)
 * @returns {{ outfitId: string, items: Object[], lockedItemIds: string[], reasons: string[] }[]}
 */
function generateThreeOutfits(availableItems, lockedItemIds = []) {
  const locked = Array.isArray(lockedItemIds) ? lockedItemIds.map(String) : [];
  const byCat = groupByCategory(availableItems);
  const idToItem = new Map(availableItems.map((i) => [String(i._id), i]));

  const lockedItems = locked.map((id) => idToItem.get(id)).filter(Boolean);
  const lockedByCat = groupByCategory(lockedItems);
  const remainingByCat = {};
  for (const cat of Object.keys(byCat)) {
    const ids = new Set(lockedItems.map((i) => String(i._id)));
    remainingByCat[cat] = (byCat[cat] || []).filter((i) => !ids.has(String(i._id)));
  }

  const outfits = [];
  const usedSignatures = new Set();

  function pickOne(cat, excludeIds = new Set()) {
    const list = remainingByCat[cat] || [];
    const available = list.filter((i) => !excludeIds.has(String(i._id)));
    if (available.length === 0) return null;
    return available[0];
  }

  function buildOutfit(seedTop, seedBottom, seedShoes, seedOuterwear = null) {
    const parts = [];
    const ids = new Set();

    if (seedTop) {
      parts.push(seedTop);
      ids.add(String(seedTop._id));
    }
    if (seedBottom) {
      parts.push(seedBottom);
      ids.add(String(seedBottom._id));
    }
    if (seedShoes) {
      parts.push(seedShoes);
      ids.add(String(seedShoes._id));
    }
    if (seedOuterwear) {
      parts.push(seedOuterwear);
      ids.add(String(seedOuterwear._id));
    }

    for (const li of lockedItems) {
      if (!ids.has(String(li._id))) {
        parts.push(li);
        ids.add(String(li._id));
      }
    }

    const sig = parts.map((i) => String(i._id)).sort().join('-');
    if (usedSignatures.has(sig)) return null;
    usedSignatures.add(sig);

    const reasons = ['Deterministic outfit from available items.'];
    if (locked.length) reasons.push('Locked items preserved.');
    return { items: parts, lockedItemIds: locked, reasons };
  }

  const tops = remainingByCat.top || [];
  const bottoms = remainingByCat.bottom || [];
  const shoes = remainingByCat.shoes || [];
  const dresses = remainingByCat.dress || [];
  const outerwear = remainingByCat.outerwear || [];

  let count = 0;

  for (const t of tops.slice(0, 3)) {
    for (const b of bottoms.slice(0, 3)) {
      for (const s of shoes.slice(0, 2)) {
        const o = buildOutfit(t, b, s);
        if (o && count < 3) {
          outfits.push({ outfitId: randomUUID(), ...o });
          count++;
          if (count >= 3) break;
        }
      }
      if (count >= 3) break;
    }
    if (count >= 3) break;
  }

  if (count < 3 && dresses.length && shoes.length) {
    for (const d of dresses.slice(0, 2)) {
      for (const s of shoes.slice(0, 2)) {
        const items = [d, s];
        const sig = items.map((i) => String(i._id)).sort().join('-');
        if (usedSignatures.has(sig)) continue;
        usedSignatures.add(sig);
        outfits.push({
          outfitId: randomUUID(),
          items,
          lockedItemIds: locked,
          reasons: ['Dress and shoes combination.', 'Deterministic outfit from available items.'],
        });
        count++;
        if (count >= 3) break;
      }
      if (count >= 3) break;
    }
  }

  while (outfits.length < 3) {
    const t = tops[outfits.length % Math.max(1, tops.length)];
    const b = bottoms[outfits.length % Math.max(1, bottoms.length)];
    const s = shoes[outfits.length % Math.max(1, shoes.length)];
    if (!t && !b && !s) break;
    const items = [t, b, s].filter(Boolean);
    if (items.length === 0) break;
    const sig = items.map((i) => String(i._id)).sort().join('-');
    if (usedSignatures.has(sig)) break;
    usedSignatures.add(sig);
    outfits.push({
      outfitId: randomUUID(),
      items,
      lockedItemIds: locked,
      reasons: ['Deterministic outfit from available items.'],
    });
  }

  return outfits.slice(0, 3);
}

/**
 * Regenerate: replace only unlocked categories for a given outfit.
 * @param {Object[]} availableItems
 * @param {string[]} lockedItemIds - items to keep
 * @param {Object[]} currentItems - current outfit items (to know structure)
 */
function regenerateOutfit(availableItems, lockedItemIds, currentItems) {
  const locked = Array.isArray(lockedItemIds) ? lockedItemIds.map(String) : [];
  const byCat = groupByCategory(availableItems);
  const idToItem = new Map(availableItems.map((i) => [String(i._id), i]));
  const lockedSet = new Set(locked);
  const currentIds = new Set((currentItems || []).map((i) => String(i._id != null ? i._id : i.id)));

  const unlocked = (currentItems || []).filter((i) => !lockedSet.has(String(i._id != null ? i._id : i.id)));
  const categoriesToReplace = new Set(unlocked.map((i) => normalizeCategory(i)));

  const newItems = [];
  for (const id of locked) {
    const item = idToItem.get(id);
    if (item) newItems.push(item);
  }

  for (const cat of ['top', 'bottom', 'shoes', 'outerwear']) {
    if (!categoriesToReplace.has(cat)) continue;
    const list = byCat[cat] || [];
    const existingIds = new Set(newItems.map((i) => String(i._id)));
    const pick = list.find((i) => !existingIds.has(String(i._id)));
    if (pick) newItems.push(pick);
  }

  const changedItemIds = newItems
    .map((i) => String(i._id))
    .filter((id) => !currentIds.has(id));
  return { items: newItems, lockedItemIds: locked, changedItemIds };
}

/**
 * Swap: replace only the requested category in the outfit.
 */
function swapCategory(availableItems, currentItems, category) {
  const byCat = groupByCategory(availableItems);
  const idToItem = new Map(availableItems.map((i) => [String(i._id), i]));
  const currentIds = new Set((currentItems || []).map((i) => String(i._id != null ? i._id : i.id)));
  const cat = String(category || '').toLowerCase();
  if (!CATEGORIES.includes(cat) && cat !== 'dress') {
    return { items: currentItems, changedItemIds: [] };
  }

  const list = byCat[cat] || byCat.other || [];
  const other = (currentItems || []).filter((i) => normalizeCategory(i) !== cat);
  const pick = list.find((i) => !currentIds.has(String(i._id)));
  const newItems = pick ? [...other, pick] : [...other];
  const changedItemIds = pick ? [String(pick._id)] : [];
  return { items: newItems, changedItemIds };
}

module.exports = {
  filterAvailable,
  generateThreeOutfits,
  regenerateOutfit,
  swapCategory,
  normalizeCategory,
  groupByCategory,
};
