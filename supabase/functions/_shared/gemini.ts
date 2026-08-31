// Shared helper for calling Google's Gemini API directly. This REPLACES the
// old dependency on Lovable's proprietary AI gateway (ai.gateway.lovable.dev
// with LOVABLE_API_KEY), which stopped being reachable once this project was
// migrated off Lovable's hosting - calls to it were hanging until Supabase's
// platform timeout killed the function (504 to the client). GEMINI_API_KEY
// is already configured and confirmed working elsewhere in this project
// (the narrated-video pipeline), so every AI-generation function now uses it
// directly instead.

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

export interface GeminiTextOptions {
  systemPrompt?: string;
  userPrompt: string;
  /** OpenAPI-subset JSON schema. When provided, Gemini is constrained to
   * return JSON matching this shape instead of free-form text. */
  jsonSchema?: Record<string, unknown>;
  temperature?: number;
}

/** Calls Gemini for a text (optionally structured-JSON) response. Returns
 * the raw text - caller does JSON.parse() themselves when jsonSchema was used. */
export async function callGeminiText(apiKey: string, options: GeminiTextOptions): Promise<string> {
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: options.userPrompt }] }],
  };

  if (options.systemPrompt) {
    body.systemInstruction = { parts: [{ text: options.systemPrompt }] };
  }

  const generationConfig: Record<string, unknown> = {};
  if (options.temperature != null) generationConfig.temperature = options.temperature;
  if (options.jsonSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = options.jsonSchema;
  }
  if (Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig;
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 429) {
      throw new GeminiApiError("Rate limits exceeded, please try again later.", 429);
    }
    throw new GeminiApiError(`Gemini API error [${res.status}]: ${errText.slice(0, 300)}`, res.status);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("No content returned from Gemini");
  }
  return text;
}

/** Calls Gemini's image-capable model and returns a base64-encoded image
 * (no data: prefix), or null if no image came back. */
export async function callGeminiImage(apiKey: string, prompt: string): Promise<string | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new GeminiApiError(`Gemini image API error [${res.status}]: ${errText.slice(0, 300)}`, res.status);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  return imagePart?.inlineData?.data || null;
}

export class GeminiApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
