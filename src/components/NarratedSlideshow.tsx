import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Play, Pause, ChevronLeft, ChevronRight, Volume2, Loader2, Sparkles, CheckCircle, RotateCcw, Maximize, Minimize,
} from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

interface Slide {
  image: string;
  audio: string | null;
}

interface NarratedSlideshowProps {
  moduleId: string;
  title?: string;
  /** When the module is already approved, its narration is guaranteed to be
   * fully built - skip the whole "is it still building?" check/poll and load
   * the saved slides directly, so an approved module always opens instantly
   * instead of re-verifying build status on every single open. */
  approvalStatus?: string;
  onModuleComplete?: () => void;
}

const SILENT_MS = 6000;

/**
 * Plays an uploaded deck as a narrated slideshow: rendered slide images shown
 * full-bleed with the AI narration audio for each slide, AUTO-ADVANCING as each
 * clip ends. One Play press runs the whole deck. Playback is driven imperatively
 * off the <audio> "ended" event so the chain never stalls between slides.
 */
export default function NarratedSlideshow({ moduleId, title, approvalStatus, onModuleComplete }: NarratedSlideshowProps) {
  const { isLearner } = useUserRole();
  const isApproved = approvalStatus === "approved";
  const audioRef = useRef<HTMLAudioElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef(0);
  const silentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStarted = useRef(false);

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      stageRef.current?.requestFullscreen().catch(() => {
        toast.error("Fullscreen isn't supported in this browser");
      });
    }
  };

  const { data: job, isLoading: jobLoading, isError: jobErrored } = useQuery({
    queryKey: ["slideshow-job", moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_generation_jobs")
        .select("status,progress,current_step")
        .eq("module_id", moduleId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data && data[0]) || null;
    },
    // Approved modules are guaranteed to already be fully built - there's no
    // reason to ever check build status for them, every open should be
    // instant, not a round of "is it still building?" polling.
    enabled: !isApproved,
    refetchInterval: (q) => (q.state.data?.status === "processing" || q.state.status === "error" ? 5000 : false),
    retry: 3,
  });

  // Fail-safe: if we don't yet KNOW the job is done (still loading, the
  // query errored, or it's genuinely processing), treat it as still
  // building rather than assuming "done" - otherwise a transient fetch
  // failure would prematurely reveal the slideshow before narration
  // audio has actually finished loading in, exactly like when it was
  // simply skipping this check entirely. Approved modules skip this
  // entirely (see above) and are simply never "still building".
  const stillBuilding = !isApproved && (jobLoading || jobErrored || job?.status === "processing");

  const { data: slides = [], isError: slidesErrored } = useQuery({
    queryKey: ["slideshow-assets", moduleId],
    queryFn: async (): Promise<Slide[]> => {
      const { data: imgOut, error: imgError } = await supabase
        .from("module_outputs")
        .select("content")
        .eq("module_id", moduleId)
        .eq("format_type", "slide_images")
        .maybeSingle();
      if (imgError) throw imgError;
      const images: string[] = ((imgOut?.content as any)?.images) || [];
      if (!images.length) return [];
      const { data: auds, error: audsError } = await supabase
        .from("module_slide_audio")
        .select("slide_number,audio_url")
        .eq("module_id", moduleId)
        .order("slide_number", { ascending: true });
      if (audsError) throw audsError;
      const bySlide = new Map<number, string>();
      (auds || []).forEach((a: any) => { if (a.audio_url) bySlide.set(a.slide_number, a.audio_url); });
      return images.map((img, i) => ({ image: img, audio: bySlide.get(i + 1) || null }));
    },
    retry: 3,
    // Approved modules only need one fetch, ever - the content is guaranteed
    // final, so there's nothing to poll for. Everything else keeps
    // refreshing while narration is still being generated (audio gets added
    // slide-by-slide after images already exist), not just until images
    // show up - otherwise we'd stop polling before audio is complete.
    refetchInterval: (q) => {
      if (isApproved) return false;
      const current = q.state.data as Slide[] | undefined;
      const noSlidesYet = !current || current.length === 0;
      return (stillBuilding || noSlidesYet || q.state.status === "error") ? 4000 : false;
    },
  });

  // Don't reveal the slideshow just because slide images exist - narration
  // audio is generated slide-by-slide in the background after that, and
  // showing slides before it's done let people scroll ahead thinking
  // everything was ready when most slides still had no narration. Wait for
  // the whole job to finish (or, for older modules with no job row at all,
  // fall back to images existing).
  const ready = slides.length > 0 && !stillBuilding && !slidesErrored;

  const clearSilent = () => {
    if (silentTimer.current) { clearTimeout(silentTimer.current); silentTimer.current = null; }
  };

  // Show slide `i` and start its narration. Imperative so it can be called
  // straight from the audio "ended" handler — a context where play() is allowed.
  const playAt = (i: number) => {
    const el = audioRef.current;
    if (i < 0 || i >= slides.length) return;
    clearSilent();
    idxRef.current = i;
    setIdx(i);
    setCompleted(false);
    setPlaying(true);
    const s = slides[i];
    if (s?.audio && el) {
      el.src = s.audio;
      el.currentTime = 0;
      el.play().catch(() => setPlaying(false));
    } else {
      // Silent slide: hold a few seconds, then continue.
      silentTimer.current = setTimeout(() => goNext(), SILENT_MS);
    }
  };

  const goNext = () => {
    const i = idxRef.current;
    if (i < slides.length - 1) {
      playAt(i + 1);
    } else {
      clearSilent();
      setPlaying(false);
      setCompleted(true);
      onModuleComplete?.();
    }
  };

  const pause = () => {
    clearSilent();
    audioRef.current?.pause();
    setPlaying(false);
  };

  const toggle = () => {
    if (!slides.length) return;
    if (completed) { playAt(0); return; }
    if (playing) { pause(); return; }
    playAt(idx); // resume current slide from its start
  };

  const go = (n: number) => {
    const t = Math.max(0, Math.min(slides.length - 1, n));
    if (playing) playAt(t);
    else { idxRef.current = t; setIdx(t); }
  };

  // Try to start automatically once assets are ready. Browsers may block audio
  // autoplay until the user interacts; if blocked, the big Play button starts it.
  useEffect(() => {
    if (ready && !autoStarted.current) {
      autoStarted.current = true;
      playAt(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => () => clearSilent(), []);

  const cur = slides[idx];

  const startBuild = async () => {
    setStarting(true);
    try {
      const { error } = await supabase.functions.invoke("convert-ppt-to-video", { body: { moduleId } });
      if (error) throw error;
      toast.success("Building your narrated slideshow…");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't start. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  // ── Ready: the player ──────────────────────────────────────────────────
  if (ready) {
    return (
      <div className="w-full">
        {title && <h1 className="text-lg font-bold text-foreground mb-3">{title}</h1>}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div
              ref={stageRef}
              className="relative bg-black flex items-center justify-center"
              style={{ aspectRatio: isFullscreen ? undefined : "16 / 9", width: "100%", height: isFullscreen ? "100vh" : undefined }}
            >
              {cur?.image && (
                <img src={cur.image} alt={`Slide ${idx + 1}`} className="max-h-full max-w-full object-contain" />
              )}
              {!playing && (
                <button
                  onClick={toggle}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                  aria-label="Play"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg">
                    {completed ? <RotateCcw className="h-7 w-7 text-black" /> : <Play className="h-7 w-7 text-black ml-1" />}
                  </span>
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-md bg-black/50 hover:bg-black/70 transition-colors text-white z-10"
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
            </div>
            <audio ref={audioRef} onEnded={goNext} preload="auto" className="hidden" />
            <div className="flex items-center gap-1 px-4 py-3 border-t">
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
                {completed ? <RotateCcw className="h-5 w-5" /> : playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => go(idx - 1)} disabled={idx === 0}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => go(idx + 1)} disabled={idx === slides.length - 1}>
                <ChevronRight className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
                <Volume2 className="h-3.5 w-3.5" />
                <span>Slide {idx + 1} of {slides.length}{cur && !cur.audio ? " (no narration)" : ""}</span>
              </div>
              {completed && (
                <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle className="h-3.5 w-3.5" /> Finished
                </span>
              )}
            </div>
            <div className="px-4 pb-3">
              <Progress value={((idx + 1) / slides.length) * 100} className="h-1.5" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Building: progress ─────────────────────────────────────────────────
  if (!ready) {
    // Learners should never see build-in-progress technical detail (progress
    // bars, "runs on a free server", current_step logs) - a module reaching
    // them mid-build means it was assigned/opened before narration finished,
    // which is a workflow issue to fix upstream, not something to expose
    // here. Keep their message simple and non-technical.
    if (isLearner) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="font-medium">This module isn't ready yet</p>
                <p className="text-sm text-muted-foreground">Please check back in a little while.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="font-medium">Building your narrated slideshow…</p>
              <p className="text-sm text-muted-foreground">{job?.current_step || "Preparing your slides and narration…"}</p>
            </div>
          </div>
          <Progress value={job?.progress || 0} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            This runs on a free server and can take a few minutes. You can leave and come back.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Idle / failed: generate ────────────────────────────────────────────
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Narrated slideshow</p>
              <p className="text-sm text-muted-foreground">
                Turn this deck into slides read aloud with AI narration.
              </p>
            </div>
          </div>
          <Button onClick={startBuild} disabled={starting}>
            {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
