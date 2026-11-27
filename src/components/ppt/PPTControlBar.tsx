import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play, Pause, Volume2, VolumeX,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import FullscreenButton from "@/components/FullscreenButton";
import PlaybackSpeedButton from "@/components/PlaybackSpeedButton";

interface PPTControlBarProps {
  currentSlide: number;
  totalSlides: number;
  slides: any[];
  hasAudio: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  audioProgress: number;
  audioDuration: number;
  progressPercent: number;
  slideProgressPercent: number;
  isFullscreen: boolean;
  formatTime: (seconds: number) => string;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlayPause: () => void;
  onSeek: (value: number[]) => void;
  onVolumeChange: (value: number[]) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onSlideSelect: (index: number) => void;
  /** Learner mode: no skipping around, speed capped at 1.5x. */
  restricted?: boolean;
  rate?: number;
  onRateChange?: (rate: number) => void;
}

export default function PPTControlBar({
  currentSlide,
  totalSlides,
  slides,
  hasAudio,
  isPlaying,
  isMuted,
  volume,
  audioProgress,
  audioDuration,
  progressPercent,
  slideProgressPercent,
  isFullscreen,
  formatTime,
  onPrev,
  onNext,
  onTogglePlayPause,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  onSlideSelect,
  restricted = false,
  rate = 1,
  onRateChange,
}: PPTControlBarProps) {
  return (
    <div className="bg-card border rounded-lg px-4 py-2 space-y-2">
      {/* Progress / Seek bar */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{hasAudio ? formatTime(audioProgress) : `${currentSlide + 1}`}</span>
        <Slider
          value={[hasAudio ? progressPercent : slideProgressPercent]}
          onValueChange={hasAudio && !restricted ? onSeek : undefined}
          disabled={restricted}
          max={100}
          step={0.5}
          className="flex-1"
        />
        <span>{hasAudio ? formatTime(audioDuration) : `${totalSlides}`}</span>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-1">
        {!restricted && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev} disabled={currentSlide === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {hasAudio && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onTogglePlayPause}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </Button>
        )}

        {!restricted && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext} disabled={currentSlide === totalSlides - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        {/* Slide dots */}
        <div className="flex items-center gap-1 mx-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => !restricted && onSlideSelect(idx)}
              disabled={restricted}
              className={`w-2 h-2 rounded-full transition-colors ${
                idx === currentSlide ? "bg-primary" : idx < currentSlide ? "bg-primary/40" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <div className="flex-1" />

        {onRateChange && <PlaybackSpeedButton rate={rate} onChange={onRateChange} />}

        {/* Volume */}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleMute}>
          {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
        <Slider
          value={[isMuted ? 0 : volume]}
          onValueChange={onVolumeChange}
          max={100}
          className="w-20"
        />

        {/* Fullscreen */}
        <FullscreenButton isFullscreen={isFullscreen} onToggle={onToggleFullscreen} variant="ghost" />
      </div>
    </div>
  );
}
