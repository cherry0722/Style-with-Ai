/**
 * Shared upload validation for v1 pipeline.
 * MIME: jpeg, jpg, png, webp only (no gif for v1).
 * Max size: 5MB.
 */
const multer = require('multer');

const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only jpeg, jpg, png, webp images allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});

module.exports = {
  upload,
  ALLOWED_MIMES,
  MAX_SIZE,
};
