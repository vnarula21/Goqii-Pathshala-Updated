import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGamification } from "@/hooks/useGamification";
import { useCertificates } from "@/hooks/useCertificates";
import type { Json } from "@/integrations/supabase/types";

interface ModuleScore {
  score: number;
  completed: boolean;
  isFirstAttempt?: boolean;
}

interface CourseProgress {
  id: string;
  user_id: string;
  course_id: string;
  module_scores: Record<string, ModuleScore>;
  overall_score: number | null;
  is_completed: boolean;
  started_at: string;
  completed_at: string | null;
}

export function useCourseProgress(courseId: string) {
  const queryClient = useQueryClient();
  const { addXPAsync, updateStreak } = useGamification();
  const { issueIfEligible } = useCertificates();

  const { data: progress, isLoading } = useQuery({
    queryKey: ["course-progress", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_progress")
        .select("*")
        .eq("course_id", courseId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        module_scores: (data.module_scores as unknown as Record<string, ModuleScore>) || {},
      } as CourseProgress;
    },
    enabled: !!courseId,
  });

  const updateProgress = useMutation({
    mutationFn: async ({
      moduleId,
      score,
      totalModules,
      passingScore,
      isQuiz = false,
      isFirstAttempt = false,
      assignmentsSatisfied = true,
      courseAssessmentsSatisfied = true,
    }: {
      moduleId: string;
      score: number;
      totalModules: number;
      passingScore: number;
      isQuiz?: boolean;
      isFirstAttempt?: boolean;
      /** When false, we record the score but DO NOT mark the module completed yet. */
      assignmentsSatisfied?: boolean;
      /** When false, the course cannot be marked completed even if every module is done -
       * there's a course-level assessment (separate from module quizzes) still pending. */
      courseAssessmentsSatisfied?: boolean;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Get current progress or create new
      let currentProgress = progress;
      const wasModuleAlreadyCompleted = currentProgress?.module_scores?.[moduleId]?.completed;
      
      if (!currentProgress) {
        const { data: newProgress, error } = await supabase
          .from("course_progress")
          .insert({
            user_id: userData.user.id,
            course_id: courseId,
            module_scores: {} as Json,
          })
          .select()
          .single();
        if (error) throw error;
        currentProgress = {
          ...newProgress,
          module_scores: (newProgress.module_scores as unknown as Record<string, ModuleScore>) || {},
        } as CourseProgress;
      }

      const completedFlag = assignmentsSatisfied;

      // Update module scores — keep latest score; only mark completed when all reqs met.
      const moduleScores = {
        ...(currentProgress.module_scores || {}),
        [moduleId]: { score, completed: completedFlag, isFirstAttempt },
      };

      // Calculate overall score and completion
      const completedModules = Object.values(moduleScores).filter(m => m.completed);
      const allModulesCompleted = completedModules.length >= totalModules;
      const overallScore = allModulesCompleted
        ? Math.round(
            completedModules.reduce((sum, m) => sum + m.score, 0) / completedModules.length
          )
        : null;
      const isCompleted = allModulesCompleted && (overallScore || 0) >= passingScore && courseAssessmentsSatisfied;
      const wasAlreadyCompleted = currentProgress.is_completed;

      const { error: updateError } = await supabase
        .from("course_progress")
        .update({
          module_scores: moduleScores as unknown as Json,
          overall_score: overallScore,
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq("id", currentProgress.id);

      if (updateError) throw updateError;

      // Return data for XP awards — only count completion when the module actually flipped to completed.
      return {
        isNewModuleCompletion: completedFlag && !wasModuleAlreadyCompleted,
        isNewCourseCompletion: isCompleted && !wasAlreadyCompleted,
        overallScore,
        isQuiz,
        isFirstAttempt,
        passed: score >= passingScore,
      };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["course-progress", courseId] });
      
      // Award XP for module completion (+10 XP)
      if (data?.isNewModuleCompletion) {
        try {
          await addXPAsync({ amount: 10, reason: "Module completed" });
          updateStreak();
        } catch (e) {
          console.error("Failed to award module XP:", e);
        }
      }

      // Award XP for quiz passed on first attempt (+50 XP)
      if (data?.isQuiz && data?.isFirstAttempt && data?.passed && data?.isNewModuleCompletion) {
        try {
          await addXPAsync({ amount: 50, reason: "Quiz passed on first attempt!" });
        } catch (e) {
          console.error("Failed to award quiz XP:", e);
        }
      }

      // Award XP for course completion (+25 XP) and issue a certificate if
      // this course is configured for one and the score qualifies.
      if (data?.isNewCourseCompletion) {
        try {
          await addXPAsync({ amount: 25, reason: "Course completed!" });
        } catch (e) {
          console.error("Failed to award course XP:", e);
        }
        try {
          await issueIfEligible({ courseId, score: data.overallScore ?? 0 });
        } catch (e) {
          console.error("Failed to issue certificate:", e);
        }
      }
    },
  });

  const recheckCompletion = useMutation({
    mutationFn: async ({
      totalModules,
      passingScore,
      courseAssessmentsSatisfied,
    }: {
      totalModules: number;
      passingScore: number;
      courseAssessmentsSatisfied: boolean;
    }) => {
      if (!progress) return { isNewCourseCompletion: false };

      const moduleScores = progress.module_scores || {};
      const completedModules = Object.values(moduleScores).filter(m => m.completed);
      const allModulesCompleted = completedModules.length >= totalModules;
      const overallScore = allModulesCompleted
        ? Math.round(completedModules.reduce((sum, m) => sum + m.score, 0) / completedModules.length)
        : null;
      const isCompleted = allModulesCompleted && (overallScore || 0) >= passingScore && courseAssessmentsSatisfied;
      const wasAlreadyCompleted = progress.is_completed;

      if (isCompleted === wasAlreadyCompleted) {
        return { isNewCourseCompletion: false };
      }

      const { error } = await supabase
        .from("course_progress")
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq("id", progress.id);

      if (error) throw error;

      return { isNewCourseCompletion: isCompleted && !wasAlreadyCompleted, overallScore };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["course-progress", courseId] });
      if (data?.isNewCourseCompletion) {
        try {
          await addXPAsync({ amount: 25, reason: "Course completed!" });
        } catch (e) {
          console.error("Failed to award course XP:", e);
        }
        try {
          await issueIfEligible({ courseId, score: data.overallScore ?? 0 });
        } catch (e) {
          console.error("Failed to issue certificate:", e);
        }
      }
    },
  });

  const resetProgress = useMutation({
    mutationFn: async () => {
      if (!progress) return;
      
      const { error } = await supabase
        .from("course_progress")
        .delete()
        .eq("id", progress.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-progress", courseId] });
    },
  });

  return {
    progress,
    isLoading,
    updateProgress: updateProgress.mutate,
    recheckCompletion: recheckCompletion.mutate,
    resetProgress: resetProgress.mutate,
    isUpdating: updateProgress.isPending,
  };
}
