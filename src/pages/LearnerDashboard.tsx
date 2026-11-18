import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LearnerCourseCard } from "@/components/LearnerCourseCard";
import { AssignmentCard, AssignmentStatus } from "@/components/AssignmentCard";
import { RecentActivityTimeline, ActivityItem } from "@/components/RecentActivityTimeline";
import { useMySubmissions, usePendingAssessments } from "@/hooks/useAssessmentSubmissions";
import { usePendingModuleAssignments } from "@/hooks/useModuleAssignmentSubmissions";
import { useNavigate, Link } from "react-router-dom";
import { useGamification } from "@/hooks/useGamification";
import { XPMeter, StreakBadge, BadgeShowcase, Leaderboard } from "@/components/gamification";
import { PieChartCard, PieChartData } from "@/components/PieChartCard";
import { 
  BookOpen, 
  GraduationCap, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  TrendingUp,
  Flame,
  Target,
  Award,
  FileText,
  Trophy
} from "lucide-react";

// Chart colors
const CHART_COLORS = {
  completed: "hsl(142, 70%, 35%)",   // Green
  inProgress: "hsl(38, 92%, 50%)",   // Amber
  notStarted: "hsl(220, 9%, 60%)",   // Gray
  xp: "hsl(262, 83%, 58%)",          // Purple
  badges: "hsl(199, 89%, 48%)",      // Blue
};

interface CourseWithProgress {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  progress: number;
  isCompleted: boolean;
}

export default function LearnerDashboard() {
  const { user } = useAuth();
  const { submissions: mySubmissions, isLoading: submissionsLoading } = useMySubmissions();
  const { pendingAssessments, isLoading: pendingLoading } = usePendingAssessments();
  const { pendingModuleAssignments } = usePendingModuleAssignments();
  const navigate = useNavigate();
  const { 
    userXP, 
    userStreak, 
    userBadges, 
    allBadges, 
    isLoading: gamificationLoading,
    currentLevel,
    levelTitle,
    xpProgress,
    xpToNextLevel,
    updateStreak,
    syncBadges
  } = useGamification();
  
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  // Update streak on dashboard load
  useEffect(() => {
    if (user) {
      updateStreak();
    }
  }, [user]);

  // Award any badges the learner has already qualified for.
  useEffect(() => {
    if (!gamificationLoading && allBadges.length > 0) syncBadges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamificationLoading, allBadges.length, userBadges?.length]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // Fetch courses assigned to learner (via course_assignments)
        const { data: coursesData } = await supabase
          .from("courses")
          .select("*");

        // Fetch course progress
        const { data: progressData } = await supabase
          .from("course_progress")
          .select("*")
          .eq("user_id", user.id);

        // Combine courses with progress
        const coursesWithProgress = (coursesData || []).map((course) => {
          const progress = progressData?.find((p) => p.course_id === course.id);
          return {
            ...course,
            progress: progress?.overall_score || 0,
            isCompleted: progress?.is_completed || false,
          };
        });

        setCourses(coursesWithProgress);
      } catch (error) {
        console.error("Error fetching learner data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const pendingCourses = courses.filter((c) => !c.isCompleted && c.progress > 0);
  const completedCourses = courses.filter((c) => c.isCompleted);
  const availableCourses = courses.filter((c) => !c.isCompleted && c.progress === 0);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    if (courses.length === 0) return 0;
    const totalProgress = courses.reduce((sum, c) => sum + (c.isCompleted ? 100 : c.progress), 0);
    return Math.round(totalProgress / courses.length);
  }, [courses]);

  // Mock activities for now (will be replaced with real data in Phase B)
  const recentActivities: ActivityItem[] = useMemo(() => {
    const activities: ActivityItem[] = [];
    
    // Generate activities from course progress
    completedCourses.slice(0, 2).forEach((course, index) => {
      activities.push({
        id: `completed-${course.id}`,
        type: "course_completed",
        title: `Completed "${course.title}"`,
        description: "Well done! You've finished this course.",
        timestamp: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000),
        metadata: { score: course.progress },
      });
    });

    pendingCourses.slice(0, 2).forEach((course, index) => {
      activities.push({
        id: `progress-${course.id}`,
        type: "module_completed",
        title: `Made progress in "${course.title}"`,
        description: `Currently at ${course.progress}% completion`,
        timestamp: new Date(Date.now() - (index + 1) * 12 * 60 * 60 * 1000),
      });
    });

    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5);
  }, [completedCourses, pendingCourses]);

  // Merge: course assessments + module assignments
  const assignments = useMemo(() => {
    const fromAssessments = (pendingAssessments || []).map((pa: any) => ({
      id: pa.id,
      kind: "assessment" as const,
      assessmentId: pa.assessmentId,
      courseId: pa.courseId,
      title: pa.title,
      description: pa.description,
      courseName: pa.courseName,
      dueDate: pa.dueDate ? new Date(pa.dueDate) : null,
      status: pa.status as AssignmentStatus,
      grade: pa.score ? (pa.score / pa.maxScore) * 100 : undefined,
      maxScore: pa.maxScore,
      score: pa.score,
      managerComments: pa.managerComments,
      submittedFiles: pa.submittedFiles || [],
      onAction: undefined as undefined | (() => void),
    }));

    const fromModuleAssignments = (pendingModuleAssignments || []).map((ma: any) => ({
      id: ma.id,
      kind: "module_assignment" as const,
      assessmentId: undefined as string | undefined,
      courseId: ma.courseId,
      title: `${ma.moduleName} — ${ma.title}`,
      description: ma.description,
      courseName: ma.courseName,
      dueDate: null as Date | null,
      status: ma.status as AssignmentStatus,
      grade: ma.score ? (ma.score / ma.maxScore) * 100 : undefined,
      maxScore: ma.maxScore,
      score: ma.score,
      managerComments: ma.managerComments,
      submittedFiles: ma.submittedFiles || [],
      onAction: () =>
        navigate(`/courses/${ma.courseId}/module/${ma.moduleId}/assignments`, {
          state: { moduleTitle: ma.moduleName },
        }),
    }));

    return [...fromAssessments, ...fromModuleAssignments];
  }, [pendingAssessments, pendingModuleAssignments, navigate]);

  const pendingAssignmentsList = assignments.filter(a => a.status !== "graded" && a.status !== "needs_revision");
  const reviewedAssignmentsList = assignments.filter(a => a.status === "graded" || a.status === "needs_revision");

  if (loading || submissionsLoading || pendingLoading) {
    return (
      <AppSidebar>
        <div className="min-h-screen bg-gradient-subtle">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
            </div>
          </div>
        </div>
      </AppSidebar>
    );
  }

  return (
    <AppSidebar>
      <div className="min-h-screen bg-gradient-subtle">
        <div className="container mx-auto px-3 py-4 max-w-7xl">
        
        {/* Compact Hero Header */}
        <div className="bg-card rounded-xl p-4 shadow-sm border mb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Welcome Text */}
            <div className="flex-1">
              <h1 className="text-xl font-bold mb-1">
                Welcome back, {user?.user_metadata?.full_name?.split(' ')[0] || "Learner"}! 👋
              </h1>
              <p className="text-muted-foreground text-sm">
                Continue learning and earn XP to level up.
              </p>
              {courses.length > 0 && (
                <Badge 
                  variant="outline" 
                  className="mt-2 px-2 py-0.5 text-xs"
                >
                  <Target className="h-3 w-3 mr-1" />
                  {courses.length} Course{courses.length !== 1 ? 's' : ''} Assigned
                </Badge>
              )}
            </div>

            {/* Gamification Stats - Compact */}
            <Link
              to="/learner/achievements"
              title="See how to earn XP and rewards"
              className="flex items-center gap-4 rounded-lg p-2 -m-2 hover:bg-muted/50 transition-colors"
            >
              {userStreak && (
                <StreakBadge
                  currentStreak={userStreak.current_streak}
                  longestStreak={userStreak.longest_streak}
                  freezeAvailable={userStreak.freeze_available}
                  size="sm"
                />
              )}
              <XPMeter
                currentXP={userXP?.total_xp || 0}
                xpProgress={xpProgress}
                currentLevel={currentLevel}
                levelTitle={levelTitle}
                xpToNextLevel={xpToNextLevel}
                size="sm"
              />
            </Link>
          </div>
        </div>

        {/* Compact Stats Grid */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/15 rounded-lg">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{courses.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-secondary/5 to-secondary/10">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-secondary/15 rounded-lg">
                  <Flame className="h-4 w-4 text-secondary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{pendingCourses.length}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-[hsl(var(--success))]/5 to-[hsl(var(--success))]/10">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[hsl(var(--success))]/15 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                </div>
                <div>
                  <p className="text-xl font-bold">{completedCourses.length}</p>
                  <p className="text-xs text-muted-foreground">Done</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-accent/5 to-accent/10">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-accent/15 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-xl font-bold">{availableCourses.length}</p>
                  <p className="text-xs text-muted-foreground">Available</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pie Charts Section */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <PieChartCard
            title="Course Progress"
            icon={BookOpen}
            data={[
              { name: "Completed", value: completedCourses.length, color: CHART_COLORS.completed },
              { name: "In Progress", value: pendingCourses.length, color: CHART_COLORS.inProgress },
              { name: "Not Started", value: availableCourses.length, color: CHART_COLORS.notStarted },
            ]}
            centerLabel="Courses"
            centerValue={courses.length}
            emptyMessage="No courses assigned yet"
          />
          <PieChartCard
            title="Performance"
            icon={Trophy}
            data={[
              { name: "XP Earned", value: userXP?.total_xp || 0, color: CHART_COLORS.xp },
              { name: "Badges", value: userBadges?.length || 0, color: CHART_COLORS.badges },
              { name: "Streak Days", value: userStreak?.current_streak || 0, color: CHART_COLORS.completed },
            ]}
            centerLabel="Level"
            centerValue={currentLevel}
            emptyMessage="Start learning to earn XP!"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Left Column - Courses */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Continue Learning Section */}
            {pendingCourses.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-secondary/10 rounded-md">
                    <Flame className="h-4 w-4 text-secondary" />
                  </div>
                  <h2 className="text-sm font-semibold">Continue Learning</h2>
                  <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">
                    {pendingCourses.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {pendingCourses.map((course) => (
                    <LearnerCourseCard
                      key={course.id}
                      id={course.id}
                      title={course.title}
                      description={course.description}
                      thumbnailUrl={course.thumbnail_url}
                      progress={course.progress}
                      isCompleted={course.isCompleted}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Available Courses Section */}
            {availableCourses.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-accent/10 rounded-md">
                    <BookOpen className="h-4 w-4 text-accent" />
                  </div>
                  <h2 className="text-sm font-semibold">Available Courses</h2>
                  <Badge variant="outline" className="ml-auto text-xs h-5 px-1.5">
                    {availableCourses.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {availableCourses.map((course) => (
                    <LearnerCourseCard
                      key={course.id}
                      id={course.id}
                      title={course.title}
                      description={course.description}
                      thumbnailUrl={course.thumbnail_url}
                      progress={course.progress}
                      isCompleted={course.isCompleted}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completed Courses Section */}
            {completedCourses.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-[hsl(var(--success))]/10 rounded-md">
                    <Award className="h-4 w-4 text-[hsl(var(--success))]" />
                  </div>
                  <h2 className="text-sm font-semibold">Completed</h2>
                  <Badge className="ml-auto text-xs h-5 px-1.5 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]">
                    {completedCourses.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {completedCourses.map((course) => (
                    <LearnerCourseCard
                      key={course.id}
                      id={course.id}
                      title={course.title}
                      description={course.description}
                      thumbnailUrl={course.thumbnail_url}
                      progress={course.progress}
                      isCompleted={course.isCompleted}
                      score={course.progress}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* No Courses State */}
            {courses.length === 0 && (
              <Card className="text-center py-10 border-dashed">
                <CardContent>
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <GraduationCap className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-semibold mb-1">No courses assigned</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Please wait for your manager to assign courses to you.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-3">
            {/* Pending Assignments Card */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-secondary/10 rounded-md">
                    <FileText className="h-4 w-4 text-secondary" />
                  </div>
                  <CardTitle className="text-sm font-medium">Pending Assignments</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
              {pendingAssignmentsList.length > 0 ? (
                  <div className="space-y-2">
                    {pendingAssignmentsList.map((assignment) => (
                      <AssignmentCard
                        key={assignment.id}
                        id={assignment.id}
                        assessmentId={assignment.assessmentId}
                        courseId={assignment.courseId}
                        title={assignment.title}
                        description={assignment.description}
                        courseName={assignment.courseName}
                        dueDate={assignment.dueDate}
                        status={assignment.status}
                        grade={assignment.grade}
                        submittedFiles={assignment.submittedFiles}
                        managerComments={assignment.managerComments}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-muted flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      No pending assignments 🎉
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reviewed Assignments Card */}
            {reviewedAssignmentsList.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-[hsl(var(--success))]/10 rounded-md">
                      <Award className="h-4 w-4 text-[hsl(var(--success))]" />
                    </div>
                    <CardTitle className="text-sm font-medium">Reviewed</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="space-y-2">
                    {reviewedAssignmentsList.map((assignment) => (
                      <AssignmentCard
                        key={assignment.id}
                        id={assignment.id}
                        assessmentId={assignment.assessmentId}
                        courseId={assignment.courseId}
                        title={assignment.title}
                        description={assignment.description}
                        courseName={assignment.courseName}
                        dueDate={assignment.dueDate}
                        status={assignment.status}
                        grade={assignment.grade}
                        submittedFiles={assignment.submittedFiles}
                        managerComments={assignment.managerComments}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Achievements Card */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/10 rounded-md">
                    <Trophy className="h-4 w-4 text-amber-500" />
                  </div>
                  <CardTitle className="text-sm font-medium">Achievements</CardTitle>
                  <Link to="/learner/achievements" className="ml-auto text-xs text-primary hover:underline">
                    How to earn →
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <BadgeShowcase
                  allBadges={allBadges}
                  userBadges={userBadges}
                  maxDisplay={4}
                />
                <Link
                  to="/learner/achievements"
                  className="mt-3 block text-center text-xs text-primary hover:underline"
                >
                  See how to earn XP, badges &amp; rewards
                </Link>
              </CardContent>
            </Card>

            {/* Leaderboard Card */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-md">
                    <Award className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-sm font-medium">Leaderboard</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <Leaderboard limit={5} />
              </CardContent>
            </Card>

            {/* Recent Activity Card */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-md">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <RecentActivityTimeline 
                  activities={recentActivities}
                  className="max-h-[200px] overflow-y-auto pr-1"
                />
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </div>
    </AppSidebar>
  );
}
