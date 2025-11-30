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
    type: {
      type: String,
    },
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
    color_name: {
      type: String,
    },
    color_type: {
      type: String,
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
    style_tags: [
      {
        type: String,
      },
    ],

    isFavorite: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String], // free-form labels
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wardrobe', WardrobeSchema);

