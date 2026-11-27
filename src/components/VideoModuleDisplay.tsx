import { useState, useRef } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import PlaybackSpeedButton from "@/components/PlaybackSpeedButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Clock } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { ModuleTimer, useModuleTimeTracking } from "./gamification/ModuleTimer";
import { useFullscreen } from "@/hooks/useFullscreen";
import FullscreenButton from "@/components/FullscreenButton";

interface VideoModuleDisplayProps {
  module: {
    title: string;
    fileUrl: string;
    fileName?: string;
  };
  savedModuleId?: string;
  timeLimitMinutes?: number;
  onModuleComplete?: () => void;
}

export default function VideoModuleDisplay({ module, savedModuleId, timeLimitMinutes, onModuleComplete }: VideoModuleDisplayProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(100);
  const [rate, setRate] = useState(1);
  const { isLearner } = useUserRole();
  // Learners must watch the video through: no seeking or skipping ahead.
  const restricted = isLearner;
  const maxWatched = useRef(0);
  const { isTimeUp, handleTimeUp, hasTimeLimit } = useModuleTimeTracking(savedModuleId, timeLimitMinutes);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef as React.RefObject<HTMLElement>);

  const handlePlayPause = () => {
    const video = document.getElementById("video-player") as HTMLVideoElement;
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    const video = document.getElementById("video-player") as HTMLVideoElement;
    if (video) {
      if (!video.seeking && video.currentTime > maxWatched.current) maxWatched.current = video.currentTime;
      setProgress((video.currentTime / video.duration) * 100);
    }
  };

  // Safety net: if anything moves the playhead ahead of what was actually
  // watched, snap back.
  const handleSeeking = () => {
    const video = document.getElementById("video-player") as HTMLVideoElement;
    if (restricted && video && video.currentTime > maxWatched.current + 0.75) {
      video.currentTime = maxWatched.current;
    }
  };

  const handleRate = (r: number) => {
    setRate(r);
    const video = document.getElementById("video-player") as HTMLVideoElement;
    if (video) video.playbackRate = r;
  };

  const handleSeek = (value: number[]) => {
    if (restricted) return;
    const video = document.getElementById("video-player") as HTMLVideoElement;
    if (video) {
      video.currentTime = (value[0] / 100) * video.duration;
      setProgress(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const video = document.getElementById("video-player") as HTMLVideoElement;
    if (video) {
      video.volume = value[0] / 100;
      setVolume(value[0]);
      setIsMuted(value[0] === 0);
    }
  };

  const toggleMute = () => {
    const video = document.getElementById("video-player") as HTMLVideoElement;
    if (video) {
      video.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const skip = (seconds: number) => {
    if (restricted) return;
    const video = document.getElementById("video-player") as HTMLVideoElement;
    if (video) {
      video.currentTime += seconds;
    }
  };

  return (
    <div ref={containerRef} className={`${isFullscreen ? "bg-black flex flex-col h-screen" : "max-w-5xl mx-auto p-4"}`}>
      {hasTimeLimit && timeLimitMinutes && !isFullscreen && (
        <div className="mb-4">
          <ModuleTimer timeLimitMinutes={timeLimitMinutes} onTimeUp={handleTimeUp} showPauseButton={!isPlaying} />
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

      <Card className={`overflow-hidden ${isFullscreen ? "flex-1 flex flex-col border-0 rounded-none" : ""}`}>
        <CardContent className={`p-0 ${isFullscreen ? "flex-1 flex flex-col" : ""}`}>
          <div className={`relative bg-black ${isFullscreen ? "flex-1" : "aspect-video"}`}>
            <video
              id="video-player"
              src={module.fileUrl}
              className="w-full h-full"
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => {
                setIsPlaying(false);
                onModuleComplete?.();
              }}
              onClick={handlePlayPause}
              onSeeking={handleSeeking}
              onLoadedMetadata={(e) => { e.currentTarget.playbackRate = rate; }}
              controlsList="nodownload noplaybackrate"
              disablePictureInPicture
              onContextMenu={(e) => restricted && e.preventDefault()}
            />
            
            {/* Video Controls Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <Slider
                value={[progress]}
                onValueChange={handleSeek}
                disabled={restricted}
                max={100}
                step={0.1}
                className="mb-4"
              />
              
              <div className="flex items-center gap-2">
                {!restricted && (
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => skip(-10)}>
                    <SkipBack className="h-5 w-5" />
                  </Button>
                )}
                
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={handlePlayPause}>
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </Button>
                
                {!restricted && (
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => skip(10)}>
                    <SkipForward className="h-5 w-5" />
                  </Button>
                )}
                <PlaybackSpeedButton rate={rate} onChange={handleRate} className="text-white hover:bg-white/20 hover:text-white" />

                <div className="flex items-center gap-2 ml-4">
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={toggleMute}>
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    onValueChange={handleVolumeChange}
                    max={100}
                    className="w-24"
                  />
                </div>

                <div className="flex-1" />

                <FullscreenButton 
                  isFullscreen={isFullscreen} 
                  onToggle={toggleFullscreen} 
                  variant="ghost" 
                  className="text-white hover:bg-white/20" 
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isFullscreen && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold text-foreground">{module.title}</h1>
            {hasTimeLimit && timeLimitMinutes && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {timeLimitMinutes} min
              </Badge>
            )}
          </div>
          {module.fileName && (
            <p className="text-sm text-muted-foreground mt-1">File: {module.fileName}</p>
          )}
        </div>
      )}
    </div>
  );
}
