/**
 * avatarClothingConfig — feature/avatar-asset-hookup-v1
 *
 * Translates backend /avatar-mapping output into a runtime avatar render config
 * that drives combined-avatar GLB selection.
 *
 * What this file owns:
 *   AvatarMappingResult     — mirror of backend AvatarMappingResult schema
 *   AvatarRenderConfig      — shape consumed by the avatar renderer
 *   buildSlotConfig()       — converts one backend result → ClothingSlotConfig
 *   buildRenderConfig()     — converts a list of results → AvatarRenderConfig
 *   resolveCombinedAvatar() — checks if outfit matches a combined dressed GLB
 *
 * MVP rendering path:
 *   Combined dressed avatar GLBs contain body + clothing in one file.
 *   When the generated outfit matches a known combination, the combined GLB is
 *   rendered instead of the base naked avatar.  No separate clothing overlay
 *   rendering is used in this milestone.
 *
 * Deferred to later milestones:
 *   - Separate per-garment overlay rendering
 *   - Front/back texture projection
 *   - Full PBR material baking
 *   - Fit mesh deformation
 *   - Shoes, accessories, outerwear
 */

// ── Backend schema mirror ──────────────────────────────────────────────────────
// Keep in sync with backend/schemas/models.py: AvatarMappingResult.

export interface AvatarPalette {
  primary: string | null;
  secondary: string | null;
}

export interface AvatarRenderHints {
  usePatternTexture: boolean;
  useSecondaryColor: boolean;
  /** 'matte' | 'glossy' | 'textured' */
  surfaceFinish: string;
  /** Reserved: R2 URL for front texture — not implemented in V1 */
  frontTextureRef: string | null;
  /** Reserved: R2 URL for back texture — not implemented in V1 */
  backTextureRef: string | null;
}

/**
 * Mirrors the Python AvatarMappingResult schema.
 * Keep in sync with backend/schemas/models.py: AvatarMappingResult.
 */
export interface AvatarMappingResult {
  avatarCategory: 'top' | 'bottom';
  avatarAssetFamily: string;
  materialPreset: string;
  patternPreset: string;
  palette: AvatarPalette;
  fitPreset: string;
  renderHints: AvatarRenderHints;
  inputCategory: string | null;
  inputType: string | null;
}

// ── Combined dressed avatar asset ─────────────────────────────────────────────
// A single GLB containing body + clothing baked together from Blender.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ASSET_COMBINED_TSHIRT_PANTS = require('../../assets/models/combined/avatar_tshirt_pants_male_v1.glb');

// ── Family sets for combined-avatar matching ──────────────────────────────────
// These sets define which backend avatarAssetFamily values map to the
// tshirt+pants combined avatar.  When adding a new combined GLB, add a new
// set pair and a branch in resolveCombinedAvatar().

const SHIRT_FAMILIES = new Set([
  'shirt', 'dress_shirt', 'tshirt', 'hoodie', 'zip_hoodie',
  'sweater', 'blazer', 'tank', 'polo', 'crop_top',
]);

const PANTS_FAMILIES = new Set([
  'jeans', 'trousers', 'chinos', 'cargo_pants', 'joggers', 'sweatpants',
]);

// ── Runtime render config ──────────────────────────────────────────────────────

/**
 * Per-garment render config built from a backend AvatarMappingResult.
 *
 * tintPrimary / tintSecondary: hex strings (e.g. '#1A1A1A') or null.
 *   Stored for future use — tinting not yet applied to the GLB material.
 *
 * materialPreset / patternPreset / fitPreset / renderHints:
 *   Stored and logged — not yet wired to shader parameters.
 */
export interface ClothingSlotConfig {
  /** Asset family from the backend (e.g. 'tshirt', 'jeans') */
  assetFamily: string;
  /** Primary hex tint or null */
  tintPrimary: string | null;
  /** Secondary hex tint or null */
  tintSecondary: string | null;
  materialPreset: string;
  patternPreset: string;
  fitPreset: string;
  renderHints: AvatarRenderHints;
}

/**
 * Full avatar clothing config for one outfit (top + bottom).
 * Both slots are optional — the avatar renders the base model with neither.
 */
export interface AvatarRenderConfig {
  top: ClothingSlotConfig | null;
  bottom: ClothingSlotConfig | null;
}

/** No-op config used before the first Generate or after a reset. */
export const EMPTY_RENDER_CONFIG: AvatarRenderConfig = { top: null, bottom: null };

// ── Transform functions ────────────────────────────────────────────────────────

/**
 * Converts one backend AvatarMappingResult → ClothingSlotConfig.
 */
export function buildSlotConfig(result: AvatarMappingResult): ClothingSlotConfig {
  return {
    assetFamily:    result.avatarAssetFamily,
    tintPrimary:    result.palette.primary,
    tintSecondary:  result.palette.secondary,
    materialPreset: result.materialPreset,
    patternPreset:  result.patternPreset,
    fitPreset:      result.fitPreset,
    renderHints:    result.renderHints,
  };
}

/**
 * Builds a full AvatarRenderConfig from 0–N backend mapping results.
 * Only the first top and first bottom are used.
 */
export function buildRenderConfig(results: AvatarMappingResult[]): AvatarRenderConfig {
  let top: ClothingSlotConfig | null = null;
  let bottom: ClothingSlotConfig | null = null;

  for (const r of results) {
    if (r.avatarCategory === 'top' && !top) {
      top = buildSlotConfig(r);
    } else if (r.avatarCategory === 'bottom' && !bottom) {
      bottom = buildSlotConfig(r);
    }
  }

  return { top, bottom };
}

// ── Combined dressed avatar resolution ────────────────────────────────────────
//
// MVP rendering path: instead of overlaying separate clothing GLBs on the base
// avatar, use a single combined GLB that already contains body + clothing.
//
// The resolver checks the AvatarRenderConfig (which carries the per-slot
// asset family from the backend) and returns a combined GLB when the outfit
// matches a known combination.  When no combined asset exists, the caller
// falls back to the base naked avatar.
//
// HOW TO ADD A NEW COMBINED AVATAR:
//   1. Export the combined GLB from Blender (body + clothing in one file)
//   2. Place it in assets/models/combined/
//   3. Add a require() constant above
//   4. Add family sets and a new branch below

/** Result when a combined dressed avatar matches the current outfit. */
export interface CombinedAvatarResult {
  /** Metro-resolved .glb asset — pass as `source` to <Model>. */
  asset: number;
  /** Human-readable filename for dev logs. */
  debugName: string;
}

/**
 * Checks whether the resolved outfit config matches a combined dressed avatar.
 *
 * Returns a CombinedAvatarResult when matched, or null to signal fallback to
 * the base naked avatar.
 *
 * MVP match: any shirt-family top + any pants-family bottom
 *   → avatar_tshirt_pants_male_v1.glb
 */
export function resolveCombinedAvatar(
  config: AvatarRenderConfig,
): CombinedAvatarResult | null {
  const topFamily    = config.top?.assetFamily    ?? null;
  const bottomFamily = config.bottom?.assetFamily ?? null;

  if (topFamily && bottomFamily
      && SHIRT_FAMILIES.has(topFamily)
      && PANTS_FAMILIES.has(bottomFamily)) {
    if (__DEV__) {
      console.log(
        `[Avatar] Combined resolver: ${topFamily} + ${bottomFamily}` +
        ` → avatar_tshirt_pants_male_v1.glb`,
      );
    }
    return {
      asset:     ASSET_COMBINED_TSHIRT_PANTS,
      debugName: 'avatar_tshirt_pants_male_v1.glb',
    };
  }

  if (__DEV__) {
    console.log(
      `[Avatar] Combined resolver: ${topFamily ?? 'none'} + ${bottomFamily ?? 'none'}` +
      ` → no match, using base avatar`,
    );
  }
  return null;
}
