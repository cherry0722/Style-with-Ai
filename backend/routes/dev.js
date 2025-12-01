const express = require('express');
const auth = require('../middleware/auth');
const Wardrobe = require('../models/wardrobe');

const router = express.Router();

/**
 * Extract hostname from a URL string.
 * Returns null if URL is invalid or missing.
 */
function extractHost(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  try {
    const urlObj = new URL(url);
    // Return host (includes port if present)
    return urlObj.host;
  } catch (e) {
    // Invalid URL, return null
    return null;
  }
}

/**
 * GET /api/dev/wardrobe/summary
 * 
 * Dev-only endpoint to inspect wardrobe data for the logged-in user.
 * Returns summary statistics and item details including hostnames.
 */
router.get('/wardrobe/summary', auth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid auth payload' });
    }

    // Query all wardrobe items for this user
    const items = await Wardrobe.find({ userId }).lean();

    // Initialize aggregates
    const byCategory = {};
    const byHost = {};
    const itemSummaries = [];

    // Process each item
    for (const item of items) {
      const id = item._id ? item._id.toString() : null;
      const category = item.category || null;
      const imageUrl = item.imageUrl || null;
      const host = imageUrl ? extractHost(imageUrl) : null;

      // Add to item summaries
      itemSummaries.push({
        id,
        category,
        imageUrl,
        host,
      });

      // Count by category
      const catKey = category || 'unknown';
      byCategory[catKey] = (byCategory[catKey] || 0) + 1;

      // Count by host (only count valid hosts)
      if (host) {
        byHost[host] = (byHost[host] || 0) + 1;
      }
    }

    // Build response
    const response = {
      totalItems: items.length,
      byCategory,
      byHost,
      items: itemSummaries,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('[Dev] Error in /wardrobe/summary:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
});

module.exports = router;

