/**
 * Avatar mapping API — feature/avatar-asset-hookup-v1
 *
 * Calls Python /avatar-mapping for a single wardrobe item and returns the
 * structured AvatarMappingResult used by the avatar renderer.
 *
 * Uses aiClient (Python backend, AI_BASE_URL) — /avatar-mapping requires no JWT.
 */
import aiClient from './aiClient';
import type { AvatarMappingResult } from '../avatar/avatarClothingConfig';
import type { WardrobeItemInOutfit } from './ai';

/**
 * Calls POST /avatar-mapping with the item's available visual attributes.
 * Returns null if the item has insufficient data (no category/type) or the
 * call fails for any reason — callers should apply a safe fallback.
 *
 * Field priority mirrors backend resolution order:
 *   primaryColor  (Vision/ItemProfile field)
 *   profile.primaryColor
 *   profile.color  (Node wardrobe flat field)
 */
export async function fetchAvatarMapping(
  item: WardrobeItemInOutfit,
): Promise<AvatarMappingResult | null> {
  // Need at least a category or type to produce a meaningful mapping.
  const profile = item.profile as Record<string, unknown> | null | undefined;
  const category = item.category ?? (profile?.['category'] as string | undefined);
  const type_ = item.type ?? (profile?.['type'] as string | undefined);

  if (!category && !type_) {
    if (__DEV__) {
      console.log('[Avatar API] Skipping item — no category or type', item);
    }
    return null;
  }

  try {
    const body: Record<string, unknown> = {};
    if (category)          body.category     = category;
    if (type_)             body.type         = type_;
    if (item.primaryColor) body.primaryColor = item.primaryColor;
    // Pass full profile so backend can extract material, fit, pattern, etc.
    if (item.profile)      body.profile      = item.profile;

    const res = await aiClient.post<AvatarMappingResult>('/avatar-mapping', body);
    return res.data;
  } catch (err) {
    if (__DEV__) {
      console.warn('[Avatar API] fetchAvatarMapping failed:', err);
    }
    return null;
  }
}

/**
 * Resolves avatar mapping for all top and bottom items in an outfit.
 * Fires both requests in parallel. Returns only successful results.
 * Items that fail or have no category/type are silently skipped.
 */
export async function fetchOutfitAvatarMappings(
  items: WardrobeItemInOutfit[],
): Promise<AvatarMappingResult[]> {
  // Filter to items that have at minimum a category hint.
  const relevant = items.filter(it => {
    const profile = it.profile as Record<string, unknown> | null | undefined;
    const cat = it.category ?? profile?.['category'];
    const typ = it.type ?? profile?.['type'];
    return cat || typ;
  });

  const results = await Promise.all(relevant.map(it => fetchAvatarMapping(it)));
  return results.filter((r): r is AvatarMappingResult => r !== null);
}
