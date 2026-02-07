let OpenAI = null;
let client = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[LLM Fashion Tagger] OPENAI_API_KEY not set. Skipping LLM metadata generation.");
    return null;
  }

  // Lazy load OpenAI module only when needed
  if (!OpenAI) {
    try {
      OpenAI = require("openai");
    } catch (err) {
      console.warn("[LLM Fashion Tagger] 'openai' module not installed. Install it with: npm install openai");
      return null;
    }
  }

  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return client;
}

/** Safe fallback when LLM fails or returns invalid JSON. Keeps API shape and never crashes. */
function getSafeFallback() {
  return {
    inferred_item: {
      category: "top",
      primary_color: "neutral",
      secondary_color: null,
      pattern: "solid",
      style_tags: ["casual", "minimal"],
      type: "t-shirt",
      fabric: "unknown",
      fit: "regular",
      color_type: "neutral",
    },
    outfit_suggestions: [
      {
        name: "Casual default",
        occasion: "everyday",
        items: ["casual top", "casual bottom", "sneakers", null],
        color_story: "neutral",
        notes: "No vision data available. Add or edit items as needed.",
      },
    ],
    confidence: 10,
    fallback_reason: "LLM response invalid or missing",
    // Legacy flat fields for frontend (FashionMetadata)
    category: "top",
    type: "t-shirt",
    fabric: "unknown",
    color_name: "neutral",
    color_type: "neutral",
    pattern: "solid",
    fit: "regular",
    style_tags: ["casual", "minimal"],
  };
}

/** Map inferred_item to legacy flat fields so existing frontend still works. */
function toLegacyShape(parsed) {
  const item = parsed.inferred_item || {};
  return {
    ...parsed,
    category: item.category,
    type: item.type,
    fabric: item.fabric,
    color_name: item.primary_color || item.color_name,
    color_type: item.color_type,
    pattern: item.pattern,
    fit: item.fit,
    style_tags: Array.isArray(item.style_tags) ? item.style_tags : [],
  };
}

/**
 * Generate normalized fashion metadata + outfit suggestions from vision/analysis output using GPT.
 * Works when vision tags/colors are empty: uses category_hint, color_hint if provided, else infers reasonable defaults.
 *
 * @param {Object} visionPayload
 * @param {string[]} [visionPayload.tags]
 * @param {Object} [visionPayload.colors]
 * @param {string|null} [visionPayload.description]
 * @param {string} [visionPayload.category_hint]
 * @param {string} [visionPayload.color_hint]
 * @returns {Promise<Object|null>}
 */
async function generateFashionMetadata(visionPayload) {
  const apiClient = getClient();
  if (!apiClient) {
    return getSafeFallback();
  }

  const tags = Array.isArray(visionPayload?.tags) ? visionPayload.tags : [];
  const colors = visionPayload?.colors || {};
  const description = typeof visionPayload?.description === "string" ? visionPayload.description : null;
  const categoryHint = typeof visionPayload?.category_hint === "string" ? visionPayload.category_hint.trim() : "";
  const colorHint = typeof visionPayload?.color_hint === "string" ? visionPayload.color_hint.trim() : "";

  const hasVision = tags.length > 0 || (colors && (colors.dominantColors?.length || colors.accentColor));
  const inputJson = JSON.stringify({
    tags,
    colors,
    description,
    category_hint: categoryHint || undefined,
    color_hint: colorHint || undefined,
  });

  const systemPrompt = `You are a Fashion Tagging Engine for a digital wardrobe app. You do NOT see the image; you only receive JSON input (tags, colors, optional hints).

Your job: From the input JSON, produce STRICT JSON only. No markdown, no code fences, no extra text before or after the JSON.

When tags and colors are empty: Use category_hint and color_hint if provided. Otherwise infer a versatile, neutral item (e.g. casual top in a common color) and suggest 3 outfits that could include it. Set confidence low (e.g. 30-50) and set fallback_reason to "no_vision_data".

When tags/colors are present: Infer the item and suggest 3 outfits. Set confidence 60-100. Omit fallback_reason or set it only if confidence < 50.

--------------------------------
OUTPUT SCHEMA (exactly this structure)
--------------------------------

Return a single JSON object with these keys only:

- inferred_item: object with:
  - category: "top" | "bottom" | "shoes"
  - primary_color: string (e.g. "white", "navy", "black")
  - secondary_color: string | null
  - pattern: "solid" | "striped" | "plaid" | "checked" | "graphic" | "unknown"
  - style_tags: array of 2-5 strings from ["minimal","streetwear","sporty","classy","formal","casual","retro","edgy","cozy","smart-casual"]
  - type: string (e.g. "t-shirt", "shirt", "jeans", "sneakers")
  - fabric: string (e.g. "cotton", "denim", "unknown")
  - fit: "slim" | "regular" | "relaxed" | "oversized" | "unknown"
  - color_type: "neutral" | "warm" | "cool" | "bold" | "pastel"

- outfit_suggestions: array of exactly 3 objects, each:
  - name: string (short outfit name)
  - occasion: string (e.g. "everyday", "work", "date night")
  - items: [top, bottom, shoes, optional_outerwear] (4 strings; use null for optional_outerwear if not needed)
  - color_story: string (e.g. "neutral monochrome", "navy and white")
  - notes: string (one line)

- confidence: number 0-100

- fallback_reason: string or null (only set when confidence < 50; e.g. "no_vision_data" or "low_confidence_inference")

--------------------------------
RULES
--------------------------------
- Return ONLY valid JSON. No \`\`\`json, no explanation.
- No trailing commas.
- Use "unknown" or null when unsure.
- inferred_item.style_tags must be an array of strings.
- outfit_suggestions must have exactly 3 elements.`;

  try {
    const response = await apiClient.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: inputJson },
      ],
      temperature: 0.2,
    });

    const choice = response.choices && response.choices[0];
    if (!choice || !choice.message || !choice.message.content) {
      console.warn("[LLM Fashion Tagger] Empty completion from OpenAI.");
      return toLegacyShape(getSafeFallback());
    }

    let content = choice.message.content;
    if (Array.isArray(content)) {
      content = content.map((c) => (c && c.text) || "").join("\n");
    }
    if (typeof content !== "string" || !content.trim()) {
      return toLegacyShape(getSafeFallback());
    }

    // Strip markdown code fence if present
    const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      console.warn("[LLM Fashion Tagger] Failed to parse JSON from LLM:", err.message || err);
      return toLegacyShape(getSafeFallback());
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn("[LLM Fashion Tagger] LLM response is not an object.");
      return toLegacyShape(getSafeFallback());
    }

    if (!parsed.inferred_item || typeof parsed.inferred_item !== "object") {
      console.warn("[LLM Fashion Tagger] Missing or invalid inferred_item.");
      return toLegacyShape(getSafeFallback());
    }

    if (!Array.isArray(parsed.outfit_suggestions)) {
      parsed.outfit_suggestions = getSafeFallback().outfit_suggestions;
    }

    if (typeof parsed.confidence !== "number") {
      parsed.confidence = 50;
    }

    return toLegacyShape(parsed);
  } catch (err) {
    console.warn("[LLM Fashion Tagger] Error generating metadata:", err.message || err);
    return toLegacyShape(getSafeFallback());
  }
}

module.exports = {
  generateFashionMetadata,
};
