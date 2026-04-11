# Avatar 3D Asset Pipeline — Developer / 3D Artist Handoff

## Current State

### What the mapping pipeline already differentiates

The backend (`backend/services/avatar_mapping.py`) produces **10 distinct top families**
and **9 distinct bottom families**. These flow through to the client unchanged — the
`ClothingSlotConfig.assetFamily` field carries the exact family string.

| Slot | `avatarAssetFamily` values produced by backend |
|------|------------------------------------------------|
| Top  | `tshirt`, `hoodie`, `zip_hoodie`, `sweater`, `blazer`, `dress_shirt`, `shirt`, `polo`, `tank`, `crop_top` |
| Bottom | `jeans`, `trousers`, `chinos`, `cargo_pants`, `joggers`, `sweatpants`, `shorts`, `leggings`, `skirt` |

### Why everything still looks the same

There is only **one combined GLB** in the repo:

```
assets/models/combined/avatar_tshirt_pants_male_v1.glb   (14.9 MB)
```

It contains three mesh nodes:
- `Male_body` — skin mesh (tinted with skin tone)
- `Tshirts` — top clothing mesh (tinted with outfit primary color)
- `Pants` — bottom clothing mesh (tinted with outfit primary color)

The resolver (`resolveCombinedAvatar()` in `src/avatar/avatarClothingConfig.ts`) maps
**every** recognized top family × **every** recognized bottom family to this single GLB.
A hoodie, a blazer, and a tank top all render the same `Tshirts` mesh shape — only the
color tint differs. When no combined GLB matches, the avatar falls back to `avatar_base_male.glb`
(naked).

---

## What's Needed: New Combined GLBs

Each new GLB must be a single file containing `Male_body` + a top mesh + a bottom mesh,
exported from Blender with the body rigged to the same skeleton as the existing asset.

### Priority 1 — Highest-impact top variants (pair each with the existing pants mesh)

| # | Asset file | Top mesh node name | Clothing shape | Why high-impact |
|---|------------|--------------------|----------------|-----------------|
| 1 | `avatar_hoodie_pants_male_v1.glb` | `Hoodie` | Hooded pullover, kangaroo pocket, longer hem | Hoodies are one of the most common wardrobe items; currently indistinguishable from a t-shirt |
| 2 | `avatar_dress_shirt_pants_male_v1.glb` | `Dress_shirt` | Collared button-up, cuffs, placket | Dress shirts and button-ups are visually very different from t-shirts; users notice immediately |
| 3 | `avatar_blazer_pants_male_v1.glb` | `Blazer` | Structured jacket, lapels, longer cut | Blazers are formal/smart-casual — rendering them as a tee undermines outfit context |

### Priority 2 — Secondary variants

| # | Asset file | Top mesh node name | Clothing shape |
|---|------------|--------------------|----------------|
| 4 | `avatar_sweater_pants_male_v1.glb` | `Sweater` | Crewneck knit, thicker fabric silhouette, ribbed cuffs |
| 5 | `avatar_tank_pants_male_v1.glb` | `Tank` | Sleeveless, exposed shoulders |

### Priority 3 — Bottom variants (optional, lower impact)

| # | Asset file | Bottom mesh node name | Clothing shape |
|---|------------|----------------------|----------------|
| 6 | `avatar_tshirt_shorts_male_v1.glb` | `Shorts` | Above-knee, exposed calves |

---

## Blender Export Requirements

1. **Skeleton**: Reuse the exact same armature as `avatar_tshirt_pants_male_v1.glb`. The
   react-native-filament `<Model>` component does not re-bind bones.

2. **Node naming**: Each mesh object must have a unique, stable name (e.g. `Hoodie`,
   `Dress_shirt`). The renderer uses `<EntitySelector byName="...">` to target meshes
   for `baseColorFactor` tinting at runtime.

3. **Body node**: Always include `Male_body` with the same name. It receives the skin
   tone tint (`MVP_SKIN_TONE_LINEAR`, currently `#C4957A`).

4. **Bottom node**: For Priority 1–2 assets, reuse the existing `Pants` mesh geometry.
   Keep the node name `Pants` so the existing bottom-tinting code works without changes.

5. **Material slots**: Each clothing mesh needs at least material index `0` with a PBR
   metallic-roughness workflow. The renderer sets `baseColorFactor` on index 0. Do not
   bake colors into vertex colors or textures — color comes from runtime tinting.

6. **File format**: glTF Binary (`.glb`), embedded textures if any. No Draco compression
   (react-native-filament does not bundle a Draco decoder).

7. **File size target**: Aim for < 20 MB per GLB. The existing combined asset is ~15 MB.

---

## Repo Placement

```
assets/
└── models/
    ├── avatar/
    │   └── avatar_base_male.glb          ← naked fallback (existing)
    └── combined/
        ├── avatar_tshirt_pants_male_v1.glb    ← existing
        ├── avatar_hoodie_pants_male_v1.glb    ← NEW
        ├── avatar_dress_shirt_pants_male_v1.glb ← NEW
        ├── avatar_blazer_pants_male_v1.glb    ← NEW
        ├── avatar_sweater_pants_male_v1.glb   ← NEW (P2)
        └── avatar_tank_pants_male_v1.glb      ← NEW (P2)
```

Metro already resolves `.glb` via `assetExts` in `metro.config.js`. No bundler config
changes needed — just drop files in and `require()` them.

---

## Code Integration Points

Once GLBs are added, the code changes are small and contained to one file:
**`src/avatar/avatarClothingConfig.ts`**

### Step 1 — Add `require()` constants (next to line 66)

```typescript
const ASSET_COMBINED_TSHIRT_PANTS  = require('../../assets/models/combined/avatar_tshirt_pants_male_v1.glb');
const ASSET_COMBINED_HOODIE_PANTS  = require('../../assets/models/combined/avatar_hoodie_pants_male_v1.glb');
const ASSET_COMBINED_DSHIRT_PANTS  = require('../../assets/models/combined/avatar_dress_shirt_pants_male_v1.glb');
const ASSET_COMBINED_BLAZER_PANTS  = require('../../assets/models/combined/avatar_blazer_pants_male_v1.glb');
```

### Step 2 — Add exported node-name constants (next to line 80)

```typescript
export const HOODIE_NODE_TOP    = 'Hoodie';
export const DSHIRT_NODE_TOP    = 'Dress_shirt';
export const BLAZER_NODE_TOP    = 'Blazer';
```

### Step 3 — Add family sets for each new GLB (next to line 89)

```typescript
const HOODIE_FAMILIES = new Set(['hoodie', 'zip_hoodie', 'sweater']);
const DSHIRT_FAMILIES = new Set(['dress_shirt', 'shirt']);
const BLAZER_FAMILIES = new Set(['blazer']);
```

### Step 4 — Branch in `resolveCombinedAvatar()` (line 275)

Add early-return branches **before** the existing catch-all match. Order from most
specific to least specific:

```typescript
export function resolveCombinedAvatar(config: AvatarRenderConfig): CombinedAvatarResult | null {
  const topFamily    = config.top?.assetFamily    ?? null;
  const bottomFamily = config.bottom?.assetFamily ?? null;

  if (!topFamily || !bottomFamily || !PANTS_FAMILIES.has(bottomFamily)) {
    // No match possible
    return null;
  }

  const topColor    = hexToLinearRGBA(config.top?.tintPrimary ?? null);
  const bottomColor = hexToLinearRGBA(config.bottom?.tintPrimary ?? null);

  // --- Specific top families (check before generic SHIRT_FAMILIES) ---

  if (HOODIE_FAMILIES.has(topFamily)) {
    return { asset: ASSET_COMBINED_HOODIE_PANTS, debugName: 'avatar_hoodie_pants_male_v1.glb', topColor, bottomColor };
  }
  if (BLAZER_FAMILIES.has(topFamily)) {
    return { asset: ASSET_COMBINED_BLAZER_PANTS, debugName: 'avatar_blazer_pants_male_v1.glb', topColor, bottomColor };
  }
  if (DSHIRT_FAMILIES.has(topFamily)) {
    return { asset: ASSET_COMBINED_DSHIRT_PANTS, debugName: 'avatar_dress_shirt_pants_male_v1.glb', topColor, bottomColor };
  }

  // --- Generic t-shirt catch-all ---
  if (SHIRT_FAMILIES.has(topFamily)) {
    return { asset: ASSET_COMBINED_TSHIRT_PANTS, debugName: 'avatar_tshirt_pants_male_v1.glb', topColor, bottomColor };
  }

  return null;
}
```

### Step 5 — Update `Avatar3DScreen.tsx` tinting (only if new top node names differ)

The existing tinting code targets `COMBINED_NODE_TOP` (`'Tshirts'`). If new GLBs use
different node names (e.g. `'Hoodie'`), the `CombinedAvatarResult` interface needs a
`topNodeName` field so the renderer can target the correct mesh:

```typescript
export interface CombinedAvatarResult {
  asset: number;
  debugName: string;
  topColor: [number, number, number, number];
  bottomColor: [number, number, number, number];
  topNodeName: string;    // ← NEW: e.g. 'Tshirts', 'Hoodie', 'Dress_shirt'
  bottomNodeName: string; // ← NEW: e.g. 'Pants', 'Shorts'
}
```

Then in `Avatar3DScreen.tsx`, replace:
```typescript
<EntitySelector byName={COMBINED_NODE_TOP} ... />
```
with:
```typescript
<EntitySelector byName={resolvedCombined.topNodeName} ... />
```

**Alternative (simpler)**: Name the top mesh `Tshirts` in every GLB. This avoids any
renderer changes. The node name is just a label for `EntitySelector` — it doesn't need
to match the visual shape. This is recommended for the initial batch.

---

## Testing Checklist

For each new GLB:

- [ ] GLB loads without crash in `FilamentScene`
- [ ] `Male_body` node receives skin tone tint correctly
- [ ] Top mesh receives `baseColorFactor` tint (verify with a bright color like red)
- [ ] `Pants` node still tints correctly
- [ ] Rotation drag works smoothly (no frame drops from larger GLB)
- [ ] `SavedOutfitDetailModal` renders the same GLB (uses shared `resolveCombinedAvatar()`)
- [ ] Dev log shows correct GLB filename: `[Avatar] Combined resolver: hoodie + jeans → avatar_hoodie_pants_male_v1.glb`
- [ ] File size is reasonable (< 20 MB)

---

## Summary

| Layer | Status | Action needed |
|-------|--------|---------------|
| Backend mapping | Done — 10 top families, 9 bottom families | None |
| Client config types | Done — `assetFamily` preserved per slot | None |
| Client resolver | Ready — branch points documented above | Add branches once GLBs exist |
| 3D assets | **Blocking** — only 1 combined GLB exists | Export 3–5 new combined GLBs from Blender |
| Renderer (Avatar3DScreen) | Ready — uses `EntitySelector` + `baseColorFactor` | Minor: use dynamic node name or standardize names |
| SavedOutfitDetailModal | Auto — shares `resolveCombinedAvatar()` | No changes needed |
