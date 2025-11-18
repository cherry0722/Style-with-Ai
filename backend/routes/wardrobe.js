const express = require('express');
const auth = require('../middleware/auth');
const Wardrobe = require('../models/wardrobe');

const router = express.Router();

// POST /api/wardrobe - create a wardrobe item for the logged-in user
router.post('/', auth, async (req, res) => {
  try {
    const {
      imageUrl,
      category,
      colors,
      notes,
      formality,
      occasionTags,
      seasonTags,
      styleVibe,
      fit,
      pattern,
      fabric,
      isFavorite,
      tags,
    } = req.body || {};

    if (!imageUrl || !category) {
      return res.status(400).json({
        message: 'imageUrl and category are required',
      });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid auth payload' });
    }

    const item = await Wardrobe.create({
      userId,
      imageUrl,
      category,
      colors: Array.isArray(colors) ? colors : [],
      notes: notes || undefined,

      formality: formality || undefined,
      occasionTags: Array.isArray(occasionTags) ? occasionTags : [],
      seasonTags: Array.isArray(seasonTags) ? seasonTags : [],
      styleVibe: Array.isArray(styleVibe) ? styleVibe : [],
      fit: fit || undefined,
      pattern: pattern || undefined,
      fabric: fabric || undefined,
      isFavorite:
        typeof isFavorite === 'boolean' ? isFavorite : undefined, // let schema default apply
      tags: Array.isArray(tags) ? tags : [],
    });

    return res.status(201).json(item);
  } catch (err) {
    console.error('[Wardrobe] POST /api/wardrobe error:', err);
    return res
      .status(500)
      .json({ message: 'Failed to create wardrobe item' });
  }
});

// GET /api/wardrobe - get wardrobe items for the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid auth payload' });
    }

    const items = await Wardrobe.find({ userId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return res.json(items);
  } catch (err) {
    console.error('[Wardrobe] GET /api/wardrobe error:', err);
    return res
      .status(500)
      .json({ message: 'Failed to fetch wardrobe items' });
  }
});

module.exports = router;
