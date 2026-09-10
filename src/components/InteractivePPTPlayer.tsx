import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import {
  Play, Pause, Volume2, VolumeX,
  ChevronLeft, ChevronRight, CheckCircle,
  FileText, ChevronDown, ImageIcon, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { SlideAudioRecord } from "@/hooks/useInteractivePPT";
import { useInteractivePPT, ELEVENLABS_VOICES } from "@/hooks/useInteractivePPT";
import { toast } from "sonner";
import { useFullscreen } from "@/hooks/useFullscreen";
import FullscreenButton from "@/components/FullscreenButton";
import SlideRenderer from "@/components/ppt/SlideRenderer";
import PPTControlBar from "@/components/ppt/PPTControlBar";

interface InteractivePPTSlide {
  slide_number?: number;
  slideNumber?: number;
  title: string;
  subtitle?: string;
  layout?: string;
  content_points?: string[];
  bulletPoints?: string[];
  leftColumn?: string[];
  rightColumn?: string[];
  takeaways?: string[];
  caption?: string;
  narration_text?: string;
  speakerNotes?: string;
  imageUrl?: string;
  imageSuggestion?: string;
}

interface InteractivePPTPlayerProps {
  module: {
    title: string;
    slides: InteractivePPTSlide[];
  };
  savedModuleId?: string;
  onModuleComplete?: () => void;
}

export default function InteractivePPTPlayer({ module, savedModuleId, onModuleComplete }: InteractivePPTPlayerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showNarration, setShowNarration] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioRecords, setAudioRecords] = useState<SlideAudioRecord[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [fetchComplete, setFetchComplete] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoGenTriggered = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const interactivePPT = useInteractivePPT();
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef as React.RefObject<HTMLElement>);

  const slides = module.slides || [];
  const totalSlides = slides.length;
  const slide = slides[currentSlide];

  const getNarrationText = (s: InteractivePPTSlide) => s.speakerNotes || s.narration_text || "";
  const getSlideNumber = (s: InteractivePPTSlide) => s.slideNumber || s.slide_number || 0;

  // Fetch audio records
  useEffect(() => {
    if (!savedModuleId) return;
    const fetchAudio = async () => {
      const { data } = await supabase
        .from("module_slide_audio" as any)
        .select("*")
        .eq("module_id", savedModuleId)
        .order("slide_number");
      if (data) {
        setAudioRecords(data as any as SlideAudioRecord[]);
      }
      setFetchComplete(true);
    };
    fetchAudio();
  }, [savedModuleId]);

  // Auto-generate audio if slides have narration but no audio records exist
  useEffect(() => {
    if (!savedModuleId || !fetchComplete || autoGenTriggered.current || isAutoGenerating) return;
    if (audioRecords.length > 0) return;
    
    const slidesWithNarration = slides.filter(s => getNarrationText(s).length > 0);
    if (slidesWithNarration.length === 0) return;

    autoGenTriggered.current = true;
    setIsAutoGenerating(true);
    toast.info("Generating audio narration for slides...");

    const defaultVoice = ELEVENLABS_VOICES[0].id;
    const mappedSlides = slidesWithNarration.map(s => ({
      slide_number: getSlideNumber(s),
      narration_text: getNarrationText(s),
    }));

    interactivePPT.generateAllAudio(savedModuleId, mappedSlides as any, defaultVoice)
      .then(async () => {
        const { data } = await supabase
          .from("module_slide_audio" as any)
          .select("*")
          .eq("module_id", savedModuleId)
          .order("slide_number");
        if (data) {
          setAudioRecords(data as any as SlideAudioRecord[]);
        }
        setIsAutoGenerating(false);
      })
      .catch(() => {
        setIsAutoGenerating(false);
      });
  }, [savedModuleId, audioRecords.length, slides]);

  const currentAudioRecord = audioRecords.find(
    r => r.slide_number === (getSlideNumber(slide) || currentSlide + 1)
  );

  const hasAudio = currentAudioRecord?.audio_status === "completed" && currentAudioRecord?.audio_url;

  // Load and auto-play audio for current slide
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAudioProgress(0);
    setAudioDuration(0);
    setIsPlaying(false);

    if (currentAudioRecord?.audio_url && currentAudioRecord.audio_status === "completed") {
      const audio = new Audio(currentAudioRecord.audio_url);
      audio.muted = isMuted;
      audio.volume = volume / 100;

      audio.addEventListener("loadedmetadata", () => {
        setAudioDuration(audio.duration);
      });

      audio.addEventListener("timeupdate", () => {
        setAudioProgress(audio.currentTime);
      });

      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setAudioProgress(audio.duration);

        if (currentSlide < totalSlides - 1) {
          setTimeout(() => setCurrentSlide(prev => prev + 1), 300);
        } else {
          setIsComplete(true);
          onModuleComplete?.();
        }
      });

      audio.addEventListener("canplaythrough", () => {
        audio.play().then(() => setIsPlaying(true)).catch(console.error);
      }, { once: true });

      audioRef.current = audio;
    } else if (!hasAudio && !isAutoGenerating && currentSlide < totalSlides - 1) {
      const timer = setTimeout(() => setCurrentSlide(prev => prev + 1), 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [currentSlide, currentAudioRecord?.audio_url]);

  // Update mute/volume state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      audioRef.current.volume = volume / 100;
    }
  }, [isMuted, volume]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const goToPrev = () => {
    if (currentSlide > 0) setCurrentSlide(prev => prev - 1);
  };

  const goToNext = () => {
    if (currentSlide < totalSlides - 1) setCurrentSlide(prev => prev + 1);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setIsMuted(value[0] === 0);
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current && audioDuration > 0) {
      audioRef.current.currentTime = (value[0] / 100) * audioDuration;
      setAudioProgress(audioRef.current.currentTime);
    }
  };

  const progressPercent = audioDuration > 0 ? (audioProgress / audioDuration) * 100 : 0;
  const slideProgressPercent = totalSlides > 0 ? ((currentSlide + 1) / totalSlides) * 100 : 0;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div ref={containerRef} className={`w-full ${isFullscreen ? "bg-background p-4 flex flex-col h-screen" : "space-y-4"}`}>
      {/* Auto-generating banner */}
      {isAutoGenerating && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Generating audio narration — {interactivePPT.audioProgress.completed}/{interactivePPT.audioProgress.total} slides done…</span>
        </div>
      )}

      {/* Header */}
      {!isFullscreen && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">{module.title}</h1>
            <p className="text-xs text-muted-foreground">
              Slide {currentSlide + 1} of {totalSlides}
            </p>
          </div>
        </div>
      )}

      {/* Slide Display */}
      <Card className={`bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden ${isFullscreen ? "flex-1" : ""}`}>
        <CardContent
          className={`p-6 flex flex-col ${isFullscreen ? "h-full" : ""}`}
          style={isFullscreen ? undefined : { aspectRatio: "16 / 9", maxHeight: "70vh" }}
        >
          <SlideRenderer slide={slide} currentSlide={currentSlide} isFullscreen={isFullscreen} />
        </CardContent>
      </Card>

      {/* Bottom Control Bar */}
      <PPTControlBar
        currentSlide={currentSlide}
        totalSlides={totalSlides}
        slides={slides}
        hasAudio={!!hasAudio}
        isPlaying={isPlaying}
        isMuted={isMuted}
        volume={volume}
        audioProgress={audioProgress}
        audioDuration={audioDuration}
        progressPercent={progressPercent}
        slideProgressPercent={slideProgressPercent}
        isFullscreen={isFullscreen}
        formatTime={formatTime}
        onPrev={goToPrev}
        onNext={goToNext}
        onTogglePlayPause={togglePlayPause}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleMute={() => setIsMuted(!isMuted)}
        onToggleFullscreen={toggleFullscreen}
        onSlideSelect={setCurrentSlide}
      />

      {/* Narration Text (expandable) */}
      {!isFullscreen && slide?.narration_text && (
        <Collapsible open={showNarration} onOpenChange={setShowNarration}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Speaker Notes
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showNarration ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {slide.narration_text}
                </p>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Completion */}
      {isComplete && !isFullscreen && (
        <div className="flex justify-center pt-2">
          <Button
            onClick={() => onModuleComplete?.()}
            className="bg-green-600 hover:bg-green-600"
            size="lg"
          >
            <CheckCircle className="mr-2 h-5 w-5" />
            Completed
          </Button>
        </div>
      )}
    </div>
  );
}
