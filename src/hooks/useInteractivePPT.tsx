import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAISettings } from "./useAISettings";

export interface InteractiveSlide {
  slide_number: number;
  title: string;
  content_points: string[];
  narration_text: string;
  imageSuggestion?: string;
  imageUrl?: string;
}

export interface AudioProgress {
  total: number;
  completed: number;
  failed: number;
  current: number;
}

export interface ImageProgress {
  total: number;
  completed: number;
  isGenerating: boolean;
}

export interface SlideAudioRecord {
  id: string;
  module_id: string;
  slide_number: number;
  narration_text: string;
  audio_url: string | null;
  audio_duration: number | null;
  audio_status: string;
  voice_id: string | null;
}

export class AudioKeyError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "AudioKeyError";
    this.code = code;
  }
}

export type AudioResult = {
  success: boolean;
  failReason?: "API_KEY_INVALID" | "FREE_TIER_BLOCKED" | "CREDITS_EXHAUSTED" | "GENERATION_FAILED";
};

const ELEVENLABS_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel" },
];

export { ELEVENLABS_VOICES };

const API_KEY_ERROR_CODES = ["API_KEY_INVALID", "FREE_TIER_BLOCKED", "CREDITS_EXHAUSTED"];

export function useInteractivePPT() {
  const [isGeneratingSlides, setIsGeneratingSlides] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [imageProgress, setImageProgress] = useState<ImageProgress>({
    total: 0, completed: 0, isGenerating: false,
  });
  const [audioProgress, setAudioProgress] = useState<AudioProgress>({
    total: 0, completed: 0, failed: 0, current: 0,
  });
  const [slideAudioRecords, setSlideAudioRecords] = useState<SlideAudioRecord[]>([]);
  const { getNarrationAISettings } = useAISettings();

  const generateInteractivePPT = useCallback(async (
    moduleContent: string,
    numberOfSlides: number,
    includeImages: boolean
  ): Promise<InteractiveSlide[]> => {
    setIsGeneratingSlides(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-interactive-ppt", {
        body: { moduleContent, numberOfSlides, includeImages },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data.formattedContent?.slides || [];
    } catch (err) {
      console.error("Error generating interactive PPT:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate interactive PPT");
      throw err;
    } finally {
      setIsGeneratingSlides(false);
    }
  }, []);

  const generateSlideImages = useCallback(async (
    slides: InteractiveSlide[],
    onUpdate: (updatedSlides: InteractiveSlide[]) => void
  ): Promise<InteractiveSlide[]> => {
    const slidesNeedingImages = slides.filter(s => s.imageSuggestion && !s.imageUrl);
    if (slidesNeedingImages.length === 0) return slides;

    setImageProgress({ total: slidesNeedingImages.length, completed: 0, isGenerating: true });
    const waitToast = toast.info(`Generating ${slidesNeedingImages.length} image(s)… this can take a minute or two, please wait.`, { duration: 120000 });

    try {
      const { data, error } = await supabase.functions.invoke("generate-slide-images", {
        body: { slides: slidesNeedingImages },
      });
      if (error) {
        let realMessage = error.message;
        try {
          const body = await error.context?.json?.();
          if (body?.error) realMessage = body.error;
        } catch {
          // response wasn't JSON or already consumed - fall back to error.message
        }
        throw new Error(realMessage);
      }
      if (data.error) throw new Error(data.error);

      const imageResults: { slideNumber: number; imageUrl: string | null }[] = data.images || [];
      const updatedSlides = slides.map(slide => {
        const result = imageResults.find(r => r.slideNumber === slide.slide_number && r.imageUrl);
        return result ? { ...slide, imageUrl: result.imageUrl! } : slide;
      });

      const successCount = imageResults.filter(r => r.imageUrl).length;
      setImageProgress({ total: slidesNeedingImages.length, completed: successCount, isGenerating: false });
      onUpdate(updatedSlides);

      if (successCount > 0) {
        toast.success(`Generated ${successCount}/${slidesNeedingImages.length} images`);
      } else {
        toast.warning("Image generation completed but no images were produced");
      }
      return updatedSlides;
    } catch (err: any) {
      console.error("Error generating slide images:", err);
      setImageProgress(prev => ({ ...prev, isGenerating: false }));
      toast.error(err?.message || "Image generation failed, but your slides are ready");
      return slides;
    } finally {
      toast.dismiss(waitToast);
    }
  }, []);

  const generateSlideAudio = useCallback(async (
    moduleId: string,
    slideNumber: number,
    text: string,
    voiceId: string
  ): Promise<{ audioUrl: string | null; errorCode?: string }> => {
    try {
      await supabase.from("module_slide_audio" as any).upsert({
        module_id: moduleId, slide_number: slideNumber,
        narration_text: text, audio_status: "generating", voice_id: voiceId,
      } as any, { onConflict: "module_id,slide_number" });

      // Get narration provider settings to pass to edge function
      const narrationSettings = getNarrationAISettings();
      const narrationProvider = narrationSettings.aiMode === 'own' ? narrationSettings.provider : undefined;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-audio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ 
            text, 
            slideIndex: slideNumber, 
            voice: voiceId, 
            moduleId,
            ...(narrationProvider && { narrationProvider }),
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errorCode = errData.code || "";
        if (API_KEY_ERROR_CODES.includes(errorCode)) {
          return { audioUrl: null, errorCode };
        }
        throw new Error(errData.error || `Audio generation failed: ${response.status}`);
      }

      const result = await response.json();
      const audioUrl = result.audioUrl || null;
      const duration = result.duration || Math.ceil(text.length / 15);

      await supabase.from("module_slide_audio" as any).upsert({
        module_id: moduleId, slide_number: slideNumber, narration_text: text,
        audio_url: audioUrl, audio_duration: duration,
        audio_status: audioUrl ? "completed" : "failed", voice_id: voiceId,
      } as any, { onConflict: "module_id,slide_number" });

      return { audioUrl };
    } catch (err) {
      console.error(`Audio generation failed for slide ${slideNumber}:`, err);
      await supabase.from("module_slide_audio" as any).upsert({
        module_id: moduleId, slide_number: slideNumber, narration_text: text,
        audio_status: "failed", voice_id: voiceId,
      } as any, { onConflict: "module_id,slide_number" });
      return { audioUrl: null };
    }
  }, []);

  const generateAllAudio = useCallback(async (
    moduleId: string, slides: InteractiveSlide[], voiceId: string
  ): Promise<AudioResult> => {
    setIsGeneratingAudio(true);
    const total = slides.length;
    setAudioProgress({ total, completed: 0, failed: 0, current: 1 });

    // Try first slide to detect API key issues early
    const firstResult = await generateSlideAudio(
      moduleId, slides[0].slide_number, slides[0].narration_text, voiceId
    );

    if (firstResult.errorCode && API_KEY_ERROR_CODES.includes(firstResult.errorCode)) {
      setIsGeneratingAudio(false);
      setAudioProgress({ total, completed: 0, failed: 1, current: 1 });
      const reason = firstResult.errorCode as AudioResult["failReason"];
      return { success: false, failReason: reason };
    }

    let completed = firstResult.audioUrl ? 1 : 0;
    let failed = firstResult.audioUrl ? 0 : 1;
    setAudioProgress({ total, completed, failed, current: 1 });

    for (let i = 1; i < slides.length; i++) {
      setAudioProgress({ total, completed, failed, current: i + 1 });
      let result = await generateSlideAudio(moduleId, slides[i].slide_number, slides[i].narration_text, voiceId);
      if (!result.audioUrl && !result.errorCode) {
        // Retry once for non-key errors
        result = await generateSlideAudio(moduleId, slides[i].slide_number, slides[i].narration_text, voiceId);
      }
      result.audioUrl ? completed++ : failed++;
      setAudioProgress({ total, completed, failed, current: i + 1 });
    }

    setIsGeneratingAudio(false);
    await fetchSlideAudio(moduleId);

    if (failed > 0) {
      toast.warning(`Audio generated for ${completed}/${total} slides. ${failed} failed.`);
      return { success: false, failReason: "GENERATION_FAILED" };
    }
    toast.success(`Audio generated for all ${total} slides!`);
    return { success: true };
  }, [generateSlideAudio]);

  const fetchSlideAudio = useCallback(async (moduleId: string) => {
    const { data, error } = await supabase
      .from("module_slide_audio" as any)
      .select("*")
      .eq("module_id", moduleId)
      .order("slide_number");
    if (!error && data) setSlideAudioRecords(data as any as SlideAudioRecord[]);
    return (data || []) as any as SlideAudioRecord[];
  }, []);

  const regenerateSlideAudio = useCallback(async (
    moduleId: string, slideNumber: number, text: string, voiceId: string
  ) => {
    setIsGeneratingAudio(true);
    const result = await generateSlideAudio(moduleId, slideNumber, text, voiceId);
    await fetchSlideAudio(moduleId);
    setIsGeneratingAudio(false);
    result.audioUrl
      ? toast.success(`Audio regenerated for slide ${slideNumber}`)
      : toast.error(`Failed to regenerate audio for slide ${slideNumber}`);
  }, [generateSlideAudio, fetchSlideAudio]);

  return {
    isGeneratingSlides,
    isGeneratingAudio,
    imageProgress,
    audioProgress,
    slideAudioRecords,
    generateInteractivePPT,
    generateSlideImages,
    generateSlideAudio,
    generateAllAudio,
    regenerateSlideAudio,
    fetchSlideAudio,
  };
}
