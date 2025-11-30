const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const { removeBackground } = require('../services/backgroundRemoval');

const router = express.Router();

// Ensure uploads/images directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'images');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.userId || 'unknown';
    const timestamp = Date.now();
    // Sanitize original filename - remove special characters, keep extension
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const filename = `${userId}_${timestamp}_${baseName}${ext}`;
    cb(null, filename);
  },
});

// File filter - only accept images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Configure multer with limits
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

// POST /api/upload/image - upload an image file
router.post('/image', auth, upload.single('image'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    // Build public URL
    const protocol = req.protocol;
    const host = req.get('host');
    const filename = req.file.filename;
    const imageUrl = `${protocol}://${host}/uploads/images/${filename}`;

    // Try to get background-removed version (stub for now)
    let cleanImageUrl = null;
    try {
      // For now, pass imageUrl to the stub; later we can pass the filesystem path
      const bgRemovedPathOrUrl = await removeBackground(imageUrl);
      cleanImageUrl = bgRemovedPathOrUrl || null;
    } catch (err) {
      console.warn('[BG-Removal] Failed to remove background:', err.message || err.toString());
      cleanImageUrl = null;
    }

    return res.status(200).json({
      imageUrl,
      cleanImageUrl, // may be null
    });
  } catch (err) {
    console.error('[Upload] POST /api/upload/image error:', err);
    return res.status(500).json({ message: 'Failed to upload image' });
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

