import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CourseModule {
  id: string;
  module_id: string;
  order_index: number;
  module: {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    module_type: string;
  };
}

export interface CourseAssessmentLink {
  id: string;
  assessment_id: string;
  order_index: number;
  due_date: string | null;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  passing_score: number;
  completion_days: number | null;
  is_published: boolean;
  level_id: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  course_modules: CourseModule[];
  course_assessments?: CourseAssessmentLink[];
  // Computed property for total assignments across all modules
  totalAssignmentCount?: number;
}

export function useCourseLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [sortBy, setSortBy] = useState<"created_at" | "title" | "updated_at">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // RLS policies handle visibility filtering based on organization access
  // No need for client-side filtering
  const { data: courses = [], isLoading, refetch } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          course_modules (
            id,
            module_id,
            order_index,
            module:modules (
              id,
              title,
              description,
              thumbnail_url,
              module_type
            )
          ),
          course_assessments (
            id,
            assessment_id,
            order_index,
            due_date
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Get all module IDs to fetch assignment counts from module_assignments table
      const allModuleIds = (data as unknown as Course[]).flatMap(
        course => course.course_modules?.map(cm => cm.module.id) || []
      );
      
      // Fetch assignment counts from the new module_assignments table
      let assignmentCounts: Record<string, number> = {};
      if (allModuleIds.length > 0) {
        const { data: assignmentsData } = await supabase
          .from("module_assignments" as any)
          .select("module_id")
          .in("module_id", allModuleIds);
        
        // Count assignments per module
        const rows = (assignmentsData || []) as unknown as { module_id: string }[];
        rows.forEach((row) => {
          assignmentCounts[row.module_id] = (assignmentCounts[row.module_id] || 0) + 1;
        });
      }
      
      // Compute total assignment count for each course using the new table data
      const coursesWithAssignments = (data as unknown as Course[]).map(course => {
        let totalAssignmentCount = 0;
        course.course_modules?.forEach(cm => {
          totalAssignmentCount += assignmentCounts[cm.module.id] || 0;
        });
        return { ...course, totalAssignmentCount };
      });
      
      return coursesWithAssignments;
    },
  });

  const filteredCourses = useMemo(() => {
    let result = [...courses];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (course) =>
          course.title.toLowerCase().includes(query) ||
          course.description?.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (statusFilter === "published") {
      result = result.filter((course) => course.is_published);
    } else if (statusFilter === "draft") {
      result = result.filter((course) => !course.is_published);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "title") {
        comparison = a.title.localeCompare(b.title);
      } else if (sortBy === "created_at") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === "updated_at") {
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    return result;
  }, [courses, searchQuery, statusFilter, sortBy, sortOrder]);

  return {
    courses: filteredCourses,
    allCourses: courses,
    isLoading,
    refetch,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
  };
}
