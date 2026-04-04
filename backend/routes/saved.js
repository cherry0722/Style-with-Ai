const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const SavedOutfit = require('../models/savedOutfit');

// POST /api/saved — save an outfit
router.post('/', auth, async (req, res) => {
  try {
    const { occasion, items, reasons, avatarRenderConfig } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const userId = req.user?.userId || req.user?._id?.toString() || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid auth payload' });
    }

    const saved = new SavedOutfit({
      userId,
      occasion: occasion ?? null,
      items,
      reasons: reasons ?? [],
      avatarRenderConfig: avatarRenderConfig ?? null,
    });

    await saved.save();
    return res.status(201).json(saved);
  } catch (err) {
    console.error('[SavedOutfit] POST error:', err);
    return res.status(500).json({ error: 'Failed to save outfit', detail: err?.message });
  }
});

// GET /api/saved — list user's saved outfits, newest first
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id?.toString() || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid auth payload' });
    }
    const outfits = await SavedOutfit.find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(outfits);
  } catch (err) {
    console.error('[SavedOutfit] GET error:', err);
    return res.status(500).json({ error: 'Failed to fetch saved outfits' });
  }
});

// DELETE /api/saved/:id — delete a saved outfit
router.delete('/:id', auth, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id?.toString() || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid auth payload' });
    }
    const outfit = await SavedOutfit.findOne({
      _id: req.params.id,
      userId,
    });

    if (!outfit) {
      return res.status(404).json({ error: 'Not found' });
    }

    await outfit.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    console.error('[SavedOutfit] DELETE error:', err);
    return res.status(500).json({ error: 'Failed to delete saved outfit' });
  }
});

module.exports = router;
