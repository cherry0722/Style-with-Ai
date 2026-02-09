const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/user');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('[AUTH] JWT_SECRET not set. Exiting.');
  process.exit(1);
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/signup
router.post('/auth/signup', authLimiter, [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('email').isEmail().withMessage('Invalid email format'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.details = errors.array();
      return next(err);
    }
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      const err = new Error('Email or username already exists');
      err.status = 400;
      return next(err);
    }

    const newUser = new User({ username, email, password });
    const savedUser = await newUser.save();
    const token = jwt.sign(
      { email: savedUser.email, userId: savedUser._id.toString() },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      user: {
        id: savedUser._id.toString(),
        username: savedUser.username,
        email: savedUser.email,
      },
      accessToken: token,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      err.status = 400;
      err.message = Object.values(err.errors).map((e) => e.message).join(', ');
    }
    if (err.code === 11000) {
      err.status = 400;
      err.message = 'Email or username already exists';
    }
    next(err);
  }
});

// POST /api/auth/login
router.post('/auth/login', authLimiter, [
  body('email').isEmail().withMessage('Invalid email format'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const err = new Error('Validation failed');
      err.status = 400;
      return next(err);
    }
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      const err = new Error('Invalid credentials');
      err.status = 401;
      return next(err);
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const err = new Error('Invalid credentials');
      err.status = 401;
      return next(err);
    }

    const token = jwt.sign(
      { email: user.email, userId: user._id.toString() },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
      },
      accessToken: token,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout — auth required; revoke/session logic can be added later
router.post('/auth/logout', auth, (req, res) => {
  res.status(200).json({ ok: true });
});

module.exports = router;
