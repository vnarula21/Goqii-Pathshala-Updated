import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CourseProgressSummary {
  courseId: string;
  courseTitle: string;
  totalAssigned: number;
  completedCount: number;
  inProgressCount: number;
  avgScore: number | null;
}

export function useCourseProgressSummary() {
  const { data: summaries, isLoading } = useQuery({
    queryKey: ["course-progress-summary"],
    queryFn: async () => {
      // RLS already scopes both of these to the manager's own organization
      // (or all orgs for admin) - see the org-isolation fix.
      const { data: assignments, error: assignmentsError } = await supabase
        .from("course_assignments")
        .select("course_id, user_id, course:courses(id, title)");

      if (assignmentsError) throw assignmentsError;

      const courseIds = [...new Set((assignments || []).map((a) => a.course_id))];
      if (courseIds.length === 0) return [];

      const { data: progress, error: progressError } = await supabase
        .from("course_progress")
        .select("course_id, user_id, is_completed, overall_score")
        .in("course_id", courseIds);

      if (progressError) throw progressError;

      const courseMap = new Map<string, { title: string; assignedUserIds: Set<string> }>();
      for (const a of assignments || []) {
        if (!courseMap.has(a.course_id)) {
          courseMap.set(a.course_id, {
            title: (a.course as any)?.title || "Untitled Course",
            assignedUserIds: new Set(),
          });
        }
        courseMap.get(a.course_id)!.assignedUserIds.add(a.user_id);
      }

      const summaries: CourseProgressSummary[] = Array.from(courseMap.entries()).map(
        ([courseId, { title, assignedUserIds }]) => {
          const relevantProgress = (progress || []).filter(
            (p) => p.course_id === courseId && assignedUserIds.has(p.user_id)
          );
          const completedCount = relevantProgress.filter((p) => p.is_completed).length;
          const scores = relevantProgress
            .filter((p) => p.overall_score != null)
            .map((p) => p.overall_score as number);
          const avgScore = scores.length > 0
            ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
            : null;

          return {
            courseId,
            courseTitle: title,
            totalAssigned: assignedUserIds.size,
            completedCount,
            inProgressCount: assignedUserIds.size - completedCount,
            avgScore,
          };
        }
      );

      return summaries.sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));
    },
  });

  return { summaries: summaries || [], isLoading };
}
