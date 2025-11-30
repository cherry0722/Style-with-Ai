// backend/services/backgroundRemoval.js

/**
 * Stub for background removal.
 *
 * For now, this just returns the original image path and logs a TODO.
 * Later, we can integrate a real background removal provider here.
 *
 * @param {string} imagePath - Absolute or relative path to the saved image.
 * @returns {Promise<string>} - The path/URL to the background-removed image.
 */
async function removeBackground(imagePath) {
  console.log('[BG-Removal] Stub called with:', imagePath);
  // TODO: integrate real background removal API here
  // For now, just return the original path so the rest of the pipeline works.
  return imagePath;
}

module.exports = {
  removeBackground,
};

