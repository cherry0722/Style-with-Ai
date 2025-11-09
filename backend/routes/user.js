const express = require("express");
const router = express.Router();
const { body, validationResult } = require('express-validator');
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
    const user = await User.findOne({ email: req.params.email });
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
    const user = await User.findOne({ username: req.params.username });
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

router.get("/users", auth, async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Server error while fetching users" });
  }
});

module.exports = router;
