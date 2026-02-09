const mongoose = require('mongoose');

const WardrobeSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    cleanImageUrl: {
      type: String,
      default: null,
    },

    // v1 source of truth: locked ItemProfile from Python
    profile: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Top-level convenience fields for indexing/UI (derived from profile)
    category: { type: String, default: null },
    type: { type: String, default: null },
    primaryColor: { type: String, default: null },

    notes: { type: String },

    // Legacy fields: kept for backward compat on reads; do not write for v1 items
    colors: { type: [String], default: [] },
    formality: { type: mongoose.Schema.Types.Mixed },
    occasionTags: { type: [String], default: [] },
    seasonTags: { type: [String], default: [] },
    styleVibe: { type: [String], default: [] },
    color_name: { type: String },
    color_type: { type: String },
    fit: { type: String },
    pattern: { type: String },
    fabric: { type: String },
    style_tags: [String],
    tags: { type: [String], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed },

    isFavorite: {
      type: Boolean,
      default: false,
    },

    // v2 overlay: user-editable; never overwrite profile
    v2: {
      userTags: { type: [String], default: [] },
      overrides: { type: mongoose.Schema.Types.Mixed, default: null },
      availability: {
        status: { type: String, enum: ['available', 'unavailable'], default: 'available' },
        reason: { type: String, enum: ['laundry', 'packed'], default: null },
        untilDate: { type: String, default: null }, // YYYY-MM-DD
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wardrobe', WardrobeSchema);

