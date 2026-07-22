import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleSelector } from "@/components/ModuleSelector";
import { CourseAssessmentManager } from "@/components/CourseAssessmentManager";
import { useSaveCourse } from "@/hooks/useSaveCourse";
import { useCourseLibrary } from "@/hooks/useCourseLibrary";
import { useLevels } from "@/hooks/useLevels";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { COURSE_TIME_LIMIT_PRESETS } from "@/lib/relativeDeadlines";
import { toast } from "sonner";

export default function CourseCreator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const { user, loading: authLoading } = useAuth();
  const { allCourses, isLoading: coursesLoading } = useCourseLibrary();
  const { saveCourse, isSaving } = useSaveCourse();
  const { levels, isLoading: levelsLoading } = useLevels();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [passingScore, setPassingScore] = useState(70);
  const [completionDays, setCompletionDays] = useState<string>("none");
  const [isPublished, setIsPublished] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string | undefined>();

  // Load existing course data if editing
  useEffect(() => {
    if (editId && allCourses.length > 0) {
      const course = allCourses.find((c) => c.id === editId);
      if (course) {
        setTitle(course.title);
        setDescription(course.description || "");
        setPassingScore(course.passing_score);
        setCompletionDays(
          course.completion_days != null ? String(course.completion_days) : "none"
        );
        setIsPublished(course.is_published);
        setVisibility((course as any).visibility || "private");
        setSelectedModuleIds(
          course.course_modules
            .sort((a, b) => a.order_index - b.order_index)
            .map((cm) => cm.module_id)
        );
        if (course.level_id) {
          setSelectedLevelId(course.level_id);
        }
      }
    }
  }, [editId, allCourses]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Please enter a course title");
      return;
    }
    if (selectedModuleIds.length === 0) {
      toast.error("Please add at least one module to the course");
      return;
    }

    saveCourse(
      {
        id: editId || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        passing_score: passingScore,
        completion_days: completionDays === "none" ? null : Number(completionDays),
        is_published: isPublished,
        module_ids: selectedModuleIds,
        level_id: selectedLevelId,
        visibility: visibility,
      },
      {
        onSuccess: () => {
          navigate("/courses");
        },
      }
    );
  };

  if (authLoading || levelsLoading || (editId && coursesLoading)) {
    return (
      <AppSidebar>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 py-8 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </div>
      </AppSidebar>
    );
  }

  return (
    <AppSidebar>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/courses")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {editId ? "Edit Course" : "Create Course"}
            </h1>
            <p className="text-muted-foreground">
              Combine modules into a structured learning path
            </p>
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Course
          </Button>
        </div>

        <div className="space-y-6">
          {/* Course Details */}
          <Card>
            <CardHeader>
              <CardTitle>Course Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Course Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter course title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what learners will achieve..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="level">Course Level</Label>
                <Select value={selectedLevelId} onValueChange={setSelectedLevelId}>
                  <SelectTrigger id="level" className="mt-1">
                    <SelectValue placeholder="Select a level..." />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((level) => (
                      <SelectItem key={level.id} value={level.id}>
                        {level.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Only learners assigned to this level will see this course
                </p>
              </div>

              <div>
                <Label htmlFor="visibility">Course Visibility</Label>
                <Select value={visibility} onValueChange={(v) => setVisibility(v as "public" | "private")}>
                  <SelectTrigger id="visibility" className="mt-1">
                    <SelectValue placeholder="Select visibility..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public - Available to all organizations</SelectItem>
                    <SelectItem value="private">Private - Only for organizations with private access</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Control who can access this course
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Passing Score: {passingScore}%</Label>
                </div>
                <Slider
                  value={[passingScore]}
                  onValueChange={([value]) => setPassingScore(value)}
                  min={50}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Learners must achieve at least {passingScore}% average across all modules to pass
                </p>
              </div>

              <div>
                <Label>Time Limit to Complete Course (Optional)</Label>
                <Select value={completionDays} onValueChange={setCompletionDays}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Choose a time limit..." />
                  </SelectTrigger>
                  <SelectContent>
                    {COURSE_TIME_LIMIT_PRESETS.map((preset) => (
                      <SelectItem key={preset.label} value={preset.value == null ? "none" : String(preset.value)}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Counted from when each learner starts this course. Leave as "No time limit" to let learners complete it whenever they're ready.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label htmlFor="published">Publish Course</Label>
                  <p className="text-xs text-muted-foreground">
                    Published courses are ready for learners
                  </p>
                </div>
                <Switch
                  id="published"
                  checked={isPublished}
                  onCheckedChange={setIsPublished}
                />
              </div>
            </CardContent>
          </Card>

          {/* Module Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Course Modules</CardTitle>
            </CardHeader>
            <CardContent>
              <ModuleSelector
                selectedModuleIds={selectedModuleIds}
                onSelectionChange={setSelectedModuleIds}
              />
            </CardContent>
          </Card>

          {editId && (
            <CourseAssessmentManager courseId={editId} />
          )}
        </div>
        </div>
      </div>
    </AppSidebar>
  );
}
