const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const { uploadBuffer } = require('../services/r2Storage');

const router = express.Router();

// Multer memory storage so we get file.buffer for R2
const storage = multer.memoryStorage();

// File filter - only accept images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

/** Map mimetype to file extension for R2 key. */
function extFromMimetype(mimetype) {
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[mimetype] || 'jpg';
}

// POST /api/upload/image - upload an image file to R2, return public URL
router.post('/image', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const ext = extFromMimetype(req.file.mimetype);
    const key = `images/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;

    const publicUrl = await uploadBuffer({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      key,
    });

    const userId = req.user?.userId || req.user?._id?.toString() || req.user?.id || req.user?._id;
    console.log('[Upload] R2 upload OK for user', userId, 'key', key);

    return res.status(200).json({
      imageUrl: publicUrl,
      cleanImageUrl: null,
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

  if (err.message === 'Only image files are allowed') {
    return res.status(400).json({ message: 'Only image files are allowed' });
  }

  next(err);
});

module.exports = router;
