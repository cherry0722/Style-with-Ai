const express = require('express');
const auth = require('../middleware/auth');
const OutfitHistory = require('../models/outfitHistory');

const router = express.Router();

function getUserId(req) {
  return req.user?.userId || req.user?._id?.toString() || req.user?.id || req.user?._id;
}

// GET /api/outfits?limit=50
router.get('/', auth, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      const err = new Error('Invalid auth payload');
      err.status = 401;
      return next(err);
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const docs = await OutfitHistory.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const outfits = docs.map((d) => ({
      id: d._id.toString(),
      occasion: d.occasion,
      context: d.context,
      engine: d.engine,
      pythonUsed: d.pythonUsed,
      pythonError: d.pythonError,
      items: d.items,
      lockedItemIds: d.lockedItemIds || [],
      reasons: d.reasons,
      tags: d.tags || [],
      createdAt: d.createdAt,
    }));
    res.status(200).json({ outfits });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
