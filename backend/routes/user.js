const express = require("express");
const router = express.Router();
const User = require("../models/user");

//signup
router.post("/users", async (req, res) => {
  try {
    console.log("Create user route hit", req.body);
    const { username, email, password, phone, image } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ 
        message: "Username, email, and password are required" 
      });
    }

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

router.get("/users/email/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({ message: "User not found with this email" });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error("Error fetching user by email:", err);
    res.status(500).json({ error: "Server error while fetching user" });
  }
});

router.get("/users/username/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      return res.status(404).json({ message: "User not found with this username" });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error("Error fetching user by username:", err);
    res.status(500).json({ error: "Server error while fetching user" });
  }
});

// ❌ Removed duplicate /login route - login is handled in routes/auth.js

router.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Server error while fetching users" });
  }
});

module.exports = router;
