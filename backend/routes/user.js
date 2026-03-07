const express = require("express");
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require("../models/user");
const auth = require("../middleware/auth");

//signup
router.post("/users", [
  body('email').isEmail().withMessage('Invalid email format'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('username').trim().notEmpty().withMessage('Username is required')
], async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[USER] create requested');
    }

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { username, email, password, phone, image } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Email or username already exists" });
    }

    const newUser = new User({
      username,
      email,
      password,
      phone,
      image,
    });

    const savedUser = await newUser.save();
    
    // Don't send password back
    const userResponse = savedUser.toObject();
    delete userResponse.password;
    
    res.status(201).json({
      message: "User created successfully",
      user: userResponse,
    });
  } catch (err) {
    console.error("Error creating user:", err);
    
    // Handle MongoDB validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: messages });
    }
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      return res.status(400).json({ 
        message: "Email or username already exists" 
      });
    }
    
    res.status(500).json({ 
      message: err.message || "Server error while creating user" 
    });
  }
});

router.get("/users/email/:email", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email }).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found with this email" });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error("Error fetching user by email:", err);
    res.status(500).json({ message: "Server error while fetching user" });
  }
});

router.get("/users/username/:username", auth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found with this username" });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error("Error fetching user by username:", err);
    res.status(500).json({ message: "Server error while fetching user" });
  }
});

// ❌ Removed duplicate /login route - login is handled in routes/auth.js

// GET /api/users/me — return current user (exclude password) including profile, settings, privacy
router.get("/users/me", auth, async (req, res) => {
  try {
    const userId =
      (req.user && req.user.id) ||
      (req.user && req.user.userId) ||
      (req.user && (req.user._id?.toString?.() || req.user._id));
    if (!userId) {
      return res.status(401).json({ message: "Invalid auth payload" });
    }
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    delete user.password;
    return res.status(200).json(user);
  } catch (err) {
    console.error("Error fetching current user:", err);
    return res.status(500).json({ message: "Server error while fetching user" });
  }
});

router.get("/users", auth, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Server error while fetching users" });
  }
});

// POST /api/users/profile - create or update the authenticated user's profile
router.post("/users/profile", auth, async (req, res) => {
  try {
    const userId =
      (req.user && req.user.id) ||
      (req.user && req.user.userId) ||
      (req.user && (req.user._id?.toString?.() || req.user._id));

    if (!userId) {
      return res.status(401).json({ message: "Invalid auth payload" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { age, gender, heightCm, weightLb, preferredName, pronouns, bodyType } = req.body || {};

    // Ensure profile object exists
    if (!user.profile) {
      user.profile = {};
    }

    // Overwrite only the fields that are provided in the body
    if (typeof age !== "undefined") user.profile.age = age;
    if (typeof gender !== "undefined") user.profile.gender = gender;
    if (typeof heightCm !== "undefined") user.profile.heightCm = heightCm;
    if (typeof weightLb !== "undefined") user.profile.weightLb = weightLb;
    if (typeof preferredName !== "undefined") user.profile.preferredName = preferredName;
    if (typeof pronouns !== "undefined") user.profile.pronouns = pronouns;
    if (typeof bodyType !== "undefined") user.profile.bodyType = bodyType;

    await user.save();

    return res.status(200).json({
      success: true,
      profile: user.profile,
    });
  } catch (err) {
    console.error("Error updating user profile:", err);
    return res
      .status(500)
      .json({ message: "Server error while updating user profile" });
  }
});

// PATCH /api/users/settings - update accessibility-related settings
router.patch("/users/settings", auth, async (req, res) => {
  try {
    const userId =
      (req.user && req.user.id) ||
      (req.user && req.user.userId) ||
      (req.user && (req.user._id?.toString?.() || req.user._id));

    if (!userId) {
      return res.status(401).json({ message: "Invalid auth payload" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { temperatureUnit, notificationsEnabled } = req.body || {};

    if (!user.settings) {
      user.settings = {};
    }

    if (typeof temperatureUnit !== "undefined") {
      user.settings.temperatureUnit = temperatureUnit;
    }
    if (typeof notificationsEnabled !== "undefined") {
      user.settings.notificationsEnabled = notificationsEnabled;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      settings: user.settings,
    });
  } catch (err) {
    console.error("Error updating user settings:", err);
    return res
      .status(500)
      .json({ message: "Server error while updating user settings" });
  }
});

// PATCH /api/users/privacy - update account privacy settings
router.patch("/users/privacy", auth, async (req, res) => {
  try {
    const userId =
      (req.user && req.user.id) ||
      (req.user && req.user.userId) ||
      (req.user && (req.user._id?.toString?.() || req.user._id));

    if (!userId) {
      return res.status(401).json({ message: "Invalid auth payload" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { profileVisible, activityVisible, dataSharingConsent } = req.body || {};
    const provided = { profileVisible, activityVisible, dataSharingConsent };

    for (const [key, value] of Object.entries(provided)) {
      if (typeof value !== "undefined" && typeof value !== "boolean") {
        return res.status(400).json({ message: `${key} must be a boolean` });
      }
    }

    if (!user.privacy) {
      user.privacy = {};
    }

    if (typeof profileVisible !== "undefined") user.privacy.profileVisible = profileVisible;
    if (typeof activityVisible !== "undefined") user.privacy.activityVisible = activityVisible;
    if (typeof dataSharingConsent !== "undefined") user.privacy.dataSharingConsent = dataSharingConsent;

    await user.save();

    return res.status(200).json({
      success: true,
      privacy: user.privacy,
    });
  } catch (err) {
    console.error("Error updating user privacy:", err);
    return res.status(500).json({ message: "Server error while updating user privacy" });
  }
});

// POST /api/users/change-password - verify current password and set a new one
router.post("/users/change-password", auth, async (req, res) => {
  try {
    const userId =
      (req.user && req.user.id) ||
      (req.user && req.user.userId) ||
      (req.user && (req.user._id?.toString?.() || req.user._id));

    if (!userId) {
      return res.status(401).json({ message: "Invalid auth payload" });
    }

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword are required" });
    }
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return res.status(400).json({ message: "Passwords must be strings" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    console.error("Error changing password:", err);
    return res.status(500).json({ message: "Server error while changing password" });
  }
});

module.exports = router;
