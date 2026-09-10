import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, Trash2, Loader2, Upload, Sparkles, ImageOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { validateFile } from "@/lib/fileValidation";

interface EditableImageProps {
  imageUrl?: string;
  onImageChange: (newUrl: string | null) => void;
  alt?: string;
  className?: string;
  aspectRatio?: "square" | "video" | "wide";
  imageSuggestion?: string;
  contextLabel?: string;
  onRemoveSlot?: () => void;
}

export default function EditableImage({
  imageUrl,
  onImageChange,
  alt = "Module image",
  className,
  aspectRatio = "video",
  imageSuggestion,
  contextLabel,
  onRemoveSlot,
}: EditableImageProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(imageSuggestion || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aspectClasses = {
    square: "aspect-square",
    video: "aspect-video",
    wide: "aspect-[21/9]",
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file, "image");
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `forge-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("module-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("module-files").getPublicUrl(filePath);
      onImageChange(data.publicUrl);
      toast.success("Image uploaded successfully");
    } catch (err) {
      console.error("Error uploading image:", err);
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleGenerate = async (promptOverride?: string) => {
    const prompt = (promptOverride ?? customPrompt ?? imageSuggestion ?? "").trim();
    if (!prompt) {
      setShowPromptEditor(true);
      toast.info("Add a description for the image first.");
      return;
    }
    setIsGenerating(true);
    const waitToast = toast.info("Generating image… this can take up to a minute, please wait.", { duration: 60000 });
    try {
      const { data, error } = await supabase.functions.invoke("generate-single-image", {
        body: { prompt, context: contextLabel },
      });
      if (error) {
        // supabase-js doesn't auto-parse the response body into error.message -
        // it just says "non-2xx status code". Read the real message ourselves.
        let realMessage = error.message;
        try {
          const body = await error.context?.json?.();
          if (body?.error) realMessage = body.error;
        } catch {
          // response wasn't JSON or already consumed - fall back to error.message
        }
        throw new Error(realMessage);
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.imageUrl) throw new Error("No image URL returned");
      onImageChange(data.imageUrl);
      setShowPromptEditor(false);
      toast.success("Image generated");
    } catch (err: any) {
      console.error("AI image gen failed:", err);
      toast.error(err?.message || "Failed to generate image. Please try again in a moment.");
    } finally {
      toast.dismiss(waitToast);
      setIsGenerating(false);
    }
  };

  const handleDelete = () => {
    onImageChange(null);
    toast.success("Image removed");
  };

  const busy = isUploading || isGenerating;

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative rounded-lg overflow-hidden border bg-muted/30 group",
          aspectClasses[aspectRatio],
          className,
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {imageUrl ? (
          <>
            <img src={imageUrl} alt={alt} className="w-full h-full object-cover" />
            <div
              className={cn(
                "absolute inset-0 bg-black/50 flex items-center justify-center gap-2 transition-opacity flex-wrap p-2",
                isHovered || busy ? "opacity-100" : "opacity-0",
              )}
            >
              {busy ? (
                <div className="flex items-center gap-2 text-white">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{isGenerating ? "Generating..." : "Uploading..."}</span>
                </div>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" /> Replace
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleGenerate()}>
                    <Sparkles className="h-4 w-4 mr-1" /> Re-generate
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground p-3">
            {busy ? (
              <>
                <Loader2 className="h-7 w-7 animate-spin" />
                <span className="text-sm">{isGenerating ? "Generating image..." : "Uploading..."}</span>
              </>
            ) : (
              <>
                <ImagePlus className="h-7 w-7" />
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button size="sm" variant="default" onClick={() => handleGenerate()} disabled={busy}>
                    <Sparkles className="h-3.5 w-3.5 mr-1" /> Generate with AI
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                    <Upload className="h-3.5 w-3.5 mr-1" /> Upload
                  </Button>
                  {onRemoveSlot && (
                    <Button size="sm" variant="ghost" onClick={onRemoveSlot} disabled={busy}>
                      <ImageOff className="h-3.5 w-3.5 mr-1" /> Skip image
                    </Button>
                  )}
                </div>
                {imageSuggestion && !showPromptEditor && (
                  <p className="text-[11px] text-muted-foreground text-center max-w-xs line-clamp-2 italic">
                    AI prompt: {imageSuggestion}
                  </p>
                )}
                <Button
                  size="sm"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => setShowPromptEditor((v) => !v)}
                >
                  {showPromptEditor ? "Hide prompt" : "Edit prompt"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {showPromptEditor && !imageUrl && (
        <div className="space-y-1">
          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Describe the image you want AI to create..."
            rows={2}
            className="text-xs"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => handleGenerate(customPrompt)} disabled={busy || !customPrompt.trim()}>
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Generate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
