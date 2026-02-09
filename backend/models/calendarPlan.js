const mongoose = require('mongoose');

const planSlotSchema = new mongoose.Schema(
  {
    slotLabel: { type: String, enum: ['morning', 'afternoon', 'evening', 'custom'], default: 'morning' },
    occasion: { type: String, default: '' },
    outfitId: { type: String, default: null },
    status: { type: String, enum: ['planned', 'worn', 'skipped'], default: 'planned' },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const CalendarPlanSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    plans: { type: [planSlotSchema], default: [] },
  },
  { timestamps: true }
);

CalendarPlanSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('CalendarPlan', CalendarPlanSchema);
