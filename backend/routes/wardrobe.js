const express = require('express');
const auth = require('../middleware/auth');
const Wardrobe = require('../models/wardrobe');
const { analyzeImage } = require('../services/azureVisionService');

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

    // Azure Vision integration: analyze image if imageUrl is present
    let aiResult = null;
    if (imageUrl) {
      try {
        aiResult = await analyzeImage(imageUrl);
      } catch (err) {
        // Log but don't fail - wardrobe creation should still succeed
        console.log('[AzureVision] Analysis skipped or failed for imageUrl:', imageUrl);
      }
    }

    // Merge tags: request tags + AI tags
    const requestTags = Array.isArray(tags) ? tags : [];
    const requestTagsNormalized = requestTags
      .map((tag) => String(tag).trim().toLowerCase())
      .filter((tag) => tag.length > 0);

    const aiTags = aiResult?.tags || [];
    const aiTagsNormalized = aiTags
      .map((tag) => String(tag).trim().toLowerCase())
      .filter((tag) => tag.length > 0);

    // Combine and dedupe tags
    const combinedTags = [...new Set([...requestTagsNormalized, ...aiTagsNormalized])].slice(0, 20);

    // Determine colors: use request colors if provided, otherwise use AI colors
    let finalColors = [];
    if (Array.isArray(colors) && colors.length > 0) {
      // Use provided colors
      finalColors = colors;
    } else if (aiResult?.colors) {
      // Derive colors from AI analysis
      const aiColors = aiResult.colors;
      const colorsFromAI = [];

      // Add dominant colors
      if (Array.isArray(aiColors.dominantColors)) {
        colorsFromAI.push(...aiColors.dominantColors);
      }

      // Add foreground if present and not already included
      const foreground = aiColors.dominantForegroundColor || aiColors.foreground;
      if (foreground && !colorsFromAI.includes(foreground)) {
        colorsFromAI.push(foreground);
      }

      // Add background if present and not already included
      const background = aiColors.dominantBackgroundColor || aiColors.background;
      if (background && !colorsFromAI.includes(background)) {
        colorsFromAI.push(background);
      }

      // Normalize: lowercase, trim, filter empty, dedupe
      finalColors = [...new Set(colorsFromAI.map((c) => String(c).trim().toLowerCase()).filter((c) => c.length > 0))];
    } else {
      // Fallback to empty array
      finalColors = [];
    }

    const item = await Wardrobe.create({
      userId,
      imageUrl,
      category,
      colors: finalColors,
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
      tags: combinedTags,
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

// PATCH /api/wardrobe/:id/favorite - toggle favorite status for a wardrobe item
router.patch('/:id/favorite', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { isFavorite } = req.body;

    if (typeof isFavorite !== 'boolean') {
      return res.status(400).json({
        message: 'isFavorite must be a boolean',
      });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid auth payload' });
    }

    // Find the item and ensure it belongs to the authenticated user
    const item = await Wardrobe.findOne({ _id: id, userId });
    if (!item) {
      return res.status(404).json({
        message: 'Wardrobe item not found or does not belong to user',
      });
    }

    // Update the isFavorite field
    item.isFavorite = isFavorite;
    const updated = await item.save();

    return res.json(updated);
  } catch (err) {
    console.error('[Wardrobe] PATCH /api/wardrobe/:id/favorite error:', err);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid wardrobe item ID' });
    }
    return res
      .status(500)
      .json({ message: 'Failed to update favorite status' });
  }
});

module.exports = router;
