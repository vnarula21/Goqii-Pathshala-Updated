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
  /** Defaults to 16384 - generous enough for a full multi-slide presentation
   * or document. Without an explicit limit, Gemini's own default can be too
   * small for large structured JSON output, silently truncating the
   * response mid-way (e.g. later slides in a deck coming out blank). */
  maxOutputTokens?: number;
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

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: options.maxOutputTokens ?? 16384,
  };
  if (options.temperature != null) generationConfig.temperature = options.temperature;
  if (options.jsonSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = options.jsonSchema;
  }
  body.generationConfig = generationConfig;

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
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error(
      "Gemini's response was cut off because it ran out of output space (increase maxOutputTokens, or ask for fewer/shorter items)."
    );
  }
  if (!text) {
    throw new Error("No content returned from Gemini");
  }
  return text;
}

/** Calls Gemini's image-capable model and returns a base64-encoded image
 * (no data: prefix), or null if no image came back. */
export async function callGeminiImage(apiKey: string, prompt: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      }
    );
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new GeminiApiError(
      aborted ? "Gemini image generation timed out after 45 seconds." : `Gemini image request failed: ${err instanceof Error ? err.message : err}`,
      502
    );
  } finally {
    clearTimeout(timeout);
  }

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
