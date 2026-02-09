const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const Wardrobe = require('../models/wardrobe');
const { analyzeImage } = require('../services/imageAnalysisProvider');
const { generateFashionMetadata } = require('../services/llmFashionTagger');
const { upload } = require('../middleware/uploadValidation');
const {
  uploadBufferToR2,
  generateRawKey,
  deleteFromR2,
  getConfig,
} = require('../services/r2Storage');
const aiService = require('../services/aiServiceClient');

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
      aiService.safeLog('Wardrobe', 'Analyzing image', { userId, hasImageUrl: !!imageUrl });
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
    aiService.safeLog('Wardrobe', 'POST /analyze error', {
      message: (err?.message || '').slice(0, 150),
    });
    return res
      .status(500)
      .json({ message: 'Failed to analyze wardrobe image' });
  }
});

// POST /api/wardrobe/upload — v2: multipart upload; file size + mime allowlist; persist ONLY cleaned image URL; never store raw permanently
router.post('/upload', auth, upload.single('image'), async (req, res, next) => {
  let rawKey = null;
  try {
    if (!req.file) {
      const err = new Error('No image file provided');
      err.status = 400;
      return next(err);
    }
    const userId =
      req.user?.userId ||
      req.user?._id?.toString() ||
      req.user?.id ||
      req.user?._id;
    if (!userId) {
      const err = new Error('Invalid auth payload');
      err.status = 401;
      return next(err);
    }
    const { key } = generateRawKey(userId, req.file.mimetype);
    rawKey = key;
    await uploadBufferToR2({ key, buffer: req.file.buffer, contentType: req.file.mimetype });
    const config = getConfig();
    const rawUrl = config ? `${config.publicBaseUrl}/${key}` : null;

    let pyResponse;
    try {
      pyResponse = await aiService.post('/process-item', { userId, rawKey, rawUrl });
    } catch (err) {
      aiService.safeLog('Wardrobe', 'Python /process-item unreachable', { code: err.code });
      await deleteFromR2({ key: rawKey });
      const e = new Error('AI service temporarily unavailable');
      e.status = 503;
      return next(e);
    }

    const { status, cleanKey, cleanUrl, profile, failReason } = pyResponse.data || {};
    if (status === 'failed') {
      await deleteFromR2({ key: rawKey });
      const e = new Error(failReason || 'Processing failed');
      e.status = 502;
      return next(e);
    }
    if (status !== 'ready' || !cleanUrl) {
      await deleteFromR2({ key: rawKey });
      const e = new Error('Invalid response from AI service');
      e.status = 502;
      return next(e);
    }

    const p = profile && typeof profile === 'object' ? profile : {};
    const item = await Wardrobe.create({
      userId,
      imageUrl: cleanUrl,
      cleanImageUrl: cleanUrl,
      profile: p,
      category: p.category || p.type || 'top',
      type: p.type || undefined,
      primaryColor: p.primaryColor || undefined,
    });
    await deleteFromR2({ key: rawKey });

    const doc = item.toObject();
    const out = {
      item: {
        id: doc._id.toString(),
        cleanImageUrl: doc.cleanImageUrl ?? doc.imageUrl,
        profile: doc.profile ?? null,
        category: doc.category,
        type: doc.type,
        primaryColor: doc.primaryColor,
        isFavorite: Boolean(doc.isFavorite),
        v2: doc.v2 || { userTags: [], overrides: null, availability: { status: 'available', reason: null, untilDate: null } },
      },
    };
    return res.status(201).json(out);
  } catch (err) {
    if (rawKey) {
      try {
        await deleteFromR2({ key: rawKey });
      } catch (_) {}
    }
    next(err);
  }
});

// POST /api/wardrobe/items — v1 pipeline: upload RAW → Python process-item → create wardrobe → delete RAW
// JWT required. Server-to-server only: Node calls Python; do not expose AI_SERVICE_URL to client.
// Rate-limit: consider adding express-rate-limit for this endpoint.
router.post('/items', auth, upload.single('image'), async (req, res) => {
  let rawKey = null;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const userId =
      req.user?.userId ||
      req.user?._id?.toString() ||
      req.user?.id ||
      req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid auth payload' });
    }

    // a) Upload RAW to R2
    const { key } = generateRawKey(userId, req.file.mimetype);
    rawKey = key;
    await uploadBufferToR2({
      key,
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
    });

    const config = getConfig();
    const rawUrl = config ? `${config.publicBaseUrl}/${key}` : null;

    // b) Call Python /process-item (with retries via shared client)
    let pyResponse;
    try {
      pyResponse = await aiService.post('/process-item', { userId, rawKey, rawUrl });
    } catch (err) {
      aiService.safeLog('Wardrobe', 'Python /process-item unreachable after retries', {
        code: err.code,
        status: err.response?.status,
      });
      await deleteFromR2({ key: rawKey });
      return res.status(503).json({
        message: 'AI service temporarily unavailable. Please try again.',
        failReason: 'Could not reach the image processing service after multiple attempts.',
      });
    }

    const { status, cleanKey, cleanUrl, profile, failReason } = pyResponse.data || {};

    // f) If failed
    if (status === 'failed') {
      await deleteFromR2({ key: rawKey });
      return res.status(502).json({
        message: 'Processing failed',
        failReason: failReason || 'Unknown error',
      });
    }

    // e) If ready: create wardrobe item, delete RAW
    if (status !== 'ready' || !cleanUrl) {
      await deleteFromR2({ key: rawKey });
      return res.status(502).json({
        message: 'Invalid response from AI service',
        failReason: failReason || 'Missing cleanUrl or status',
      });
    }

    // v1: store profile as-is (locked schema); set convenience fields; no legacy fields
    const p = profile && typeof profile === 'object' ? profile : {};
    const item = await Wardrobe.create({
      userId,
      imageUrl: cleanUrl,
      cleanImageUrl: cleanUrl,
      profile: p,
      category: p.category || p.type || 'top',
      type: p.type || undefined,
      primaryColor: p.primaryColor || undefined,
    });

    // Delete RAW (best-effort)
    await deleteFromR2({ key: rawKey });

    return res.status(201).json(item);
  } catch (err) {
    if (rawKey) {
      try {
        await deleteFromR2({ key: rawKey });
      } catch (_) {}
    }
    aiService.safeLog('Wardrobe', 'POST /items error', {
      message: (err?.message || '').slice(0, 150),
    });
    return res.status(500).json({ message: err.message || 'Failed to process item' });
  }
});

// Multer/upload error handler — pass to central error handler with status
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    err.status = 413;
    err.message = 'File size exceeds limit';
  }
  if (err.message && (err.message.includes('Only jpeg') || err.message.includes('File size'))) {
    err.status = err.status || 415;
  }
  next(err);
});

// POST /api/wardrobe — DEPRECATED: use POST /api/wardrobe/items for v1 pipeline (upload → process → create)
// Kept for backward compatibility with clients that POST JSON with imageUrl/cleanImageUrl.
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

// GET /api/wardrobe — default excludes v2.availability.status="unavailable"; ?includeUnavailable=true includes them
router.get('/', auth, async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?._id?.toString() || req.user?.id || req.user?._id;
    if (!userId) {
      const err = new Error('Invalid auth payload');
      err.status = 401;
      return next(err);
    }
    const includeUnavailable = req.query.includeUnavailable === 'true';
    const query = { userId };
    if (!includeUnavailable) {
      query.$or = [
        { 'v2.availability.status': 'available' },
        { 'v2.availability.status': { $exists: false } },
        { 'v2.availability': { $exists: false } },
        { v2: { $exists: false } },
      ];
    }
    const items = await Wardrobe.find(query).sort({ createdAt: -1 }).lean().exec();
    const normalized = items.map((item) => ({
      id: item._id.toString(),
      cleanImageUrl: item.cleanImageUrl ?? item.imageUrl ?? null,
      profile: item.profile ?? null,
      category: item.category ?? null,
      type: item.type ?? null,
      primaryColor: item.primaryColor ?? null,
      isFavorite: Boolean(item.isFavorite),
      v2: item.v2
        ? {
            userTags: item.v2.userTags || [],
            overrides: item.v2.overrides ?? null,
            availability: item.v2.availability
              ? {
                  status: item.v2.availability.status || 'available',
                  reason: item.v2.availability.reason ?? null,
                  untilDate: item.v2.availability.untilDate ?? null,
                }
              : { status: 'available', reason: null, untilDate: null },
          }
        : { userTags: [], overrides: null, availability: { status: 'available', reason: null, untilDate: null } },
    }));
    return res.json({ items: normalized });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/wardrobe/:id/v2 — update ONLY v2 overlay (userTags, overrides, availability)
router.patch('/:id/v2', auth, async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?._id?.toString() || req.user?.id || req.user?._id;
    if (!userId) {
      const err = new Error('Invalid auth payload');
      err.status = 401;
      return next(err);
    }
    const { id } = req.params;
    const { userTags, overrides, availability } = req.body || {};
    const item = await Wardrobe.findOne({ _id: id, userId });
    if (!item) {
      const err = new Error('Wardrobe item not found');
      err.status = 404;
      return next(err);
    }
    if (!item.v2) item.v2 = { userTags: [], overrides: null, availability: { status: 'available', reason: null, untilDate: null } };
    if (Array.isArray(userTags)) item.v2.userTags = userTags;
    if (overrides !== undefined && overrides !== null && typeof overrides === 'object') item.v2.overrides = overrides;
    if (availability && typeof availability === 'object') {
      if (availability.status === 'available' || availability.status === 'unavailable') item.v2.availability.status = availability.status;
      if (availability.reason === 'laundry' || availability.reason === 'packed' || availability.reason === null) item.v2.availability.reason = availability.reason;
      if (availability.untilDate === null || (typeof availability.untilDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(availability.untilDate))) item.v2.availability.untilDate = availability.untilDate;
    }
    await item.save();
    const doc = item.toObject();
    res.status(200).json({
      item: {
        id: doc._id.toString(),
        cleanImageUrl: doc.cleanImageUrl ?? doc.imageUrl,
        profile: doc.profile ?? null,
        category: doc.category,
        type: doc.type,
        primaryColor: doc.primaryColor,
        isFavorite: Boolean(doc.isFavorite),
        v2: doc.v2 || { userTags: [], overrides: null, availability: { status: 'available', reason: null, untilDate: null } },
      },
    });
  } catch (err) {
    if (err.name === 'CastError') {
      err.status = 400;
      err.message = 'Invalid wardrobe item ID';
    }
    next(err);
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
