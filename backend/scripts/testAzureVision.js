// backend/scripts/testAzureVision.js
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

const { analyzeImage } = require("../services/azureVisionService");

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error("Usage: node testAzureVision.js <image-url>");
    process.exit(1);
  }

  console.log("[Test] Starting Azure Vision analysis test...");
  console.log("[Test] Image URL:", url);

  try {
    const result = await analyzeImage(url);

    if (!result) {
      console.log("[Test] No result (null). Azure Vision is disabled or failed.");
      process.exit(0);
    }

    console.log("\n=== Azure Vision Result ===");
    console.log("Tags:", result.tags);
    console.log("Colors:", result.colors);
    console.log("===========================");
  } catch (err) {
    console.error("[Test] Error running test:", err.message || err);
  }
}

main();

