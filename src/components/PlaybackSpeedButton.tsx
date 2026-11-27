import { Button } from "@/components/ui/button";
import { Gauge } from "lucide-react";

export const PLAYBACK_RATES = [1, 1.25, 1.5] as const;

interface PlaybackSpeedButtonProps {
  rate: number;
  onChange: (rate: number) => void;
  className?: string;
}

/** Cycles 1x -> 1.25x -> 1.5x -> 1x. Capped at 1.5x on purpose. */
export default function PlaybackSpeedButton({ rate, onChange, className }: PlaybackSpeedButtonProps) {
  const next = () => {
    const i = PLAYBACK_RATES.indexOf(rate as (typeof PLAYBACK_RATES)[number]);
    onChange(PLAYBACK_RATES[(i + 1) % PLAYBACK_RATES.length]);
  };
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`h-8 gap-1 px-2 text-xs font-medium ${className ?? ""}`}
      onClick={(e) => { e.stopPropagation(); next(); }}
      aria-label={`Playback speed ${rate}x. Click to change`}
      title="Playback speed"
    >
      <Gauge className="h-3.5 w-3.5" />
      {rate}x
    </Button>
  );
}
