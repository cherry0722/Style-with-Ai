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

/**
 * glTF node names inside avatar_tshirt_pants_male_v1.glb.
 * Must match the Blender object names (case-sensitive) used during export.
 *
 * Known nodes in this GLB:
 *   Male_body  — skin / body mesh.  Receives MVP_SKIN_TONE_LINEAR via COMBINED_NODE_BODY.
 *   Tshirts    — top clothing mesh. Receives topColor tint via COMBINED_NODE_TOP.
 *   Pants      — bottom clothing mesh. Receives bottomColor tint via COMBINED_NODE_BOTTOM.
 *
 * If tinting stops working after a GLB re-export, enable __DEV__ logging
 * (see the useEffect in SceneContent) to confirm the names at runtime.
 */
export const COMBINED_NODE_BODY   = 'Male_body';
export const COMBINED_NODE_TOP    = 'Tshirts';
export const COMBINED_NODE_BOTTOM = 'Pants';

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
 *   tintPrimary is converted to linear RGBA and applied as baseColorFactor
 *   on the combined avatar's clothing mesh regions via EntitySelector.
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

// ── Color conversion for material tinting ─────────────────────────────────────

/** Minimum per-channel linear value — prevents overly harsh pure-black. */
const MIN_LINEAR_CHANNEL = 0.012; // ≈ sRGB #1C (soft charcoal floor)

/** Neutral white — preserves the material's original appearance (no tint). */
const NEUTRAL_TINT: [number, number, number, number] = [1, 1, 1, 1];

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Converts a hex color string (#RGB or #RRGGBB) to linear RGBA [0–1]⁴
 * for Filament's baseColorFactor PBR parameter.
 *
 * Applies a soft per-channel floor to avoid harsh pure-black rendering.
 * Returns the fallback when the input is null or unparsable.
 */
export function hexToLinearRGBA(
  hex: string | null,
  fallback: [number, number, number, number] = NEUTRAL_TINT,
): [number, number, number, number] {
  if (hex == null || hex.length < 4) return fallback;

  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6) return fallback;

  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return fallback;

  return [
    Math.max(srgbToLinear(r), MIN_LINEAR_CHANNEL),
    Math.max(srgbToLinear(g), MIN_LINEAR_CHANNEL),
    Math.max(srgbToLinear(b), MIN_LINEAR_CHANNEL),
    1.0,
  ];
}

// ── MVP skin tone ──────────────────────────────────────────────────────────────
//
// Applied to Male_body in the combined avatar via EntitySelector.
// One neutral warm tone for MVP; swap the hex to change it later.
//
// Chosen value: #C8956C — warm medium-tan.  Believable under typical PBR
// lighting without being too saturated or ethnically specific.
// To adjust: change MVP_SKIN_TONE_HEX and hot-reload — no other edits needed.

/** Hex source so the skin tone is easy to read and change. */
export const MVP_SKIN_TONE_HEX = '#C4957A';

/**
 * Pre-computed Filament linear RGBA for MVP_SKIN_TONE_HEX.
 * Computed once at module load — stable reference, safe to use as a const
 * prop without useMemo.
 *
 * sRGB #C4957A → linear ≈ [0.554, 0.299, 0.181, 1.0]
 * Slightly cooler/pinker than the previous #C8956C — less orange cast
 * under warm scene lighting while remaining a natural medium tan.
 */
export const MVP_SKIN_TONE_LINEAR: [number, number, number, number] =
  hexToLinearRGBA(MVP_SKIN_TONE_HEX);

/** Result when a combined dressed avatar matches the current outfit. */
export interface CombinedAvatarResult {
  /** Metro-resolved .glb asset — pass as `source` to <Model>. */
  asset: number;
  /** Human-readable filename for dev logs. */
  debugName: string;
  /** Linear RGBA baseColorFactor for the top (shirt) region. */
  topColor: [number, number, number, number];
  /** Linear RGBA baseColorFactor for the bottom (pants) region. */
  bottomColor: [number, number, number, number];
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
    const topColor    = hexToLinearRGBA(config.top?.tintPrimary ?? null);
    const bottomColor = hexToLinearRGBA(config.bottom?.tintPrimary ?? null);

    if (__DEV__) {
      console.log(
        `[Avatar] Combined resolver: ${topFamily} + ${bottomFamily}` +
        ` → avatar_tshirt_pants_male_v1.glb` +
        ` | top=${config.top?.tintPrimary ?? 'default'} bottom=${config.bottom?.tintPrimary ?? 'default'}`,
      );
    }
    return {
      asset:       ASSET_COMBINED_TSHIRT_PANTS,
      debugName:   'avatar_tshirt_pants_male_v1.glb',
      topColor,
      bottomColor,
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
