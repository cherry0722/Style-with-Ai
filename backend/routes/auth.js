const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// ❌ Signup is handled in routes/user.js via /api/users
// This file only handles login via /api/login

router.post("/login", async (req, res) => {
  try {
    console.log("Login route hit");
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    // 1️⃣ Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 2️⃣ Compare password using bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 3️⃣ Generate JWT token
    const token = jwt.sign({ email: user.email, userId: user._id }, JWT_SECRET, { expiresIn: "7d" });

    // 4️⃣ Return user data and token
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        phone: user.phone,
        image: user.image,
      },
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ message: "Login error" });
  }
});

module.exports = router;