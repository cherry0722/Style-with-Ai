const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { Schema } = mongoose;
const userSchema = Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
    },
    image: {
      type: String,
    },
    // Optional profile fields used for personalization / onboarding
    profile: {
      age: { type: Number, default: null },
      gender: { type: String, default: null },
      heightCm: { type: Number, default: null },
      weightLb: { type: Number, default: null },
      preferredName: { type: String, default: null },
      pronouns: { type: String, default: null },
      bodyType: { type: String, default: null },
    },
    settings: {
      temperatureUnit: { type: String, default: null },
      notificationsEnabled: { type: Boolean, default: null },
      preferredLocation: { type: String, default: null },
    },
    privacy: {
      profileVisible: { type: Boolean, default: null },
      activityVisible: { type: Boolean, default: null },
      dataSharingConsent: { type: Boolean, default: null },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
