const express = require("express");
const router = express.Router();
const User = require("../models/user");

//signup
router.post("/users", async (req, res) => {
  try {
console.log("Create user route hit");
    const { username, email, password, phone } = req.body;

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
    });

    const savedUser = await newUser.save();
    res.status(201).json({
      message: "User created successfully",
      user: savedUser,
    });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: "Server error while creating user" });
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

router.post("/login", async (req, res) => {
  try {
     console.log("Login route hit");
    const { email, password } = req.body;

    // 1️⃣ Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2️⃣ Match password
    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // 3️⃣ Return user data
    res.status(200).json({
      message: "Login successful",
      user,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

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
