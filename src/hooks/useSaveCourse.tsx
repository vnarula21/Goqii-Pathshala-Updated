import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SaveCourseData {
  id?: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  passing_score: number;
  completion_days?: number | null;
  is_published: boolean;
  module_ids: string[]; // ordered list of module IDs
  level_id?: string;
  visibility?: "public" | "private";
}

export function useSaveCourse() {
  const queryClient = useQueryClient();

  const saveCourse = useMutation({
    mutationFn: async (data: SaveCourseData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const courseData = {
        title: data.title,
        description: data.description || null,
        thumbnail_url: data.thumbnail_url || null,
        passing_score: data.passing_score,
        completion_days: data.completion_days ?? null,
        is_published: data.is_published,
        user_id: userData.user.id,
        level_id: data.level_id || null,
        visibility: data.visibility || "private",
      };

      let courseId = data.id;

      if (data.id) {
        // Update existing course
        const { error } = await supabase
          .from("courses")
          .update(courseData)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        // Create new course
        const { data: newCourse, error } = await supabase
          .from("courses")
          .insert(courseData)
          .select()
          .single();
        if (error) throw error;
        courseId = newCourse.id;

        // Auto-enable a completion certificate for every new course, using
        // the course's own passing score as the qualifying threshold. SMEs
        // can still disable/adjust this later from course settings.
        const { error: certError } = await supabase.from("certificates").insert({
          course_id: courseId,
          is_enabled: true,
          min_passing_score: data.passing_score,
        });
        if (certError) {
          console.error("Failed to create default certificate config:", certError);
        }
      }

      // Delete existing course_modules and re-insert with new order
      await supabase
        .from("course_modules")
        .delete()
        .eq("course_id", courseId);

      // Insert new course_modules with order
      if (data.module_ids.length > 0) {
        const courseModules = data.module_ids.map((moduleId, index) => ({
          course_id: courseId,
          module_id: moduleId,
          order_index: index,
        }));

        const { error: modulesError } = await supabase
          .from("course_modules")
          .insert(courseModules);
        if (modulesError) throw modulesError;
      }

      return courseId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course saved successfully");
    },
    onError: (error) => {
      console.error("Error saving course:", error);
      toast.error("Failed to save course");
    },
  });

  const deleteCourse = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase
        .from("courses")
        .delete()
        .eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting course:", error);
      toast.error("Failed to delete course");
    },
  });

  return {
    saveCourse: saveCourse.mutate,
    deleteCourse: deleteCourse.mutate,
    isSaving: saveCourse.isPending,
    isDeleting: deleteCourse.isPending,
  };
}
