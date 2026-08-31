import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiImage } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CONCURRENT = 2; // process 2 at a time to avoid rate limits

async function generateOneImage(
  slide: { slide_number?: number; slideNumber?: number; title: string; imageSuggestion?: string },
  supabase: any,
  GEMINI_API_KEY: string
): Promise<{ slideNumber: number; imageUrl: string | null }> {
  const slideNumber = slide.slide_number || slide.slideNumber || 0;
  const imageSuggestion = slide.imageSuggestion;
  const title = slide.title;

  if (!imageSuggestion) {
    return { slideNumber, imageUrl: null };
  }

  try {
    console.log(`[slide-${slideNumber}] Generating image...`);
    const fullPrompt = `Create a high-quality, professional illustration for a corporate training presentation slide about "${title}". Requirements: Photorealistic or polished vector style, vibrant colors, clean composition, NO text or labels in the image, no watermarks. The image should visually represent: ${imageSuggestion}`;

    const base64Data = await callGeminiImage(GEMINI_API_KEY, fullPrompt);
    if (!base64Data) {
      console.warn(`[slide-${slideNumber}] No image data in response`);
      return { slideNumber, imageUrl: null };
    }

    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const fileName = `forge-interactive-ppt/${Date.now()}-slide-${slideNumber}.png`;

    const { error: uploadError } = await supabase.storage
      .from('module-files')
      .upload(fileName, imageBytes, { contentType: 'image/png', upsert: true });

    if (uploadError) {
      console.error(`[slide-${slideNumber}] Upload error:`, uploadError);
      return { slideNumber, imageUrl: null };
    }

    const { data: urlData } = supabase.storage.from('module-files').getPublicUrl(fileName);
    console.log(`[slide-${slideNumber}] Image uploaded successfully`);
    return { slideNumber, imageUrl: urlData.publicUrl };
  } catch (err) {
    console.error(`[slide-${slideNumber}] Error:`, err);
    return { slideNumber, imageUrl: null };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { slides } = await req.json();

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing or empty slides array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const results: { slideNumber: number; imageUrl: string | null }[] = [];

    // Process in batches of MAX_CONCURRENT
    for (let i = 0; i < slides.length; i += MAX_CONCURRENT) {
      const batch = slides.slice(i, i + MAX_CONCURRENT);
      const batchResults = await Promise.all(
        batch.map(slide => generateOneImage(slide, supabase, GEMINI_API_KEY))
      );
      results.push(...batchResults);
      console.log(`Batch ${Math.floor(i / MAX_CONCURRENT) + 1} complete: ${results.filter(r => r.imageUrl).length} images so far`);
    }

    console.log(`Generated ${results.filter(r => r.imageUrl).length}/${slides.length} images total`);

    return new Response(
      JSON.stringify({ images: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-slide-images:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
