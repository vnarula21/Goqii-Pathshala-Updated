import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiText, GeminiApiError } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FormatPreferences {
  numberOfSlides?: number;
  includeSpeakerNotes?: boolean;
  includeImages?: boolean;
  readingLength?: string;
  includeHeadings?: boolean;
  formatStyle?: string;
  includeSummaryBoxes?: boolean;
  durationMinutes?: number;
  durationSeconds?: number;
  outputType?: string;
  voiceTone?: string;
}

// Tool schemas for each format
function getPPTTool(prefs: FormatPreferences) {
  const slideProperties: Record<string, unknown> = {
    slideNumber: { type: "number", description: "Slide number starting from 1" },
    layout: { 
      type: "string", 
      enum: ["title-only", "bullets-with-image", "bullets-full", "two-column", "image-focus", "summary"],
      description: "Slide layout type"
    },
    title: { type: "string", description: "Slide title" },
    subtitle: { type: "string", description: "Subtitle for title-only slides" },
    bulletPoints: { 
      type: "array", 
      items: { type: "string" },
      description: "Array of bullet points. Each must be factual learning content ONLY. Never include image descriptions, icon tags, or prompts here."
    },
    leftColumn: { type: "array", items: { type: "string" }, description: "Left column items for two-column layout" },
    rightColumn: { type: "array", items: { type: "string" }, description: "Right column items for two-column layout" },
    takeaways: { type: "array", items: { type: "string" }, description: "Key takeaways for summary slide" },
    caption: { type: "string", description: "Caption for image-focus slides" },
  };

  if (prefs.includeSpeakerNotes) {
    slideProperties.speakerNotes = { type: "string", description: "Speaker notes for this slide" };
  }
  if (prefs.includeImages !== false) {
    slideProperties.imageSuggestion = { 
      type: "string", 
      description: "AI image generation prompt describing the visual. This is the ONLY place for image descriptions. Leave empty string for slides that don't need images." 
    };
  }

  return {
    type: "function" as const,
    function: {
      name: "create_presentation",
      description: "Create a presentation with structured slides",
      parameters: {
        type: "object",
        properties: {
          slides: {
            type: "array",
            items: {
              type: "object",
              properties: slideProperties,
              required: ["slideNumber", "layout", "title"],
            },
          },
        },
        required: ["slides"],
      },
    },
  };
}

function getArticleTool() {
  return {
    type: "function" as const,
    function: {
      name: "create_article",
      description: "Create a structured article with sections",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Article title" },
          heroImageSuggestion: { type: "string", description: "AI image generation prompt for the hero image. Describe subject, style, mood. NO text in image." },
          introduction: { type: "string", description: "Engaging 2-3 paragraph introduction" },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                heading: { type: "string", description: "Section heading" },
                subheading: { type: "string", description: "Optional subheading" },
                content: { type: "string", description: "Full section content — factual text only, no image tags or prompts" },
                imageSuggestion: { type: "string", description: "AI image generation prompt for this section. Describe subject, style, mood. NO text in image. Empty string if section doesn't need an image." },
              },
              required: ["heading", "content"],
            },
          },
          conclusion: { type: "string", description: "Conclusion paragraph" },
        },
        required: ["title", "introduction", "sections", "conclusion"],
      },
    },
  };
}

function getDocumentTool(prefs: FormatPreferences) {
  const sectionProperties: Record<string, unknown> = {
    sectionTitle: { type: "string", description: "Section title" },
    definitions: { 
      type: "array", 
      items: { type: "string" },
      description: "Key terms and definitions for this section" 
    },
    content: { type: "string", description: "Detailed section content — factual text only, no image tags or prompts" },
    imageSuggestion: { type: "string", description: "AI image generation prompt for this section. Describe subject, style, mood. NO text in image. Empty string if section doesn't need an image." },
  };

  if (prefs.includeSummaryBoxes !== false) {
    sectionProperties.recapBox = { type: "string", description: "Key takeaway summary for this section" };
  }

  return {
    type: "function" as const,
    function: {
      name: "create_document",
      description: "Create a structured learning document",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Document title" },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: sectionProperties,
              required: ["sectionTitle", "content"],
            },
          },
        },
        required: ["title", "sections"],
      },
    },
  };
}

function getVideoTool() {
  return {
    type: "function" as const,
    function: {
      name: "create_video_script",
      description: "Create a video script with scenes",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Video title" },
          totalDuration: { type: "number", description: "Total duration in seconds" },
          aspectRatio: { type: "string", enum: ["16:9", "9:16"], description: "Video aspect ratio" },
          scenes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sceneNumber: { type: "number" },
                sceneTitle: { type: "string" },
                duration: { type: "number", description: "Scene duration in seconds (4-5)" },
                narration: { type: "string", description: "Full spoken narration script (35-60 words)" },
                visualDescription: { type: "string", description: "Human-readable storyboard description" },
                videoPrompt: { type: "string", description: "AI video generation prompt — subject, action, camera, lighting, mood. Under 200 chars." },
                transition: { type: "string", enum: ["fade", "slideLeft", "slideRight", "slideUp", "slideDown"] },
              },
              required: ["sceneNumber", "sceneTitle", "duration", "narration", "visualDescription", "videoPrompt", "transition"],
            },
          },
        },
        required: ["title", "totalDuration", "scenes"],
      },
    },
  };
}

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

    const { moduleContent, targetFormat, formatPreferences } = await req.json();

    if (!moduleContent || !targetFormat) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: moduleContent, targetFormat" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const prefs = (formatPreferences as FormatPreferences) || {};

    // Select tool and build format-specific instructions
    let tool: ReturnType<typeof getPPTTool>;
    let formatInstructions = "";

    if (targetFormat === "PPT") {
      tool = getPPTTool(prefs);
      const slideCount = prefs.numberOfSlides || 10;
      formatInstructions = `Create a presentation with EXACTLY ${slideCount} slides.

SLIDE LAYOUT RULES:
- Slide 1: Use "title-only" layout with a compelling title and subtitle
- Slides 2-${slideCount - 1}: Mix layouts — use "bullets-with-image", "bullets-full", "two-column", and "image-focus". Do NOT repeat the same layout more than twice consecutively.
- Slide ${slideCount}: Use "summary" layout with key takeaways

CONTENT RULES:
- Each content slide should have 4-6 substantive bullet points
- Each bullet point should include an explanation after a dash, e.g. "Active Listening — Focus on understanding the speaker's intent"
- bulletPoints must contain ONLY factual learning content
- NEVER put image descriptions, [Image:], [Icon:], Prompt:, or Style: text inside bulletPoints, leftColumn, rightColumn, or takeaways
- Image descriptions go ONLY in the imageSuggestion field
${prefs.includeImages !== false ? "- For imageSuggestion, write detailed prompts describing: subject, style, colors, mood, composition" : ""}
${prefs.includeSpeakerNotes ? "- Include detailed speaker notes for each slide" : ""}`;
    } else if (targetFormat === "Article") {
      tool = getArticleTool();
      formatInstructions = `Create a complete, professional article.
- Reading length: ${prefs.readingLength || "Medium"}
- Create 5-8 substantial sections covering all the source material
- Each section content should be 150-300 words minimum
- Write engaging, flowing prose — not bullet points
- Do NOT include any image tags, prompts, or metadata in the content text
- Provide heroImageSuggestion (top-level) and imageSuggestion per section: detailed AI image prompts (subject, style, colors, mood). Do NOT generate images yourself.`;
    } else if (targetFormat === "Document") {
      tool = getDocumentTool(prefs);
      formatInstructions = `Create a comprehensive learning document.
- Style: ${prefs.formatStyle || "Textbook"}
- Create 6-10 sections covering all source material
- Include 2-3 relevant definitions per section
- Write thorough explanations with examples
${prefs.includeSummaryBoxes !== false ? "- Each section MUST have a recapBox with the key takeaway" : ""}
- Do NOT include any image tags, prompts, or metadata in the content text
- Provide imageSuggestion per section: detailed AI image prompt (subject, style, colors, mood). Do NOT generate images yourself.`;
    } else if (targetFormat === "Video") {
      tool = getVideoTool();
      const durationSecs = prefs.durationSeconds || (prefs.durationMinutes ? prefs.durationMinutes * 60 : 60);
      const sceneCount = Math.max(3, Math.ceil(durationSecs / 4));
      formatInstructions = `Create a video script with ${sceneCount} scenes totaling ${durationSecs} seconds.
- Voice tone: ${prefs.voiceTone || "Professional"}
- Scene 1: Engaging introduction
- Middle scenes: Cover all content thoroughly
- Final scene: Summary and conclusion
- Each scene narration: 35-60 words (15-25 seconds of speech)
- Each scene duration: 4-5 seconds
- videoPrompt: Cinematic prompt for AI video generation — describe subject, action, camera movement, lighting, mood. Under 200 chars. No text overlays.`;
    } else {
      return new Response(
        JSON.stringify({ error: `Unsupported format: ${targetFormat}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert learning content creator. You produce final, production-ready educational content.

RULES:
1. Use ALL the provided source content — do not summarize or skip material
2. Write professional, factual, engaging content
3. You MUST call the provided tool function to return your output
4. Content fields must contain ONLY readable learning content — no image tags, no prompt metadata, no bracketed instructions like [Image:] or [Icon:]
5. Do not invent statistics or cite fake sources`;

    const userPrompt = `${formatInstructions}

=== SOURCE CONTENT BRIEF ===
${moduleContent}
=== END SOURCE CONTENT ===

Now create the ${targetFormat} content using the tool provided. Use ALL the source material above.`;

    console.log("Generating final module as:", targetFormat, "with structured output");

    let formattedContent: unknown;
    try {
      const rawJson = await callGeminiText(GEMINI_API_KEY, {
        systemPrompt,
        userPrompt,
        jsonSchema: tool.function.parameters,
      });
      formattedContent = JSON.parse(rawJson);
    } catch (err) {
      if (err instanceof GeminiApiError) {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Failed to get/parse structured output:", err);
      throw new Error("AI returned invalid structured output");
    }

    console.log("Final module generated successfully via structured output");

    return new Response(
      JSON.stringify({ formattedContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-final-module:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
