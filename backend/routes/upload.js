const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const { upload } = require('../middleware/uploadValidation');
const {
  uploadBufferToR2,
  generateRawKey,
  getConfig,
} = require('../services/r2Storage');

const router = express.Router();

// POST /api/upload/image — v1 pipeline: upload RAW to R2, return rawKey/rawUrl (no cleanUrl)
// JWT required. Rate-limit: consider adding express-rate-limit for upload endpoints.
router.post('/image', auth, upload.single('image'), async (req, res) => {
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

    const { key } = generateRawKey(userId, req.file.mimetype);
    await uploadBufferToR2({
      key,
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
    });

    const config = getConfig();
    const rawUrl = config ? `${config.publicBaseUrl}/${key}` : null;

    console.log('[Upload] v1 RAW uploaded for user', userId, 'key', key);

    return res.status(200).json({
      rawKey: key,
      rawUrl,
      contentType: req.file.mimetype,
      size: req.file.size,
    });
  } catch (err) {
    console.error('[Upload] R2 upload failed:', err.message || err);
    return res.status(500).json({ message: 'Upload failed' });
  }
});

// Error handler for multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size exceeds 5 MB limit' });
    }
    return res.status(400).json({ message: err.message || 'File upload error' });
  }
  if (err.message && err.message.includes('Only jpeg')) {
    return res.status(400).json({ message: err.message });
  }
  next(err);
});

module.exports = router;
