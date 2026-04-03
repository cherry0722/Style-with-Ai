const mongoose = require('mongoose');

const { Schema } = mongoose;

const sessionSchema = new Schema(
  {
    startTime: { type: Date, required: true },
    endTime: { type: Date, default: null },
    duration: { type: Number, default: null }, // seconds
  },
  { _id: true }
);

const activitySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD' UTC date
      required: true,
      index: true,
    },
    totalScreenTime: {
      type: Number, // seconds
      default: 0,
    },
    sessions: {
      type: [sessionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Compound index for efficient per-user date range queries
activitySchema.index({ userId: 1, date: -1 });

const Activity = mongoose.model('Activity', activitySchema);

module.exports = Activity;
