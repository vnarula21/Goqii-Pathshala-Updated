import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiText, GeminiApiError } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // AUTHENTICATION & AUTHORIZATION
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const allowedRoles = ['sme', 'sme_expert', 'manager', 'admin'] as const;
    let hasAccess = false;
    for (const role of allowedRoles) {
      const { data } = await adminClient.rpc('has_role', { _user_id: authData.user.id, _role: role });
      if (data) { hasAccess = true; break; }
    }

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { moduleContent, numberOfSlides, includeImages } = await req.json();

    if (!moduleContent) {
      return new Response(
        JSON.stringify({ error: "Missing required field: moduleContent" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const slideCount = numberOfSlides || 10;

    const systemPrompt = `You are an expert learning content creator specializing in creating interactive presentation narrations.
Your task is to create a presentation with LONG, DETAILED narration for each slide - as if a professional instructor is teaching the content live.

CRITICAL REQUIREMENTS:
1. Each slide's narration_text must be 100-150 words (800-1000 characters MAX) — this is a hard limit
2. Narration must be in complete, natural, conversational sentences - NOT bullet points
3. Narration should explain, elaborate, give examples, and connect concepts
4. The narration should sound like a knowledgeable instructor speaking to students
5. Use ALL the source content provided - distribute across slides, do not cram into one`;

    const userPrompt = `Transform the following learning content into an interactive presentation with ${slideCount} slides.

=== SOURCE CONTENT (Use ALL of this) ===
${moduleContent}
=== END SOURCE CONTENT ===

SLIDE DISTRIBUTION:
- Slide 1: Title/introduction slide with overview narration
- Slides 2-${slideCount - 1}: Content slides, each covering a distinct topic from the source material
- Slide ${slideCount}: Summary/conclusion slide

NARRATION GUIDELINES:
- Start each slide narration with a transition from the previous topic
- Include real-world examples or analogies where appropriate  
- End each slide narration with a bridge to the next topic
- Use varied sentence structures - mix short impactful sentences with longer explanatory ones
- Address the audience directly: "Let's explore...", "Think about...", "You'll notice that..."

Each content_points array should have 3-5 bullet points. Each bullet point must be 1-2 lines maximum (under 15 words each). Keep them punchy and scannable - the narration provides the detail.

CRITICAL CONTENT RULE:
- NEVER put image descriptions, icon descriptions, or image prompts inside content_points.
- Image generation instructions belong ONLY in the "imageSuggestion" field.
- content_points must contain ONLY factual learning content. No "[Image: ...]", "[Icon: ...]", "Prompt:", or "Style:" tags.`;

    // Build slide properties schema
    const slideProperties: Record<string, any> = {
      slide_number: { type: "integer", description: "Sequential slide number starting from 1" },
      title: { type: "string", description: "Engaging slide title" },
      content_points: {
        type: "array",
        items: { type: "string" },
        description: "3-5 short bullet points, each under 15 words"
      },
      narration_text: {
        type: "string",
        description: "100-150 word detailed narration as if an instructor is speaking"
      },
    };
    const requiredFields = ["slide_number", "title", "content_points", "narration_text"];

    if (includeImages) {
      slideProperties.imageSuggestion = {
        type: "string",
        description: "Detailed description for AI image generation"
      };
      requiredFields.push("imageSuggestion");
    }

    const tools = [
      {
        type: "function",
        function: {
          name: "create_presentation",
          description: "Create an interactive presentation with slides",
          parameters: {
            type: "object",
            properties: {
              slides: {
                type: "array",
                items: {
                  type: "object",
                  properties: slideProperties,
                  required: requiredFields,
                  additionalProperties: false,
                },
              },
            },
            required: ["slides"],
            additionalProperties: false,
          },
        },
      },
    ];

    console.log("Generating interactive PPT with structured output, slides:", slideCount);

    let content: any;
    try {
      const rawJson = await callGeminiText(GEMINI_API_KEY, {
        systemPrompt,
        userPrompt,
        jsonSchema: tools[0].function.parameters,
      });
      content = JSON.parse(rawJson);
    } catch (err) {
      if (err instanceof GeminiApiError) {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Failed to get/parse structured output:", err);
      throw new Error("AI did not return structured slide data");
    }

    if (!content?.slides?.length) {
      throw new Error("AI response missing slides data");
    }

    console.log("Interactive PPT generated successfully with", content.slides.length, "slides");

    return new Response(
      JSON.stringify({ formattedContent: content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-interactive-ppt:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
