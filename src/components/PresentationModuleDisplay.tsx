import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Download, Presentation, ExternalLink, Clock, ChevronLeft, ChevronRight, CheckCircle, Play, Pause, Volume2 } from "lucide-react";
import SlideRenderer from "@/components/ppt/SlideRenderer";
import { ModuleTimer, useModuleTimeTracking } from "./gamification/ModuleTimer";
import { useUserRole } from "@/hooks/useUserRole";
import PlaybackSpeedButton from "@/components/PlaybackSpeedButton";
import { useFullscreen } from "@/hooks/useFullscreen";
import FullscreenButton from "@/components/FullscreenButton";
import { supabase } from "@/integrations/supabase/client";
import GenerateNarrationButton from "@/components/GenerateNarrationButton";

interface PPTSlide {
  slideNumber?: number;
  title: string;
  subtitle?: string;
  layout?: string;
  bulletPoints?: string[];
  content_points?: string[];
  leftColumn?: string[];
  rightColumn?: string[];
  takeaways?: string[];
  caption?: string;
  speakerNotes?: string;
  imageSuggestion?: string;
  imageUrl?: string;
}

interface PresentationModuleDisplayProps {
  module: {
    title: string;
    fileUrl?: string;
    fileName?: string;
    slides?: PPTSlide[] | { hasNarration?: boolean; slideCount?: number; [k: string]: any };
    chapters?: Array<{
      title: string;
      slides: PPTSlide[];
    }>;
  };
  savedModuleId?: string;
  timeLimitMinutes?: number;
  onModuleComplete?: () => void;
}

interface NarrationClip {
  slide_number: number;
  audio_url: string;
}

export default function PresentationModuleDisplay({ module, savedModuleId, timeLimitMinutes, onModuleComplete }: PresentationModuleDisplayProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const { isTimeUp, handleTimeUp, hasTimeLimit } = useModuleTimeTracking(savedModuleId, timeLimitMinutes);
  const { isAdmin, isLearner } = useUserRole();
  const [rate, setRate] = useState(1);
  const changeRate = (r: number) => {
    setRate(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef as React.RefObject<HTMLElement>);

  // Narration playback (from uploaded PPTX speaker notes)
  const audioRef = useRef<HTMLAudioElement>(null);
  const [clips, setClips] = useState<NarrationClip[]>([]);
  const [narrationSlide, setNarrationSlide] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  const slidesMeta = (module.slides && !Array.isArray(module.slides)) ? (module.slides as any) : null;
  const hasNarration = !!slidesMeta?.hasNarration && !!savedModuleId;

  useEffect(() => {
    if (!hasNarration || !savedModuleId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("module_slide_audio" as any)
        .select("slide_number, audio_url")
        .eq("module_id", savedModuleId)
        .order("slide_number", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("Failed to load narration clips:", error);
        return;
      }
      const rows = ((data as any) || []).filter((r: any) => r.audio_url);
      setClips(rows);
      if (rows.length > 0) setNarrationSlide(rows[0].slide_number);
    })();
    return () => { cancelled = true; };
  }, [hasNarration, savedModuleId]);

  const currentClip = clips.find((c) => c.slide_number === narrationSlide);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !currentClip) return;
    el.src = currentClip.audio_url;
    el.defaultPlaybackRate = rate;
    el.playbackRate = rate;
    el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [currentClip?.audio_url]);

  const handleAudioEnded = () => {
    const next = clips.find((c) => c.slide_number > narrationSlide);
    if (next) {
      setNarrationSlide(next.slide_number);
    } else {
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const hasFileUrl = !!module.fileUrl;
  
  
  const allSlides: PPTSlide[] = module.chapters
    ? module.chapters.flatMap(ch => ch.slides)
    : (Array.isArray(module.slides) ? (module.slides as PPTSlide[]) : []);

  const hasAISlides = allSlides.length > 0;

  const handleMarkComplete = () => {
    setIsComplete(true);
    onModuleComplete?.();
  };

  const handleDownload = () => {
    if (!module.fileUrl) return;
    const link = document.createElement("a");
    link.href = module.fileUrl;
    link.download = module.fileName || "presentation.pptx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    if (module.fileUrl) {
      window.open(module.fileUrl, "_blank");
    }
  };

  const isPdf = (() => {
    const url = module.fileUrl || "";
    const name = module.fileName || "";
    return /\.pdf($|\?)/i.test(url) || /\.pdf$/i.test(name);
  })();

  const getEmbedUrl = () => {
    if (!module.fileUrl) return "";
    if (isPdf) {
      // Serve PDFs directly to the browser's native viewer (Chrome blocks Office viewer for PDFs).
      return `${module.fileUrl}#toolbar=0&navpanes=0&view=FitH`;
    }
    const encodedUrl = encodeURIComponent(module.fileUrl);
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
  };

  const slideProgressPercent = allSlides.length > 0 ? ((currentSlide + 1) / allSlides.length) * 100 : 0;

  // Render file-based PPT
  const renderFileBased = () => (
    <>
      {!isFullscreen && (
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-foreground">{module.title}</h1>
              {hasTimeLimit && timeLimitMinutes && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  {timeLimitMinutes} min
                </Badge>
              )}
            </div>
            {module.fileName && (
              <p className="text-xs text-muted-foreground">{module.fileName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {savedModuleId && slidesMeta?.speakerNotes && Array.isArray(slidesMeta.speakerNotes) && slidesMeta.speakerNotes.length > 0 && (
              <GenerateNarrationButton
                moduleId={savedModuleId}
                speakerNotes={slidesMeta.speakerNotes}
                defaultProvider={(slidesMeta.narrationProvider as any) || "elevenlabs"}
                defaultVoiceId={slidesMeta.narrationVoiceId}
                defaultVoiceDescription={slidesMeta.narrationVoiceDescription}
              />
            )}
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <Card className={`overflow-hidden ${isFullscreen ? "flex-1 flex items-center justify-center bg-black border-0 rounded-none" : ""}`}>
        <CardContent className={`p-0 flex justify-center items-center ${isFullscreen ? "bg-black w-full h-full" : "bg-muted/50"}`}>
          <div
            className={`relative overflow-hidden ${isFullscreen ? "" : "w-full"}`}
            style={
              isFullscreen
                ? {
                    aspectRatio: "16 / 9",
                    maxHeight: "calc(100vh - 120px)",
                    maxWidth: "100%",
                    width: "min(100%, calc((100vh - 120px) * 16 / 9))",
                  }
                : { maxWidth: "75%", aspectRatio: "16 / 9", minHeight: "480px" }
            }
          >
            {/* For PDFs render natively (no Office chrome to clip). For PPT, clip Office Online header/toolbar. */}
            <iframe
              src={getEmbedUrl()}
              className="absolute left-0 w-full border-0"
              title={module.title}
              allowFullScreen
              style={isPdf ? { top: 0, height: "100%" } : { top: "-48px", height: "calc(100% + 96px)" }}
            />

          </div>
        </CardContent>
      </Card>

      {/* Control bar — our own fullscreen is the only one exposed */}
      <div className="bg-card border rounded-lg px-4 py-2 flex items-center gap-2 mt-2">
        {hasNarration && clips.length > 0 && (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={togglePlay} aria-label={isPlaying ? "Pause narration" : "Play narration"}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Volume2 className="h-3.5 w-3.5" />
              <span>Narrating slide {narrationSlide} of {clips[clips.length - 1]?.slide_number ?? clips.length}</span>
            </div>
            <PlaybackSpeedButton rate={rate} onChange={changeRate} />
          </>
        )}
        <div className="flex-1" />
        <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} variant="ghost" />
      </div>

      {/* Hidden narration audio element — no native controls, no seek, no skip */}
      {hasNarration && (
        <audio
          ref={audioRef}
          onEnded={handleAudioEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          preload="auto"
          className="hidden"
        />
      )}

      {!isFullscreen && (
        <>
          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Presentation className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                {isAdmin 
                  ? "If the presentation doesn't load, download it to view locally."
                  : "If the presentation doesn't load, please contact an administrator."}
              </p>
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <Button
              onClick={handleMarkComplete}
              disabled={isComplete}
              className={isComplete ? "bg-green-600 hover:bg-green-600" : ""}
              size="lg"
            >
              <CheckCircle className="mr-2 h-5 w-5" />
              {isComplete ? "Completed" : "I've Finished Viewing"}
            </Button>
          </div>
        </>
      )}
    </>
  );

  // Render AI-generated slides
  const renderAISlides = () => {
    if (allSlides.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No slides generated yet
        </div>
      );
    }

    const slide = allSlides[currentSlide];

    return (
      <>
        {!isFullscreen && (
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-lg font-bold text-foreground">{module.title}</h1>
                {hasTimeLimit && timeLimitMinutes && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    {timeLimitMinutes} min
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Slide {currentSlide + 1} of {allSlides.length}
              </p>
            </div>
          </div>
        )}

        {/* Slide Display */}
        <div className={`overflow-hidden rounded-xl ${isFullscreen ? "flex-1" : "min-h-[400px]"}`}>
          <SlideRenderer slide={slide} currentSlide={currentSlide} isFullscreen={isFullscreen} />
        </div>

        {/* Bottom Control Bar */}
        <div className="bg-card border rounded-lg px-4 py-2 space-y-2 mt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{currentSlide + 1}</span>
            <Slider
              value={[slideProgressPercent]}
              max={100}
              step={1}
              className="flex-1"
            />
            <span>{allSlides.length}</span>
          </div>

          <div className="flex items-center gap-1">
            {!isLearner && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))} disabled={currentSlide === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentSlide(prev => Math.min(allSlides.length - 1, prev + 1))} disabled={currentSlide === allSlides.length - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}

            <div className="flex items-center gap-1 mx-2">
              {allSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => !isLearner && setCurrentSlide(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentSlide ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            <div className="flex-1" />
            <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} variant="ghost" />
          </div>
        </div>

        {/* Completion Button */}
        {!isFullscreen && currentSlide === allSlides.length - 1 && (
          <div className="mt-4 flex justify-center">
            <Button
              onClick={handleMarkComplete}
              disabled={isComplete}
              className={isComplete ? "bg-green-600 hover:bg-green-600" : ""}
              size="lg"
            >
              <CheckCircle className="mr-2 h-5 w-5" />
              {isComplete ? "Completed" : "I've Finished Viewing"}
            </Button>
          </div>
        )}
      </>
    );
  };

  return (
    <div ref={containerRef} className={`w-full ${isFullscreen ? "bg-background p-4 flex flex-col h-screen" : ""}`}>
      {/* Module Timer */}
      {hasTimeLimit && timeLimitMinutes && !isFullscreen && (
        <div className="mb-4">
          <ModuleTimer timeLimitMinutes={timeLimitMinutes} onTimeUp={handleTimeUp} showPauseButton={true} />
        </div>
      )}

      {isTimeUp && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center bg-background/95">
          <div className="text-center p-8">
            <Clock className="w-20 h-20 mx-auto text-destructive mb-6" />
            <h2 className="text-3xl font-bold mb-4">Time's Up!</h2>
            <p className="text-lg text-muted-foreground mb-6">The time limit for this module has expired.</p>
          </div>
        </Card>
      )}

      {hasFileUrl ? renderFileBased() : hasAISlides ? renderAISlides() : (
        <div className="text-center py-16">
          <Presentation className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">{module.title}</h2>
          <p className="text-muted-foreground">No presentation content available.</p>
        </div>
      )}
    </div>
  );
}
