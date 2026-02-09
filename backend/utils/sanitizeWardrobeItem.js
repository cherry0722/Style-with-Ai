/**
 * Returns only the public wardrobe-item shape for API responses.
 * Removes internal DB fields: _id, __v, userId, createdAt, updatedAt,
 * and extra arrays (style_tags, styleVibe, colors, tags, etc.).
 * Use for outfits[].items[] in reasoned_outfits, regenerate, swap.
 *
 * @param {Object} itemDoc - Mongo lean doc or partial item (may have _id or id)
 * @returns {{ id: string, cleanImageUrl: string|null, profile: object|null, category: string|null, type: string|null, primaryColor: string|null, isFavorite: boolean, v2: object }}
 */
function sanitizeWardrobeItem(itemDoc) {
  if (!itemDoc || typeof itemDoc !== 'object') {
    return {
      id: '',
      cleanImageUrl: null,
      profile: null,
      category: null,
      type: null,
      primaryColor: null,
      isFavorite: false,
      v2: { userTags: [], overrides: null, availability: { status: 'available', reason: null, untilDate: null } },
    };
  }
  const id = itemDoc.id != null ? String(itemDoc.id) : (itemDoc._id != null ? String(itemDoc._id) : '');
  const v2 = itemDoc.v2 && typeof itemDoc.v2 === 'object'
    ? {
        userTags: Array.isArray(itemDoc.v2.userTags) ? itemDoc.v2.userTags : [],
        overrides: itemDoc.v2.overrides != null && typeof itemDoc.v2.overrides === 'object' ? itemDoc.v2.overrides : null,
        availability: itemDoc.v2.availability && typeof itemDoc.v2.availability === 'object'
          ? {
              status: itemDoc.v2.availability.status === 'unavailable' ? 'unavailable' : 'available',
              reason: itemDoc.v2.availability.reason === 'laundry' || itemDoc.v2.availability.reason === 'packed' ? itemDoc.v2.availability.reason : null,
              untilDate: typeof itemDoc.v2.availability.untilDate === 'string' ? itemDoc.v2.availability.untilDate : null,
            }
          : { status: 'available', reason: null, untilDate: null },
      }
    : { userTags: [], overrides: null, availability: { status: 'available', reason: null, untilDate: null } };

  return {
    id,
    cleanImageUrl: itemDoc.cleanImageUrl ?? itemDoc.imageUrl ?? null,
    profile: itemDoc.profile != null && typeof itemDoc.profile === 'object' ? itemDoc.profile : null,
    category: itemDoc.category != null ? String(itemDoc.category) : null,
    type: itemDoc.type != null ? String(itemDoc.type) : null,
    primaryColor: itemDoc.primaryColor != null ? String(itemDoc.primaryColor) : null,
    isFavorite: Boolean(itemDoc.isFavorite),
    v2,
  };
}

module.exports = { sanitizeWardrobeItem };
