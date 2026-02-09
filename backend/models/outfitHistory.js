const mongoose = require('mongoose');

const OutfitHistorySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    occasion: { type: String, default: '' },
    context: { type: mongoose.Schema.Types.Mixed, default: null },
    engine: { type: String, enum: ['python', 'node_fallback'], default: 'node_fallback' },
    pythonUsed: { type: Boolean, default: false },
    pythonError: { type: String, default: null },
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
    lockedItemIds: { type: [String], default: [] },
    reasons: { type: mongoose.Schema.Types.Mixed, default: null }, // array or string
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

OutfitHistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('OutfitHistory', OutfitHistorySchema);
