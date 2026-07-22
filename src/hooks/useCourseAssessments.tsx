import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Assessment } from "./useAssessments";

export interface CourseAssessment {
  id: string;
  course_id: string;
  assessment_id: string;
  order_index: number;
  due_date: string | null;
  due_days_after_start: number | null;
  created_at: string;
  assessment?: Assessment;
}

export function useCourseAssessments(courseId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: courseAssessments, isLoading } = useQuery({
    queryKey: ["course-assessments", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_assessments")
        .select(`
          *,
          assessment:assessments(*)
        `)
        .eq("course_id", courseId)
        .order("order_index");

      if (error) throw error;
      return data.map((ca: any) => ({
        ...ca,
        assessment: ca.assessment as Assessment,
      })) as CourseAssessment[];
    },
    enabled: !!courseId,
  });

  const addAssessmentToCourse = useMutation({
    mutationFn: async ({
      assessmentId,
      dueDaysAfterStart,
    }: {
      assessmentId: string;
      dueDaysAfterStart?: number | null;
    }) => {
      const orderIndex = (courseAssessments?.length || 0);
      
      const { data, error } = await supabase
        .from("course_assessments")
        .insert({
          course_id: courseId,
          assessment_id: assessmentId,
          order_index: orderIndex,
          due_days_after_start: dueDaysAfterStart ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-assessments", courseId] });
      toast({ title: "Assignment added to course" });
    },
    onError: (error) => {
      toast({ title: "Failed to add assignment", description: error.message, variant: "destructive" });
    },
  });

  const removeAssessmentFromCourse = useMutation({
    mutationFn: async (courseAssessmentId: string) => {
      const { error } = await supabase
        .from("course_assessments")
        .delete()
        .eq("id", courseAssessmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-assessments", courseId] });
      toast({ title: "Assignment removed from course" });
    },
  });

  const updateDueDate = useMutation({
    mutationFn: async ({ id, dueDate }: { id: string; dueDate: string | null }) => {
      const { error } = await supabase
        .from("course_assessments")
        .update({ due_date: dueDate })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-assessments", courseId] });
    },
  });

  const updateDueDaysAfterStart = useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number | null }) => {
      const { error } = await supabase
        .from("course_assessments")
        .update({ due_days_after_start: days })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-assessments", courseId] });
    },
  });

  return {
    courseAssessments,
    isLoading,
    addAssessmentToCourse,
    removeAssessmentFromCourse,
    updateDueDate,
    updateDueDaysAfterStart,
  };
}
