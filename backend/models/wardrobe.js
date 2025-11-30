const mongoose = require('mongoose');

// Sub-schema for normalized LLM metadata
const FashionMetadataSchema = new mongoose.Schema(
  {
    category: {
      type: String, // "top" | "bottom" | "shoes"
    },
    type: {
      type: String, // "shirt", "jeans", "sneakers", etc.
    },
    fabric: {
      type: String, // "cotton", "denim", "linen", "blend", "unknown", etc.
    },
    color_name: {
      type: String, // "black", "white", "navy", etc.
    },
    color_type: {
      type: String, // "neutral", "warm", "cool", "bold", "pastel", "unknown"
    },
    pattern: {
      type: String, // "solid", "plaid", "checked", etc.
    },
    fit: {
      type: String, // "slim", "regular", "relaxed", "oversized", "tapered", "skinny", "wide", "unknown"
    },
    style_tags: {
      type: [String], // up to a few items like ["casual", "minimal", "streetwear"]
      default: [],
    },
  },
  { _id: false } // Don't create _id for subdocuments
);

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
    category: {
      type: String,
      required: true,
    },
    colors: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
    },

    // Rich style metadata
    formality: {
      type: String, // e.g. "casual", "smart-casual", "business", "formal", "party"
    },
    occasionTags: {
      type: [String], // e.g. ["college", "interview", "wedding"]
      default: [],
    },
    seasonTags: {
      type: [String], // e.g. ["summer", "winter", "monsoon"]
      default: [],
    },
    styleVibe: {
      type: [String], // e.g. ["streetwear", "minimal", "classic", "sporty", "ethnic"]
      default: [],
    },
    fit: {
      type: String, // e.g. "slim", "regular", "oversized", "relaxed"
    },
    pattern: {
      type: String, // e.g. "solid", "striped", "checked", "floral"
    },
    fabric: {
      type: String, // e.g. "cotton", "denim", "linen", "polyester", "wool"
    },

    isFavorite: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String], // free-form labels
      default: [],
    },

    // NEW: Normalized LLM metadata (optional, backward compatible)
    metadata: {
      type: FashionMetadataSchema,
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wardrobe', WardrobeSchema);

