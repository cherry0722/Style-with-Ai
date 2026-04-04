const mongoose = require('mongoose');

const savedOutfitSchema = new mongoose.Schema(
  {
    userId:             { type: String, required: true, index: true },
    occasion:           { type: String, default: null },
    // Store items and avatarRenderConfig as Mixed — we snapshot arbitrary
    // AI response data here and don't need Mongoose to validate sub-fields.
    items:              { type: [mongoose.Schema.Types.Mixed], default: [] },
    reasons:            { type: [String], default: [] },
    avatarRenderConfig: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SavedOutfit', savedOutfitSchema);
