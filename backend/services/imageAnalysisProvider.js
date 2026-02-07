/**
 * Provider-agnostic image analysis.
 * Contract: analyzeImage(imageUrl) -> null | { tags: string[], colors: object }
 * Route uses this to populate azure_tags / azure_colors; null means empty tags/colors.
 */
const PROVIDER = (process.env.IMAGE_ANALYSIS_PROVIDER || 'none').trim().toLowerCase();

/**
 * Analyze an image and return tags + colors (or null if disabled/failed).
 * @param {string} imageUrl - URL of the image to analyze
 * @returns {Promise<{ tags: string[], colors: object } | null>}
 */
async function analyzeImage(imageUrl) {
  if (PROVIDER === 'azure') {
    try {
      const { analyzeImage: azureAnalyzeImage } = require('./azureVisionService');
      return await azureAnalyzeImage(imageUrl);
    } catch (err) {
      console.warn('[imageAnalysisProvider] Provider unavailable: azure:', err.message || err);
      return null;
    }
  }
  return null;
}

module.exports = {
  analyzeImage,
};
