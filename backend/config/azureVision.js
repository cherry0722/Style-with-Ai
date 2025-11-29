/**
 * Azure Computer Vision configuration helper
 * Reads environment variables and returns configuration object
 */

let hasWarned = false;

const DEFAULT_API_VERSION = '2024-02-01';

function getAzureVisionConfig() {
  const endpoint = process.env.AZURE_VISION_ENDPOINT;
  const key = process.env.AZURE_VISION_KEY;
  const apiVersion = process.env.AZURE_VISION_API_VERSION || DEFAULT_API_VERSION;

  const enabled = Boolean(endpoint && key);

  // One-time warning if disabled
  if (!enabled && !hasWarned) {
    console.warn('[AzureVision] Disabled: AZURE_VISION_ENDPOINT or AZURE_VISION_KEY not set');
    hasWarned = true;
  }

  return {
    enabled,
    endpoint,
    key,
    apiVersion,
  };
}

module.exports = { getAzureVisionConfig };

