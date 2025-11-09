const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require('express-validator');
const User = require("../models/user");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('[AUTH] JWT_SECRET not set. Exiting.');
  process.exit(1);
}

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ❌ Signup is handled in routes/user.js via /api/users
// This file only handles login via /api/login

router.post("/login", authLimiter, [
  body('email').isEmail().withMessage('Invalid email format'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AUTH] /login requested');
    }

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { email, password } = req.body;

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