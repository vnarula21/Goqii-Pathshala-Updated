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

    const { moduleContent, numberOfQuestions, difficulty, types } = await req.json();

    if (!moduleContent || !numberOfQuestions) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: moduleContent, numberOfQuestions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const systemPrompt = `You are an assessment designer. Create questions only from the given module content.
Return the output as a valid JSON array of questions.`;

    const userPrompt = `Generate a quiz based ONLY on this module content:
${moduleContent}

Requirements:

${numberOfQuestions} questions

Difficulty: ${difficulty || "Medium"}

Types: ${Array.isArray(types) ? types.join(", ") : types || "MCQ"}

For each question, return a JSON object with:
- id: unique string
- type: "mcq" | "true-false" | "scenario"
- question: the question text
- options: array of option strings (for MCQ)
- correctAnswer: the correct answer (for MCQ: the option text, for true-false: "True" or "False")
- explanation: 1-line explanation of the answer
- included: true (default, can be toggled by user)

Return ONLY a valid JSON array of questions.

Example format:
[
  {
    "id": "q1",
    "type": "mcq",
    "question": "What is the primary purpose of...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": "Option A is correct because...",
    "included": true
  }
]`;

    console.log("Generating quiz with", numberOfQuestions, "questions");

    let quizContent: string;
    try {
      quizContent = await callGeminiText(GEMINI_API_KEY, { systemPrompt, userPrompt });
    } catch (err) {
      if (err instanceof GeminiApiError) {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }


    if (!quizContent) {
      throw new Error("No quiz content generated from AI");
    }

    try {
      quizContent = quizContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const questions = JSON.parse(quizContent);
      
      console.log("Quiz generated successfully with", questions.length, "questions");

      return new Response(
        JSON.stringify({ questions }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (parseError) {
      console.error("Failed to parse quiz JSON:", parseError);
      throw new Error("Failed to parse quiz response as JSON");
    }
  } catch (error) {
    console.error("Error in generate-quiz:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
