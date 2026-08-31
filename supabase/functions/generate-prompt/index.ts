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

    const { 
      topic, description, scope, depth, imagesRequired,
      format, formatPreferences, 
      includeQuiz, quizSettings,
      includeAssignments, assignmentSettings 
    } = await req.json();

    if (!topic || !description || !scope || !depth) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: topic, description, scope, depth" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Build format-specific structure guidance
    let formatGuidance = "";
    if (format === "PPT") {
      const slideCount = formatPreferences?.numberOfSlides || 10;
      formatGuidance = `
FORMAT: Presentation (${slideCount} slides)
Structure the outline as ${slideCount} slides:
- Slide 1: Title slide with module title and a one-line subtitle
- Slides 2-${slideCount - 1}: Content slides. For each slide write:
  - Slide title
  - 4-6 key points to cover (write the actual points, not instructions)
  - If the slide compares two things, label them as "Left column" and "Right column"
- Slide ${slideCount}: Summary slide with 3-5 key takeaways
${formatPreferences?.includeSpeakerNotes ? "- Include a one-line speaker note hint per slide" : ""}`;
    } else if (format === "Article") {
      formatGuidance = `
FORMAT: Article (${formatPreferences?.readingLength || "Medium"} length)
Structure the outline as article sections:
- Title and a 2-sentence hook for the introduction
- 5-8 sections, each with:
  - Section heading
  - 3-5 key points to elaborate on
  - One example or case study idea
- Conclusion points`;
    } else if (format === "Document") {
      formatGuidance = `
FORMAT: Learning Document (${formatPreferences?.formatStyle || "Textbook"} style)
Structure the outline as document sections:
- Document title
- 6-10 sections, each with:
  - Section title
  - Key terms to define (2-3 per section)
  - Main concepts to explain
  - One key takeaway per section`;
    } else if (format === "Video") {
      const durationSecs = formatPreferences?.durationSeconds || (formatPreferences?.durationMinutes ? formatPreferences.durationMinutes * 60 : 60);
      const sceneCount = Math.max(3, Math.ceil(durationSecs / 4));
      formatGuidance = `
FORMAT: Video Script (${Math.floor(durationSecs / 60)} min ${durationSecs % 60}s, ${sceneCount} scenes)
Structure the outline as scenes:
- Scene 1: Introduction — hook and overview
- Scenes 2-${sceneCount - 1}: Content scenes. For each:
  - Scene title
  - Key talking points for narration
  - Visual concept (what should be shown on screen)
- Scene ${sceneCount}: Conclusion and summary`;
    }

    let quizGuidance = "";
    if (includeQuiz && quizSettings) {
      quizGuidance = `

QUIZ PLAN:
- ${quizSettings.numberOfQuestions} questions, difficulty: ${quizSettings.difficulty}
- Types: ${quizSettings.types?.join(", ") || "MCQ"}
- List ${quizSettings.numberOfQuestions} quiz question topics (one line each, stating what concept each question should test)`;
    }

    let assignmentGuidance = "";
    if (includeAssignments && assignmentSettings) {
      assignmentGuidance = `

ASSIGNMENT PLAN:
- ${assignmentSettings.numberOfAssignments} assignments, type: ${assignmentSettings.type}
- For each assignment write: title and one-sentence description of what the learner must do`;
    }

    const systemPrompt = `You are a Senior Instructional Designer creating a CONTENT BRIEF for a learning module.

A content brief is a detailed outline of ACTUAL CONTENT — not instructions for another AI.

RULES:
1. Write the actual section titles, key points, learning outcomes, and examples. Do NOT write meta-instructions like "the AI should...", "generate...", "create...", "include a section about...".
2. Every bullet point must be a real content point, not a directive.
3. Keep image descriptions in a separate IMAGE PLAN section at the end — NEVER mix them with content points.
4. Do not invent statistics or cite fake sources.
5. Be specific and detailed — this brief will be used to generate the final module content.

BAD example: "Create a section explaining active listening techniques"
GOOD example: "Active Listening Techniques
- Paraphrasing — restate what the speaker said in your own words to confirm understanding
- Nonverbal cues — maintain eye contact, nod, lean forward to show engagement
- Reflective questions — ask open-ended questions that encourage the speaker to elaborate"`;

    const userPrompt = `Create a detailed CONTENT BRIEF for the following learning module:

TOPIC: ${topic}
DESCRIPTION: ${description}

SCOPE (cover these sub-topics in order):
${scope}

DEPTH: ${depth} (Quick = brief coverage / Standard = moderate detail with examples / Deep = thorough with frameworks, scenarios, and application)

${formatGuidance}
${quizGuidance}
${assignmentGuidance}

REQUIRED BRIEF STRUCTURE:

MODULE TITLE: [Write the title]

OVERVIEW: [Write a 2-3 sentence overview of what this module covers]

LEARNING OUTCOMES:
- [Outcome 1 — what the learner will be able to do]
- [Outcome 2]
- [Outcome 3]

CONTENT OUTLINE:
[Write the section-by-section or slide-by-slide outline with actual content points as described in the format guidance above]

KEY TAKEAWAYS:
- [Takeaway 1]
- [Takeaway 2]
- [Takeaway 3]

${imagesRequired ? `IMAGE PLAN (separate from content — these are descriptions for AI image generation):
- Image 1: [description of the image to generate]
- Image 2: [description]
(Include 6-10 image descriptions relevant to the content)` : ""}

Write the brief now. Remember: actual content, not instructions.`;

    console.log("Generating content brief for topic:", topic, "format:", format);

    let masterPrompt: string;
    try {
      masterPrompt = await callGeminiText(GEMINI_API_KEY, {
        systemPrompt,
        userPrompt,
      });
    } catch (err) {
      if (err instanceof GeminiApiError) {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    if (!masterPrompt) {
      throw new Error("No content brief generated from AI");
    }

    console.log("Content brief generated successfully");

    return new Response(
      JSON.stringify({ masterPrompt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-prompt:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
