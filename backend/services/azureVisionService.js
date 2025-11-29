const axios = require("axios");

const { getAzureVisionConfig } = require("../config/azureVision");

/**
 * Determine if a URL points to a local/private host that Azure cannot reach directly.
 * For these URLs we will fetch the bytes from the backend and send them as a binary payload.
 */
function isLocalUrl(url) {
  if (!url || typeof url !== "string") return false;

  const lower = url.toLowerCase();

  if (
    lower.startsWith("http://localhost") ||
    lower.startsWith("https://localhost") ||
    lower.startsWith("http://127.0.0.1") ||
    lower.startsWith("https://127.0.0.1") ||
    lower.startsWith("http://192.168.") ||
    lower.startsWith("http://10.")
  ) {
    return true;
  }

  // 172.16.0.0 – 172.31.255.255 private range
  // We only need to detect the host; protocol is assumed http
  const private172 = /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./;
  if (private172.test(lower)) {
    return true;
  }

  return false;
}

/**
 * Analyze an image using Azure Computer Vision v3.2 "analyze" endpoint.
 *
 * This uses:
 *   POST {endpoint}/vision/v3.2/analyze?visualFeatures=Tags,Color&language=en
 * with either:
 *   - JSON body { url: imageUrl }   for public URLs
 *   - Binary body <image-bytes>     for local/private URLs
 *
 * Returns:
 *   {
 *     tags: string[],
 *     colors: {
 *       dominantColors?: string[],
 *       accentColor?: string,
 *       dominantForegroundColor?: string,
 *       dominantBackgroundColor?: string,
 *     }
 *   }
 * or null on failure.
 */
async function analyzeImage(imageUrl) {
  const config = getAzureVisionConfig();

  if (!config.enabled) {
    console.log("[AzureVision] Disabled (missing endpoint or key)");
    return null;
  }

  if (!imageUrl) {
    console.log("[AzureVision] No imageUrl provided, skipping analysis");
    return null;
  }

  try {
    const baseEndpoint = config.endpoint.replace(/\/+$/, "");
    const url =
      baseEndpoint +
      "/vision/v3.2/analyze?visualFeatures=Tags,Color&language=en";

    console.log("[AzureVision] Calling v3.2 analyze endpoint:", url);
    let response;

    if (!isLocalUrl(imageUrl)) {
      // Public URL that Azure can reach directly - send JSON body
      const headers = {
        "Ocp-Apim-Subscription-Key": config.key,
        "Content-Type": "application/json",
      };

      const body = {
        url: imageUrl,
      };

      response = await axios.post(url, body, {
        headers,
        timeout: 10000,
      });
    } else {
      // Local/private URL - fetch bytes from backend and send as binary
      console.log(
        "[AzureVision] Using binary payload for local URL:",
        imageUrl
      );

      const imageResponse = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 10000,
      });

      const imageBuffer = Buffer.from(imageResponse.data);

      const headers = {
        "Ocp-Apim-Subscription-Key": config.key,
        "Content-Type": "application/octet-stream",
      };

      response = await axios.post(url, imageBuffer, {
        headers,
        timeout: 10000,
      });
    }

    const data = response.data || {};
    console.log("[AzureVision] Raw analyze response received");

    // Extract tags
    const tags =
      Array.isArray(data.tags) && data.tags.length > 0
        ? data.tags
            .filter((t) => t && t.name)
            .map((t) => String(t.name).toLowerCase())
        : [];

    // Extract colors
    const colorInfo = data.color || {};
    const collectedColors = [];

    if (Array.isArray(colorInfo.dominantColors)) {
      colorInfo.dominantColors.forEach((c) => {
        if (c) {
          collectedColors.push(String(c).toLowerCase());
        }
      });
    }

    if (colorInfo.dominantForegroundColor) {
      collectedColors.push(
        String(colorInfo.dominantForegroundColor).toLowerCase()
      );
    }

    if (colorInfo.dominantBackgroundColor) {
      collectedColors.push(
        String(colorInfo.dominantBackgroundColor).toLowerCase()
      );
    }

    if (colorInfo.accentColor) {
      // Accent color is usually a hex-like string, still normalize
      collectedColors.push(String(colorInfo.accentColor).toLowerCase());
    }

    const uniqueColors = [...new Set(collectedColors)];

    const result = {
      tags,
      colors: {
        dominantColors: uniqueColors,
        accentColor: colorInfo.accentColor
          ? String(colorInfo.accentColor).toLowerCase()
          : undefined,
        dominantForegroundColor: colorInfo.dominantForegroundColor
          ? String(colorInfo.dominantForegroundColor).toLowerCase()
          : undefined,
        dominantBackgroundColor: colorInfo.dominantBackgroundColor
          ? String(colorInfo.dominantBackgroundColor).toLowerCase()
          : undefined,
      },
    };

    console.log(
      "[AzureVision] Parsed tags:",
      result.tags.slice(0, 10)
    );
    console.log(
      "[AzureVision] Parsed dominantColors:",
      result.colors.dominantColors
    );

    return result;
  } catch (err) {
    console.error(
      "[AzureVision] Error analyzing image:",
      err.message || err.toString()
    );

    if (err.response) {
      console.error("[AzureVision] Response status:", err.response.status);
      console.error(
        "[AzureVision] Response data:",
        JSON.stringify(err.response.data, null, 2)
      );
    }

    // IMPORTANT: do not throw, just return null so routes can continue
    return null;
  }
}

module.exports = {
  analyzeImage,
};
