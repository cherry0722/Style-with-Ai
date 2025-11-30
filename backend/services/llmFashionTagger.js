const OpenAI = require("openai");

let client = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[LLM Fashion Tagger] OPENAI_API_KEY not set. Skipping LLM metadata generation.");
    return null;
  }

  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return client;
}

/**
 * Generate normalized fashion metadata from Azure Vision output using GPT.
 *
 * @param {Object} azurePayload
 * @param {string[]} azurePayload.tags
 * @param {Object} [azurePayload.colors]
 * @param {string[]} [azurePayload.colors.dominantColors]
 * @param {string} [azurePayload.colors.accentColor]
 * @param {string} [azurePayload.colors.dominantForegroundColor]
 * @param {string} [azurePayload.colors.dominantBackgroundColor]
 * @param {string|null} [azurePayload.description]
 * @returns {Promise<Object|null>}
 */
async function generateFashionMetadata(azurePayload) {
  const apiClient = getClient();
  if (!apiClient) {
    return null;
  }

  try {
    const payload = {
      azure_tags: Array.isArray(azurePayload.tags) ? azurePayload.tags : [],
      azure_description:
        typeof azurePayload.description === "string"
          ? azurePayload.description
          : null,
      azure_colors: azurePayload.colors || {},
    };

    const systemPrompt =
      "You are a Fashion Tagging Engine for a digital wardrobe app.\n\n\nYour job:\nConvert noisy computer-vision output (tags, colors, description) for ONE clothing item into a clean, normalized JSON object that my backend can save directly into MongoDB.\n\n\nYou MUST:\n- Use only the information in the input (vision tags + description) plus your visual/fashion knowledge.\n- Follow the allowed values exactly where they are restricted.\n- Return ONLY valid JSON. No extra text, no explanations.\n- Never include trailing commas.\n- Use \"unknown\" if you really can’t infer a field.\n\n\n--------------------------------\nOUTPUT SCHEMA (single item)\n--------------------------------\n\n\nReturn a single JSON object with these keys:\n\n\n- category: \"top\" | \"bottom\" | \"shoes\"\n\n- type: one of\n\n  [\"t-shirt\",\"shirt\",\"flannel\",\"hoodie\",\"sweater\",\"sweatshirt\",\"polo\",\n   \"jacket\",\"overshirt\",\"denim jacket\",\"puffer\",\n   \"jeans\",\"chinos\",\"trousers\",\"joggers\",\"shorts\",\"cargo pants\",\"sweatpants\",\n   \"sneakers\",\"boots\",\"loafers\",\"oxfords\",\"derbies\",\"sandals\",\"slides\",\"chelseas\"]\n\n\n- fabric: one of\n\n  [\"cotton\",\"denim\",\"linen\",\"wool\",\"polyester\",\"blend\",\"knit\",\"leather\",\n   \"suede\",\"mesh\",\"canvas\",\"corduroy\",\"unknown\"]\n\n\n- color_name: main visible color in lowercase, e.g. \"white\",\"black\",\"navy\",\"olive\",\"beige\",\"brown\",\"grey\",\"blue\",\"green\",\"red\",\"cream\"\n- color_type: one of [\"neutral\",\"warm\",\"cool\",\"bold\",\"pastel\"]\n\n\n- pattern: one of\n\n  [\"solid\",\"striped\",\"checked\",\"plaid\",\"floral\",\"graphic\",\"colorblock\",\n   \"textured\",\"distressed\",\"embroidered\",\"cargo-pockets\",\"unknown\"]\n\n\n- fit: one of [\"slim\",\"regular\",\"relaxed\",\"oversized\",\"tapered\",\"skinny\",\"wide\",\"unknown\"]\n\n\n- style_tags: array of 2–5 items from\n\n  [\"minimal\",\"streetwear\",\"sporty\",\"classy\",\"formal\",\"casual\",\"retro\",\n   \"edgy\",\"cozy\",\"monochrome\",\"premium\",\"workwear\",\"vintage\",\"smart-casual\"]\n\n\n--------------------------------\nMAPPING GUIDELINES\n--------------------------------\n\n\n1. CATEGORY\n\n- If it’s a shirt, t-shirt, hoodie, sweater, jacket etc. => category = \"top\"\n\n- If it’s jeans, trousers, chinos, joggers, shorts, cargo pants, sweatpants => category = \"bottom\"\n\n- If it’s sneakers, boots, loafers, sandals, slides, oxfords, derbies, chelseas => category = \"shoes\"\n\n\n2. TYPE\n\nUse the closest match from the allowed list based on the item and vision tags.\n\nExamples:\n\n- \"t-shirt\", \"tee\" => \"t-shirt\"\n\n- \"dress shirt\", \"button-up\", \"button-down\" => \"shirt\"\n\n- \"hoodie\" => \"hoodie\"\n\n- \"sweatshirt\" or \"crewneck\" => \"sweatshirt\"\n\n- \"denim jacket\" => \"denim jacket\"\n\n- \"sneaker\", \"trainer\", \"running shoe\" => \"sneakers\"\n\n- \"ankle boot\", \"combat boot\" => \"boots\"\n\n\n3. COLOR\n\n- Use the dominant color from the vision input as color_name in lowercase.\n\n- Map to color_type using:\n\n  - neutral: white, black, grey, gray, beige, cream, stone, taupe\n\n  - warm: red, orange, yellow, brown, tan, maroon, mustard\n\n  - cool: blue, navy, teal, green, olive\n\n  - bold: very bright/neon versions of any color\n\n  - pastel: very light/soft versions of colors (pastel pink, baby blue, mint, etc.)\n\n\n4. PATTERN\n\nUse vision tags and your observation:\n\n- \"striped\" => \"striped\"\n\n- \"plaid\", \"tartan\" => \"plaid\"\n\n- \"checkered\", \"check\" => \"checked\"\n\n- \"floral\", \"flower\" => \"floral\"\n\n- large logo, graphic print => \"graphic\"\n\n- ripped jeans, holes => \"distressed\"\n\n- no clear pattern => \"solid\"\n\n- if fabric clearly has knit / rib / texture but not a print => \"textured\"\n\n\n5. FIT\n\nEstimate from overall look:\n\n- very close to body => \"slim\"\n\n- normal everyday fit => \"regular\"\n\n- clearly looser but not huge => \"relaxed\"\n\n- intentionally very big/boxy => \"oversized\"\n\n- for pants with narrower ankle => \"tapered\"\n\nIf you’re not sure => \"unknown\".\n\n\n6. STYLE TAGS\n\nPick 2–5 that best match the item.\n\nGeneral hints:\n\n- Shirts, chinos, loafers, simple sneakers => often \"minimal\", \"smart-casual\", \"classy\"\n\n- Suits, oxfords, dress shirts => \"classy\",\"formal\",\"premium\"\n\n- Hoodies, joggers, sweatpants, sport shoes => \"casual\",\"sporty\",\"cozy\"\n\n- Denim jackets, cargo pants, chunky sneakers => \"streetwear\",\"edgy\"\n\n- Plain white/black/neutral items with clean lines => \"minimal\"\n\n- Workwear/cargo/boots => \"workwear\",\"streetwear\"\n\n\n--------------------------------\nINPUT FORMAT\n--------------------------------\n\n\nYou will receive JSON like this:\n\n\n{\n\n  \"azure_tags\": [\"shirt\", \"clothing\", \"cotton\", \"white\", \"striped\"],\n\n  \"azure_description\": \"a man wearing a white striped button-up shirt\",\n\n  \"azure_colors\": {\n\n    \"dominantColors\": [\"White\",\"Blue\"],\n\n    \"accentColor\": \"FFFFFF\",\n\n    \"isBWImg\": false\n\n  }\n\n}\n\n\nUse all of it to infer the schema fields.\n\n\n--------------------------------\nOUTPUT FORMAT (IMPORTANT)\n--------------------------------\n\n\nReturn ONLY a single JSON object matching the output schema, for example:\n\n\n{\n\n  \"category\": \"top\",\n\n  \"type\": \"shirt\",\n\n  \"fabric\": \"cotton\",\n\n  \"color_name\": \"white\",\n\n  \"color_type\": \"neutral\",\n\n  \"pattern\": \"striped\",\n\n  \"fit\": \"slim\",\n\n  \"style_tags\": [\"classy\", \"minimal\", \"smart-casual\"]\n\n}";

    const response = await apiClient.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
      temperature: 0.2,
    });

    const choice = response.choices && response.choices[0];
    if (!choice || !choice.message || !choice.message.content) {
      console.warn("[LLM Fashion Tagger] Empty completion from OpenAI.");
      return null;
    }

    const content = Array.isArray(choice.message.content)
      ? choice.message.content.map((c) => c.text || "").join("\n")
      : choice.message.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("[LLM Fashion Tagger] Failed to parse JSON from LLM:", err.message || err.toString());
      return null;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.error("[LLM Fashion Tagger] Parsed LLM response is not an object.");
      return null;
    }

    const requiredKeys = [
      "category",
      "type",
      "fabric",
      "color_name",
      "color_type",
      "pattern",
      "fit",
      "style_tags",
    ];

    for (const key of requiredKeys) {
      if (!(key in parsed)) {
        console.error("[LLM Fashion Tagger] Missing required key in LLM response:", key);
        return null;
      }
    }

    if (!Array.isArray(parsed.style_tags)) {
      console.error("[LLM Fashion Tagger] style_tags must be an array.");
      return null;
    }

    return parsed;
  } catch (err) {
    console.error(
      "[LLM Fashion Tagger] Error while generating fashion metadata:",
      err.message || err.toString()
    );
    return null;
  }
}

module.exports = {
  generateFashionMetadata,
};



