import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourseProgress } from "@/hooks/useCourseProgress";
import { useCourseAssessments } from "@/hooks/useCourseAssessments";
import { useMySubmissions } from "@/hooks/useAssessmentSubmissions";
import { useMyModuleAssignmentSubmissions } from "@/hooks/useModuleAssignmentSubmissions";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import ModuleRouter from "@/components/ModuleRouter";
import { AssessmentSubmitter } from "@/components/AssessmentSubmitter";
import { AddModuleToCourseDialog } from "@/components/AddModuleToCourseDialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Play,
  CheckCircle,
  Trophy,
  RotateCcw,
  FileText,
  Presentation,
  ClipboardList,
  Clock,
  Send,
  Plus,
  HelpCircle,
} from "lucide-react";

interface CourseModule {
  id: string;
  module_id: string;
  order_index: number;
  module: {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    module_type: string;
    slides: any;
    quiz_data: any;
    assignment_data: any;
    is_published: boolean | null;
    time_limit_minutes: number | null;
  };
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  passing_score: number;
  course_modules: CourseModule[];
}

export default function CourseViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isSMEExpert } = useUserRole();
  const [activeModuleIndex, setActiveModuleIndex] = useState<number | null>(null);
  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(null);
  const [addModuleDialogOpen, setAddModuleDialogOpen] = useState(false);
  const [isContentComplete, setIsContentComplete] = useState(false);
  const { progress, isLoading: progressLoading, resetProgress, updateProgress, recheckCompletion } = useCourseProgress(id || "");
  const { courseAssessments, isLoading: assessmentsLoading } = useCourseAssessments(id || "");
  const { submissions } = useMySubmissions();
  const { submissions: moduleAssignmentSubs } = useMyModuleAssignmentSubmissions({ courseId: id });

  // Handle incoming assessmentId from navigation state
  useEffect(() => {
    const state = location.state as { assessmentId?: string } | null;
    if (state?.assessmentId) {
      setActiveAssessmentId(state.assessmentId);
      // Clear the state to prevent re-triggering on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const { data: course, isLoading } = useQuery({
    queryKey: ["course", id],
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
              module_type,
              slides,
              quiz_data,
              assignment_data,
              is_published,
              time_limit_minutes
            )
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      // Sort modules by order_index
      const sorted = {
        ...data,
        course_modules: data.course_modules.sort(
          (a: CourseModule, b: CourseModule) => a.order_index - b.order_index
        ),
      };
      return sorted as unknown as Course;
    },
    enabled: !!id,
  });

  // Fetch quizzes and assignments from the new tables for all modules in the course
  const moduleIds = course?.course_modules?.map(cm => cm.module.id) || [];
  
  const { data: moduleQuizzes } = useQuery({
    queryKey: ["course-module-quizzes", id, moduleIds],
    queryFn: async () => {
      if (moduleIds.length === 0) return [];
      const { data, error } = await supabase
        .from("module_quizzes" as any)
        .select("*")
        .in("module_id", moduleIds);
      if (error) throw error;
      return (data || []) as unknown as Array<{ module_id: string; questions: any[]; settings: any }>;
    },
    enabled: moduleIds.length > 0,
  });

  const { data: moduleAssignments } = useQuery({
    queryKey: ["course-module-assignments", id, moduleIds],
    queryFn: async () => {
      if (moduleIds.length === 0) return [];
      const { data, error } = await supabase
        .from("module_assignments" as any)
        .select("*")
        .in("module_id", moduleIds)
        .order("order_index");
      if (error) throw error;
      return (data || []) as unknown as Array<{ module_id: string; title: string; goal: string; instructions: string }>;
    },
    enabled: moduleIds.length > 0,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Auto-finalize a module once content/quiz score is recorded AND all assignments are submitted.
  // NOTE: must be declared before any early returns to keep hook order stable.
  useEffect(() => {
    if (!progress) return;
    const courseData = course;
    if (!courseData) return;
    const mods = courseData.course_modules || [];
    const scores = progress.module_scores || {};
    const isAssignmentDone = (moduleId: string) => {
      const list = (moduleAssignments || []).filter((a: any) => a.module_id === moduleId);
      if (list.length === 0) return true;
      return list.every((a: any) => {
        const sub: any = (moduleAssignmentSubs || []).find(
          (s) => s.module_assignment_id === a.id && s.course_id === id
        );
        return sub && (sub.status === "submitted" || sub.status === "graded");
      });
    };
    const totalCourseAssessments = courseAssessments?.length || 0;
    const satisfiedCourseAssessments = courseAssessments?.filter((ca: any) => {
      const sub: any = submissions?.find((s) => s.assessment_id === ca.assessment_id && s.course_id === id);
      return sub?.status === "graded";
    }).length || 0;
    const courseAssessmentsSatisfied = totalCourseAssessments === 0 || satisfiedCourseAssessments >= totalCourseAssessments;

    let ranModuleUpdate = false;
    for (const cm of mods) {
      const mid = cm.module.id;
      const ms = scores[mid];
      if (!ms || ms.completed) continue;
      if (!isAssignmentDone(mid)) continue;
      updateProgress({
        moduleId: mid,
        score: ms.score,
        totalModules: mods.length,
        passingScore: courseData.passing_score,
        isQuiz: false,
        isFirstAttempt: false,
        assignmentsSatisfied: true,
        courseAssessmentsSatisfied,
      });
      ranModuleUpdate = true;
      break;
    }

    // If no module needed updating (all already marked completed), but the
    // course's overall completion might still be stale because a course-level
    // assessment was just submitted/graded - recheck directly.
    if (!ranModuleUpdate) {
      recheckCompletion({
        totalModules: mods.length,
        passingScore: courseData.passing_score,
        courseAssessmentsSatisfied,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.module_scores, progress?.is_completed, moduleAssignmentSubs, moduleAssignments, course, id, courseAssessments, submissions]);

  if (authLoading || isLoading || progressLoading || assessmentsLoading) {
    return (
      <AppSidebar>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 py-8">
            <Skeleton className="h-8 w-64 mb-4" />
            <Skeleton className="h-4 w-96 mb-8" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </AppSidebar>
    );
  }

  if (!course) {
    return (
      <AppSidebar>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 py-16 text-center">
            <h1 className="text-2xl font-bold mb-4">Course not found</h1>
            <Button onClick={() => navigate("/courses")}>Back to Courses</Button>
          </div>
        </div>
      </AppSidebar>
    );
  }

  const modules = course.course_modules;
  const totalModules = modules.length;
  const totalAssessments = courseAssessments?.length || 0;
  const moduleScores = progress?.module_scores || {};
  const completedModules = Object.values(moduleScores).filter((m) => m.completed).length;
  
  // Get assessment completion status
  const getAssessmentSubmission = (assessmentId: string) => {
    return submissions?.find(
      (s) => s.assessment_id === assessmentId && s.course_id === id
    );
  };

  const completedAssessments = courseAssessments?.filter((ca) => {
    const submission = getAssessmentSubmission(ca.assessment_id);
    return submission?.status === "graded";
  }).length || 0;

  // Calculate combined progress (70% modules, 30% assessments)
  const moduleProgress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;
  const assessmentProgress = totalAssessments > 0 ? (completedAssessments / totalAssessments) * 100 : 100;
  const progressPercent = totalAssessments > 0 
    ? Math.round(moduleProgress * 0.7 + assessmentProgress * 0.3)
    : Math.round(moduleProgress);

  const isModuleCompleted = (moduleId: string) => {
    return moduleScores[moduleId]?.completed || false;
  };

  const getModuleScore = (moduleId: string) => {
    return moduleScores[moduleId]?.score;
  };

  const getAssessmentStatus = (assessmentId: string) => {
    const submission = getAssessmentSubmission(assessmentId);
    return submission?.status || "not_submitted";
  };

  const getAssessmentScore = (assessmentId: string) => {
    const submission = getAssessmentSubmission(assessmentId);
    return submission?.score;
  };

  // If viewing an assessment
  if (activeAssessmentId) {
    const activeAssessment = courseAssessments?.find(
      (ca) => ca.assessment_id === activeAssessmentId
    );
    if (activeAssessment?.assessment) {
      return (
        <div className="min-h-screen bg-background">
          <div className="border-b bg-card/50 px-4 py-3">
            <div className="container mx-auto flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveAssessmentId(null)}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Course
              </Button>
              <span className="text-sm text-muted-foreground">
                Assessment: {activeAssessment.assessment.title}
              </span>
            </div>
          </div>
          <div className="container mx-auto px-4 py-8 max-w-3xl">
            <AssessmentSubmitter
              assessmentId={activeAssessmentId}
              courseId={id!}
              title={activeAssessment.assessment.title}
              description={activeAssessment.assessment.description}
              instructions={activeAssessment.assessment.instructions}
              maxScore={activeAssessment.assessment.max_score}
              onSubmitted={() => setActiveAssessmentId(null)}
            />
          </div>
        </div>
      );
    }
  }

  // Module-assignment helpers
  const getModuleAssignments = (moduleId: string) =>
    (moduleAssignments || []).filter((a: any) => a.module_id === moduleId);

  const isAssignmentDoneForModule = (moduleId: string) => {
    const list = getModuleAssignments(moduleId);
    if (list.length === 0) return true;
    return list.every((a: any) => {
      const sub: any = (moduleAssignmentSubs || []).find(
        (s) => s.module_assignment_id === a.id && s.course_id === id
      );
      return sub && (sub.status === "submitted" || sub.status === "graded");
    });
  };

  // Handle module completion (only marks completed if assignments are done)
  const handleModuleComplete = (moduleId: string, score: number, isFirstAttempt: boolean, hasQuiz: boolean) => {
    const assignmentsSatisfied = isAssignmentDoneForModule(moduleId);
    const courseAssessmentsSatisfied = totalAssessments === 0 || completedAssessments >= totalAssessments;
    updateProgress({
      moduleId,
      score,
      totalModules,
      passingScore: course.passing_score,
      isQuiz: hasQuiz,
      isFirstAttempt,
      assignmentsSatisfied,
      courseAssessmentsSatisfied,
    });

    if (assignmentsSatisfied) {
      toast.success(`Module completed with ${score}% score!`, {
        icon: <Trophy className="h-4 w-4 text-yellow-500" />,
      });
      setActiveModuleIndex(null);
    } else {
      toast.info("Submit the module assignments to finish this module.");
      navigate(`/courses/${id}/module/${moduleId}/assignments`, {
        state: { moduleTitle: modules.find(m => m.module.id === moduleId)?.module.title },
      });
    }
  };

  // (auto-finalize effect moved above early returns to preserve hook order)

  // If viewing a module
  if (activeModuleIndex !== null) {
    const currentModule = modules[activeModuleIndex];
    const slides = currentModule.module.slides as any;
    
    // Get quiz data - first check new module_quizzes table, then fall back to embedded data
    const moduleQuizData = moduleQuizzes?.find(q => q.module_id === currentModule.module.id);
    const quizQuestions = moduleQuizData?.questions || 
                          currentModule.module.quiz_data?.questions ||
                          slides?.quiz || 
                          [];
    const moduleHasQuiz = Array.isArray(quizQuestions) && quizQuestions.length > 0;
    
    // Get assignments from new table
    const moduleAssignmentsList = moduleAssignments?.filter(a => a.module_id === currentModule.module.id) || [];
    
    // Normalize module data for the router - WITHOUT quiz data (quiz is on separate page now)
    const normalizedModule = {
      title: currentModule.module.title,
      description: currentModule.module.description,
      type: currentModule.module.module_type,
      module_type: currentModule.module.module_type,
      // Pass through slides data - could be file-based or AI-generated
      slides: slides,
      // Also spread slides properties at top level for easier detection
      fileUrl: slides?.fileUrl,
      fileName: slides?.fileName,
      sections: slides?.sections,
      chapters: slides?.chapters,
      definitions: slides?.definitions,
      learning_objectives: slides?.learning_objectives,
      key_points: slides?.key_points,
      content_summary: slides?.content_summary,
      heroImageUrl: slides?.heroImageUrl,
      // Don't pass quiz data - quiz is displayed on separate page
      quiz: [],
      quiz_data: null,
      // Include assignments from new table
      assignments: moduleAssignmentsList,
      is_published: currentModule.module.is_published,
    };

    const handleContentComplete = () => {
      setIsContentComplete(true);
    };

    const handleTakeQuiz = () => {
      navigate(`/courses/${id}/module/${currentModule.module.id}/quiz`, {
        state: {
          moduleTitle: currentModule.module.title,
          passingScore: course.passing_score,
          totalModules,
        },
      });
    };

    // For modules without quiz, complete directly when content is done
    const handleModuleCompleteWithoutQuiz = () => {
      handleModuleComplete(currentModule.module.id, 100, true, false);
    };
    
    return (
      <div className="min-h-screen bg-background">
        {/* Header that appears on hover */}
        <div className="group fixed top-0 left-0 right-0 z-50">
          <div className="h-2 w-full" /> {/* Hover trigger area */}
          <div className="border-b bg-card/95 backdrop-blur-sm px-4 py-3 opacity-0 -translate-y-full transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
            <div className="container mx-auto flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActiveModuleIndex(null);
                  setIsContentComplete(false);
                }}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Course
              </Button>
              <span className="text-sm text-muted-foreground">
                Module {activeModuleIndex + 1} of {totalModules}
              </span>
            </div>
          </div>
        </div>
        
        <ModuleRouter
          module={normalizedModule}
          moduleType={currentModule.module.module_type}
          savedModuleId={currentModule.module.id}
          timeLimitMinutes={currentModule.module.time_limit_minutes || undefined}
          isModulePublished={currentModule.module.is_published ?? false}
          passingScore={course.passing_score}
          onComplete={moduleHasQuiz ? undefined : handleModuleCompleteWithoutQuiz}
          onContentComplete={handleContentComplete}
        />

        {/* Take Quiz Button - appears after content is complete */}
        {isContentComplete && moduleHasQuiz && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t p-4">
            <div className="container mx-auto flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Content complete! Ready to test your knowledge?
                </p>
                <Button size="lg" onClick={handleTakeQuiz} className="gap-2">
                  <HelpCircle className="w-5 h-5" />
                  Take Quiz ({quizQuestions.length} questions)
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const ModuleIcon = ({ type }: { type: string }) => {
    if (type === "presentation") return <Presentation className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  return (
    <AppSidebar>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/courses")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{course.title}</h1>
            {course.description && (
              <p className="text-muted-foreground mt-1">{course.description}</p>
            )}
          </div>
          {isSMEExpert && (
            <Button onClick={() => setAddModuleDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Module
            </Button>
          )}
        </div>

        {/* Progress Overview */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-medium">Course Progress</h3>
                <p className="text-sm text-muted-foreground">
                  {completedModules} of {totalModules} modules completed
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{progressPercent}%</p>
                <p className="text-xs text-muted-foreground">
                  Pass: {course.passing_score}%
                </p>
              </div>
            </div>
            <Progress value={progressPercent} className="h-2" />

            {progress?.is_completed && (
              <div className="mt-4 flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
                <Trophy className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-medium text-primary">Course Completed!</p>
                  <p className="text-sm text-muted-foreground">
                    Final Score: {progress.overall_score}% 
                    {progress.overall_score >= course.passing_score ? " - Passed!" : " - Below passing score"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto gap-2"
                  onClick={() => resetProgress()}
                >
                  <RotateCcw className="w-4 h-4" />
                  Restart
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Module List */}
        <div className="space-y-3">
          <h3 className="font-medium mb-4">Modules</h3>
          {modules.map((cm, index) => {
            const completed = isModuleCompleted(cm.module.id);
            const score = getModuleScore(cm.module.id);
            const moduleAsgs = getModuleAssignments(cm.module.id);
            const hasAsgs = moduleAsgs.length > 0;
            const asgsDone = isAssignmentDoneForModule(cm.module.id);

            return (
              <Card
                key={cm.id}
                className={`transition-all hover:shadow-md ${
                  completed ? "border-primary/30 bg-primary/5" : ""
                }`}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-medium">
                    {completed ? (
                      <CheckCircle className="w-5 h-5 text-primary" />
                    ) : (
                      index + 1
                    )}
                  </div>

                  <div className="w-14 h-14 rounded bg-muted flex items-center justify-center shrink-0">
                    {cm.module.thumbnail_url ? (
                      <img
                        src={cm.module.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <ModuleIcon type={cm.module.module_type} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setActiveModuleIndex(index)}>
                    <p className="font-medium line-clamp-1">{cm.module.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {cm.module.module_type}
                      </Badge>
                      {cm.module.time_limit_minutes && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {cm.module.time_limit_minutes >= 60
                            ? `${Math.floor(cm.module.time_limit_minutes / 60)}h ${cm.module.time_limit_minutes % 60}m`
                            : `${cm.module.time_limit_minutes} min`}
                        </Badge>
                      )}
                      {hasAsgs && (
                        <Badge
                          variant={asgsDone ? "default" : "secondary"}
                          className="text-xs gap-1"
                        >
                          <ClipboardList className="w-3 h-3" />
                          {asgsDone ? "Assignments done" : `${moduleAsgs.length} assignment${moduleAsgs.length > 1 ? "s" : ""}`}
                        </Badge>
                      )}
                      {completed && score !== undefined && (
                        <Badge
                          variant={score >= course.passing_score ? "default" : "secondary"}
                          className="text-xs"
                        >
                          Score: {score}%
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasAsgs && !asgsDone && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/courses/${id}/module/${cm.module.id}/assignments`, {
                            state: { moduleTitle: cm.module.title },
                          });
                        }}
                      >
                        <ClipboardList className="w-3 h-3" />
                        Assignments
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={completed ? "outline" : "default"}
                      className="gap-1"
                      onClick={() => setActiveModuleIndex(index)}
                    >
                      {completed ? (
                        <>
                          <RotateCcw className="w-3 h-3" />
                          Retry
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" />
                          Start
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Assessments Section */}
        {courseAssessments && courseAssessments.length > 0 && (
          <div className="space-y-3 mt-8">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Assessments
            </h3>
            {courseAssessments.map((ca) => {
              const status = getAssessmentStatus(ca.assessment_id);
              const score = getAssessmentScore(ca.assessment_id);
              const isCompleted = status === "graded";

              const statusConfig = {
                not_submitted: { label: "Not Submitted", className: "bg-yellow-100 text-yellow-800", icon: Clock },
                submitted: { label: "Pending Review", className: "bg-blue-100 text-blue-800", icon: Send },
                graded: { label: "Graded", className: "bg-green-100 text-green-800", icon: CheckCircle },
                needs_revision: { label: "Needs Revision", className: "bg-red-100 text-red-800", icon: Clock },
              };

              const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.not_submitted;
              const StatusIcon = config.icon;

              return (
                <Card
                  key={ca.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isCompleted ? "border-primary/30 bg-primary/5" : ""
                  }`}
                  onClick={() => setActiveAssessmentId(ca.assessment_id)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-primary" />
                      ) : (
                        <ClipboardList className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium line-clamp-1">
                        {ca.assessment?.title || "Assessment"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`text-xs ${config.className}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {config.label}
                        </Badge>
                        {score !== null && score !== undefined && (
                          <Badge variant="outline" className="text-xs">
                            Score: {score}/{ca.assessment?.max_score || 100}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button 
                      size="sm" 
                      variant={status === "not_submitted" ? "default" : "outline"} 
                      className="gap-1"
                    >
                      {status === "not_submitted" ? (
                        <>
                          <Play className="w-3 h-3" />
                          Start
                        </>
                      ) : status === "needs_revision" ? (
                        <>
                          <RotateCcw className="w-3 h-3" />
                          Revise
                        </>
                      ) : (
                        <>
                          <FileText className="w-3 h-3" />
                          View
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        </div>

        {/* Add Module Dialog for SME Experts */}
        {isSMEExpert && (
          <AddModuleToCourseDialog
            open={addModuleDialogOpen}
            onOpenChange={setAddModuleDialogOpen}
            courseId={id!}
            courseTitle={course.title}
            existingModuleIds={modules.map((cm) => cm.module.id)}
          />
        )}
      </div>
    </AppSidebar>
  );
}
