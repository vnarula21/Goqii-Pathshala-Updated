import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Play, RotateCcw, BookOpen, ChevronRight, RefreshCw } from "lucide-react";
import { addMonths, format } from "date-fns";
import { cn } from "@/lib/utils";

interface LearnerCourseCardProps {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  progress: number;
  isCompleted: boolean;
  score?: number;
  /** Retake interval set by the manager; null/undefined = no refresher. */
  refresherMonths?: number | null;
  completedAt?: string | null;
  onRefresher?: () => void;
}

export function LearnerCourseCard({
  id,
  title,
  description,
  thumbnailUrl,
  progress,
  isCompleted,
  score,
  refresherMonths,
  completedAt,
  onRefresher,
}: LearnerCourseCardProps) {
  const refresherDueAt =
    isCompleted && refresherMonths && completedAt ? addMonths(new Date(completedAt), refresherMonths) : null;
  const refresherDue = !!refresherDueAt && refresherDueAt.getTime() <= Date.now();
  const isInProgress = progress > 0 && !isCompleted;
  const isAvailable = progress === 0 && !isCompleted;

  const getButtonConfig = () => {
    if (isCompleted) {
      return {
        label: "Review",
        icon: RotateCcw,
        variant: "ghost" as const,
      };
    }
    if (isInProgress) {
      return {
        label: "Continue",
        icon: Play,
        variant: "default" as const,
      };
    }
    return {
      label: "Start",
      icon: ChevronRight,
      variant: "secondary" as const,
    };
  };

  const buttonConfig = getButtonConfig();

  return (
    <Card className={cn(
      "group overflow-hidden transition-all duration-200 hover:shadow-md",
      isCompleted && "bg-success-bg/50 border-[hsl(var(--success))]/20"
    )}>
      <Link to={`/courses/${id}`} className="flex items-center gap-3 p-3">
        {/* Compact Thumbnail */}
        <div className="relative h-14 w-20 flex-shrink-0 rounded-md overflow-hidden">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary/50" />
            </div>
          )}
          
          {/* Status indicator overlay */}
          {isCompleted && (
            <div className="absolute inset-0 bg-[hsl(var(--success))]/20 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                {title}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {description || "No description"}
              </p>
            </div>

            {/* Status Badge */}
            {isCompleted && score !== undefined && (
              <span className="text-xs font-semibold text-[hsl(var(--success))] whitespace-nowrap">
                {score}%
              </span>
            )}
            {isInProgress && (
              <span className="text-xs font-medium text-primary whitespace-nowrap">
                {progress}%
              </span>
            )}
          </div>

          {/* Progress Bar (inline for in-progress) */}
          {isInProgress && (
            <Progress value={progress} className="h-1 mt-2" />
          )}
        </div>

        {/* Refresher: faded until it is due, then highlighted and clickable */}
        {refresherDueAt && (
          <Button
            variant={refresherDue ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-7 px-2.5 text-xs flex-shrink-0",
              refresherDue
                ? "bg-amber-500 hover:bg-amber-600 text-white animate-pulse"
                : "opacity-40 blur-[0.6px] cursor-not-allowed"
            )}
            aria-disabled={!refresherDue}
            title={
              refresherDue
                ? "Time to retake this course"
                : `No refresher needed yet - next one opens on ${format(refresherDueAt, "d MMM yyyy")}`
            }
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (refresherDue) onRefresher?.();
            }}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresher
          </Button>
        )}

        {/* Action Button */}
        <Button 
          variant={buttonConfig.variant} 
          size="sm"
          className="h-7 px-2.5 text-xs flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
          asChild
        >
          <span>
            <buttonConfig.icon className="h-3 w-3 mr-1" />
            {buttonConfig.label}
          </span>
        </Button>
      </Link>
    </Card>
  );
}
