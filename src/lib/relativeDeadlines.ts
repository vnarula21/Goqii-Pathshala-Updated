// Preset options for "due X days after the learner starts" deadlines, used
// both for individual assignments linked to a course and for the course's
// own overall completion time limit. Both are optional (null = no deadline)
// and both are anchored to course_progress.started_at for that learner,
// not a fixed calendar date - so every learner gets the same amount of time
// regardless of when they were assigned or when they actually begin.

export interface DueDatePreset {
  label: string;
  value: number | null;
}

export const DUE_DATE_PRESETS: DueDatePreset[] = [
  { label: "No due date", value: null },
  { label: "5 days after starting", value: 5 },
  { label: "10 days after starting", value: 10 },
  { label: "15 days after starting", value: 15 },
  { label: "20 days after starting", value: 20 },
  { label: "30 days after starting", value: 30 },
];

export const COURSE_TIME_LIMIT_PRESETS: DueDatePreset[] = [
  { label: "No time limit", value: null },
  { label: "1 day after starting", value: 1 },
  { label: "3 days after starting", value: 3 },
  { label: "7 days after starting", value: 7 },
  { label: "14 days after starting", value: 14 },
  { label: "30 days after starting", value: 30 },
  { label: "60 days after starting", value: 60 },
];

/**
 * Computes the actual deadline for a specific learner, given when they
 * started the course and how many days they're allowed. Returns null if
 * either piece is missing (no deadline set, or learner hasn't started yet).
 */
export function computeRelativeDeadline(
  startedAt: string | null | undefined,
  daysAfterStart: number | null | undefined
): Date | null {
  if (!startedAt || daysAfterStart == null) return null;
  const start = new Date(startedAt);
  return new Date(start.getTime() + daysAfterStart * 24 * 60 * 60 * 1000);
}

export function isOverdue(deadline: Date | null): boolean {
  if (!deadline) return false;
  return deadline.getTime() < Date.now();
}

export function formatDaysRemaining(deadline: Date | null): string | null {
  if (!deadline) return null;
  const ms = deadline.getTime() - Date.now();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}
