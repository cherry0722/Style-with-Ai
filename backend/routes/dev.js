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

const DEV_SEED_MARKER = '__dev_seed__';

const DUMMY_ITEMS = [
  {
    category: 'tops',
    type: 'T-Shirt',
    primaryColor: 'white',
    imageUrl: 'https://placehold.co/400x600/ffffff/cccccc?text=White+Tee',
    profile: { category: 'tops', type: 'T-Shirt', primaryColor: 'white', secondaryColors: [], style: ['casual'], fit: 'regular', material: 'cotton', pattern: 'solid', season: ['spring', 'summer', 'fall'], occasions: ['casual', 'college'], tags: [] },
  },
  {
    category: 'tops',
    type: 'Button-Down Shirt',
    primaryColor: 'light blue',
    imageUrl: 'https://placehold.co/400x600/add8e6/888888?text=Blue+Shirt',
    profile: { category: 'tops', type: 'Button-Down Shirt', primaryColor: 'light blue', secondaryColors: [], style: ['smart casual'], fit: 'regular', material: 'cotton', pattern: 'solid', season: ['spring', 'summer', 'fall'], occasions: ['casual', 'college', 'date'], tags: [] },
  },
  {
    category: 'tops',
    type: 'Hoodie',
    primaryColor: 'grey',
    imageUrl: 'https://placehold.co/400x600/888888/ffffff?text=Grey+Hoodie',
    profile: { category: 'tops', type: 'Hoodie', primaryColor: 'grey', secondaryColors: [], style: ['streetwear'], fit: 'oversized', material: 'fleece', pattern: 'solid', season: ['fall', 'winter'], occasions: ['casual', 'college'], tags: [] },
  },
  {
    category: 'bottoms',
    type: 'Jeans',
    primaryColor: 'dark blue',
    imageUrl: 'https://placehold.co/400x600/00008b/ffffff?text=Dark+Jeans',
    profile: { category: 'bottoms', type: 'Jeans', primaryColor: 'dark blue', secondaryColors: [], style: ['casual', 'smart casual'], fit: 'slim', material: 'denim', pattern: 'solid', season: ['all'], occasions: ['casual', 'college', 'date'], tags: [] },
  },
  {
    category: 'bottoms',
    type: 'Chinos',
    primaryColor: 'beige',
    imageUrl: 'https://placehold.co/400x600/f5f5dc/888888?text=Beige+Chinos',
    profile: { category: 'bottoms', type: 'Chinos', primaryColor: 'beige', secondaryColors: [], style: ['smart casual'], fit: 'slim', material: 'cotton', pattern: 'solid', season: ['spring', 'summer', 'fall'], occasions: ['casual', 'college', 'date'], tags: [] },
  },
  {
    category: 'bottoms',
    type: 'Shorts',
    primaryColor: 'khaki',
    imageUrl: 'https://placehold.co/400x600/c3b091/ffffff?text=Khaki+Shorts',
    profile: { category: 'bottoms', type: 'Shorts', primaryColor: 'khaki', secondaryColors: [], style: ['casual'], fit: 'regular', material: 'cotton', pattern: 'solid', season: ['spring', 'summer'], occasions: ['casual', 'college'], tags: [] },
  },
  {
    category: 'shoes',
    type: 'Sneakers',
    primaryColor: 'white',
    imageUrl: 'https://placehold.co/400x300/ffffff/cccccc?text=White+Sneakers',
    profile: { category: 'shoes', type: 'Sneakers', primaryColor: 'white', secondaryColors: [], style: ['casual', 'streetwear'], fit: 'regular', material: 'leather', pattern: 'solid', season: ['all'], occasions: ['casual', 'college', 'party'], tags: [] },
  },
  {
    category: 'shoes',
    type: 'Chelsea Boots',
    primaryColor: 'black',
    imageUrl: 'https://placehold.co/400x300/111111/ffffff?text=Black+Boots',
    profile: { category: 'shoes', type: 'Chelsea Boots', primaryColor: 'black', secondaryColors: [], style: ['smart casual'], fit: 'regular', material: 'leather', pattern: 'solid', season: ['fall', 'winter'], occasions: ['date', 'party', 'college'], tags: [] },
  },
  {
    category: 'outerwear',
    type: 'Bomber Jacket',
    primaryColor: 'olive',
    imageUrl: 'https://placehold.co/400x600/6b7c3a/ffffff?text=Olive+Bomber',
    profile: { category: 'outerwear', type: 'Bomber Jacket', primaryColor: 'olive', secondaryColors: [], style: ['streetwear', 'casual'], fit: 'regular', material: 'nylon', pattern: 'solid', season: ['fall', 'spring'], occasions: ['casual', 'college', 'party'], tags: [] },
  },
  {
    category: 'outerwear',
    type: 'Denim Jacket',
    primaryColor: 'medium blue',
    imageUrl: 'https://placehold.co/400x600/6080a0/ffffff?text=Denim+Jacket',
    profile: { category: 'outerwear', type: 'Denim Jacket', primaryColor: 'medium blue', secondaryColors: [], style: ['casual'], fit: 'regular', material: 'denim', pattern: 'solid', season: ['spring', 'fall'], occasions: ['casual', 'college', 'date'], tags: [] },
  },
];

/**
 * POST /api/dev/wardrobe/seed
 *
 * Inserts dummy wardrobe items for the authenticated user.
 * Items are tagged with notes: '__dev_seed__' for safe cleanup.
 * Safe to call multiple times — always inserts a fresh batch.
 */
router.post('/wardrobe/seed', auth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Invalid auth payload' });

    const docs = DUMMY_ITEMS.map(item => ({
      userId,
      imageUrl: item.imageUrl,
      category: item.category,
      type: item.type,
      primaryColor: item.primaryColor,
      profile: item.profile,
      notes: DEV_SEED_MARKER,
      v2: { availability: { status: 'available' } },
    }));

    const inserted = await Wardrobe.insertMany(docs);
    return res.status(201).json({ seeded: inserted.length, ids: inserted.map(i => i._id.toString()) });
  } catch (error) {
    console.error('[Dev] Error in POST /wardrobe/seed:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

/**
 * DELETE /api/dev/wardrobe/seed
 *
 * Removes only the dummy seeded items (notes === '__dev_seed__') for the authenticated user.
 * Never touches real wardrobe items.
 */
router.delete('/wardrobe/seed', auth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Invalid auth payload' });

    const result = await Wardrobe.deleteMany({ userId, notes: DEV_SEED_MARKER });
    return res.status(200).json({ deleted: result.deletedCount });
  } catch (error) {
    console.error('[Dev] Error in DELETE /wardrobe/seed:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

module.exports = router;

