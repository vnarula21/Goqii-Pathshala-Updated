import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useModuleQuizzes } from "@/hooks/useModuleQuizzes";
import { useCourseProgress } from "@/hooks/useCourseProgress";
import { useModuleAssignments } from "@/hooks/useModuleAssignments";
import { useMyModuleAssignmentSubmissions } from "@/hooks/useModuleAssignmentSubmissions";
import { selectShuffledQuizQuestions } from "@/lib/quizShuffle";
import QuizModuleDisplay from "@/components/QuizModuleDisplay";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LocationState {
  moduleTitle?: string;
  passingScore?: number;
  totalModules?: number;
}

export default function ModuleQuizPage() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { updateProgress } = useCourseProgress(courseId || "");
  
  // Get state passed from CourseViewer
  const state = location.state as LocationState | null;
  const moduleTitle = state?.moduleTitle || "Module";
  const passingScore = state?.passingScore || 70;
  const totalModules = state?.totalModules || 1;

  // Fetch quiz data from the module_quizzes table
  const { data: quizData, isLoading: quizLoading } = useModuleQuizzes(moduleId);

  // Fetch module details as fallback for quiz data
  const { data: moduleData, isLoading: moduleLoading } = useQuery({
    queryKey: ["module-for-quiz", moduleId],
    queryFn: async () => {
      if (!moduleId) return null;
      const { data, error } = await supabase
        .from("modules")
        .select("title, quiz_data, slides")
        .eq("id", moduleId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!moduleId && !quizData,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Get quiz questions - prioritize new table, fallback to module data
  const getQuizQuestions = () => {
    if (quizData?.questions && Array.isArray(quizData.questions) && quizData.questions.length > 0) {
      return quizData.questions;
    }
    const quizDataJson = moduleData?.quiz_data as Record<string, any> | null;
    const slidesJson = moduleData?.slides as Record<string, any> | null;
    if (quizDataJson?.questions) {
      return quizDataJson.questions;
    }
    if (slidesJson?.quiz) {
      return slidesJson.quiz;
    }
    return [];
  };

  const questions = getQuizQuestions();
  const effectiveTitle = quizData?.module_name || moduleData?.title || moduleTitle;

  const rawQuizSettings = quizData?.settings || (moduleData?.quiz_data as Record<string, any> | null)?.settings;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shuffledQuestions = useMemo(
    () => selectShuffledQuizQuestions(questions, rawQuizSettings?.questionsToShow),
    [moduleId]
  );

  const { data: assignments } = useModuleAssignments(moduleId);
  const assignmentCount = assignments?.length || 0;
  const { submissions: maSubs } = useMyModuleAssignmentSubmissions({ moduleId, courseId });

  const assignmentsSatisfied = (() => {
    if (!assignments || assignments.length === 0) return true;
    return assignments.every((a: any) =>
      maSubs.some((s) => s.module_assignment_id === a.id && (s.status === "submitted" || s.status === "graded"))
    );
  })();

  const handleQuizComplete = (score: number, isFirstAttempt: boolean) => {
    if (moduleId) {
      updateProgress({
        moduleId,
        score,
        totalModules,
        passingScore,
        isQuiz: true,
        isFirstAttempt,
        assignmentsSatisfied,
      });

      toast.success(`Quiz completed with ${score}% score!`, {
        icon: <Trophy className="h-4 w-4 text-yellow-500" />,
      });

      if (!assignmentsSatisfied) {
        toast.info("Complete the module assignments to finish this module.");
      }
    }
  };

  const handleViewAssignments = () => {
    navigate(`/courses/${courseId}/module/${moduleId}/assignments`, {
      state: { moduleTitle: effectiveTitle }
    });
  };

  const handleContinue = () => {
    navigate(`/courses/${courseId}`);
  };

  const handleBackToCourse = () => {
    navigate(`/courses/${courseId}`);
  };

  if (authLoading || quizLoading || moduleLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card/50 px-4 py-3">
          <div className="container mx-auto">
            <Skeleton className="h-8 w-48" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card/50 px-4 py-3">
          <div className="container mx-auto flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToCourse}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Course
            </Button>
          </div>
        </div>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">No Quiz Available</h1>
          <p className="text-muted-foreground mb-6">
            This module doesn't have a quiz yet.
          </p>
          <Button onClick={handleBackToCourse}>Return to Course</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 px-4 py-3">
        <div className="container mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToCourse}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Course
          </Button>
          <span className="text-sm text-muted-foreground">
            Quiz: {effectiveTitle}
          </span>
        </div>
      </div>

      {/* Quiz Content */}
      <div className="py-8">
        <QuizModuleDisplay
          module={{
            title: `${effectiveTitle} - Quiz`,
            questions: shuffledQuestions,
          }}
          savedModuleId={moduleId}
          passingScore={passingScore}
          onComplete={handleQuizComplete}
          assignmentCount={assignmentCount}
          onViewAssignments={handleViewAssignments}
          onContinue={handleContinue}
        />
      </div>
    </div>
  );
}
