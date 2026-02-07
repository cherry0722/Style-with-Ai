const express = require('express');
const auth = require('../middleware/auth');
const Wardrobe = require('../models/wardrobe');
const { analyzeImage } = require('../services/imageAnalysisProvider');
const { generateFashionMetadata } = require('../services/llmFashionTagger');

// NOTE: All wardrobe routes are auth-protected and scoped to the current user.
const router = express.Router();

// POST /api/wardrobe/analyze - analyze an image and return AI metadata (no DB write)
router.post('/analyze', auth, async (req, res) => {
  try {
    const { imageUrl, category, colors, notes } = req.body || {};

    if (!imageUrl) {
      return res.status(400).json({ message: 'imageUrl is required' });
    }

    const userId = req.user?.userId || req.user?._id?.toString() || req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid auth payload' });
    }

    let visionTags = [];
    let visionColors = {};

    try {
      console.log('[Wardrobe] Analyzing image with image analysis provider', {
        userId,
        imageUrl,
      });
      const aiResult = await analyzeImage(imageUrl);
      if (aiResult) {
        visionTags = Array.isArray(aiResult.tags) ? aiResult.tags : [];
        visionColors = aiResult.colors || {};
      } else {
        console.log(
          '[Wardrobe] Vision analyzer returned null for analyze endpoint, using empty tags/colors.'
        );
      }
    } catch (err) {
      console.warn(
        '[Wardrobe] Image analysis failed in /api/wardrobe/analyze:',
        err.message || err.toString()
      );
      visionTags = [];
      visionColors = {};
    }

    const llmPayload = {
      tags: visionTags,
      colors: visionColors,
      description: null,
    };

    console.log('[Wardrobe] Vision tags:', visionTags.slice(0, 10));
    const llmMetadata = await generateFashionMetadata(llmPayload);
    if (llmMetadata) {
      console.log('[Wardrobe] Final fashion metadata:', llmMetadata);
    } else {
      console.log('[Wardrobe] No LLM metadata generated (null result).');
    }

    return res.status(200).json({
      imageUrl,
      azure_tags: visionTags,
      azure_colors: visionColors,
      llm_metadata: llmMetadata || null,
      category_hint: category || null,
      color_hint:
        Array.isArray(colors) && colors.length > 0 ? colors[0] : null,
    });
  } catch (err) {
    console.error('[Wardrobe] POST /api/wardrobe/analyze error:', err);
    return res
      .status(500)
      .json({ message: 'Failed to analyze wardrobe image' });
  }
});

// POST /api/wardrobe - create a wardrobe item for the logged-in user
router.post('/', auth, async (req, res) => {
  try {
    const {
      imageUrl,
      cleanImageUrl,
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
      type,
      color_name,
      color_type,
      style_tags,
      isFavorite,
      tags,
      metadata,
    } = req.body || {};

    if (!imageUrl || !category) {
      return res.status(400).json({
        message: 'imageUrl and category are required',
      });
    }

    const userId =
      req.user?.userId ||
      req.user?._id?.toString() ||
      req.user?.id ||
      req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid auth payload' });
    }

    // Determine colors: use request colors if provided, otherwise fallback to empty array.
    const finalColors = Array.isArray(colors) ? colors : [];

    // Tags: for backwards compatibility, accept any provided tags and store directly.
    const finalTags = Array.isArray(tags)
      ? Array.from(
          new Set(
            tags
              .map((tag) => String(tag).trim().toLowerCase())
              .filter((tag) => tag.length > 0)
          )
        ).slice(0, 20)
      : [];

    // Build metadata object if provided
    let metadataObj = undefined;
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      metadataObj = {
        category: metadata.category || undefined,
        type: metadata.type || undefined,
        fabric: metadata.fabric || undefined,
        color_name: metadata.color_name || undefined,
        color_type: metadata.color_type || undefined,
        pattern: metadata.pattern || undefined,
        fit: metadata.fit || undefined,
        style_tags: Array.isArray(metadata.style_tags) ? metadata.style_tags : [],
      };
      // Only set metadata if at least one field is present
      if (
        Object.values(metadataObj).every(
          (val) =>
            val === undefined || (Array.isArray(val) && val.length === 0)
        )
      ) {
        metadataObj = undefined;
      }
    }

    console.log('[Wardrobe] Saving item with metadata', {
      userId,
      category,
      colors: finalColors,
      tags: finalTags.slice(0, 10),
      hasMetadata: !!metadataObj,
    });

    const item = await Wardrobe.create({
      userId,
      imageUrl,
      cleanImageUrl: cleanImageUrl || undefined,
      category,
      colors: finalColors,
      notes: notes || undefined,

      type: type || undefined,
      formality: formality || undefined,
      occasionTags: Array.isArray(occasionTags) ? occasionTags : [],
      seasonTags: Array.isArray(seasonTags) ? seasonTags : [],
      styleVibe: Array.isArray(styleVibe) ? styleVibe : [],
      fit: fit || undefined, // keep existing fit metadata
      pattern: pattern || undefined, // keep existing pattern metadata
      fabric: fabric || undefined, // keep existing fabric metadata
      color_name: color_name || undefined,
      color_type: color_type || undefined,
      style_tags: Array.isArray(style_tags) ? style_tags : undefined,
      isFavorite:
        typeof isFavorite === 'boolean' ? isFavorite : undefined, // let schema default apply
      tags: finalTags,
      metadata: metadataObj,
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
    const userId = req.user?.userId || req.user?._id?.toString() || req.user?.id || req.user?._id;
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

    const userId = req.user?.userId || req.user?._id?.toString() || req.user?.id || req.user?._id;
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

// DELETE /api/wardrobe/:id - delete a wardrobe item
router.delete('/:id', auth, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id?.toString() || req.user?.id || req.user?._id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ message: 'Invalid auth payload' });
    }

    // Make sure the item belongs to this user
    const item = await Wardrobe.findOne({ _id: id, userId });
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    await item.deleteOne();

    return res.json({ success: true, id });
  } catch (err) {
    console.error('[Wardrobe] Delete error:', err);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid wardrobe item ID' });
    }
    return res.status(500).json({ message: 'Failed to delete wardrobe item' });
  }
});

module.exports = router;
