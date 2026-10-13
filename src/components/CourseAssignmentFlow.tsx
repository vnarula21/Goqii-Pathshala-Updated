import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCourseLibrary, Course } from "@/hooks/useCourseLibrary";
import { useLearners, Learner } from "@/hooks/useLearners";
import { useCourseAssignments } from "@/hooks/useCourseAssignments";
import { BookOpen, Users, ChevronRight, ChevronLeft, Check, Loader2, Search } from "lucide-react";

interface CourseAssignmentFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Full-screen overrides for the shared Dialog (which is a small centered box by default).
const FULLSCREEN_CLASS =
  "left-0 top-0 h-screen w-screen max-w-none translate-x-0 translate-y-0 gap-0 rounded-none p-0 sm:rounded-none flex flex-col " +
  "data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 " +
  "data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0";

export function CourseAssignmentFlow({ open, onOpenChange }: CourseAssignmentFlowProps) {
  const [step, setStep] = useState<"courses" | "learners" | "done">("courses");
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [learnerSearch, setLearnerSearch] = useState("");

  const { allCourses, isLoading: coursesLoading } = useCourseLibrary();
  const { learners, isLoading: learnersLoading } = useLearners();
  const { assignCourses, isAssigning } = useCourseAssignments();

  // Filter to only show published courses
  const publishedCourses = allCourses.filter((c) => c.is_published);

  const visibleCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    return q
      ? publishedCourses.filter((c) => c.title.toLowerCase().includes(q))
      : publishedCourses;
  }, [publishedCourses, courseSearch]);

  const visibleLearners = useMemo(() => {
    const q = learnerSearch.trim().toLowerCase();
    return q
      ? learners.filter(
          (l) =>
            (l.full_name || "").toLowerCase().includes(q) ||
            l.email.toLowerCase().includes(q)
        )
      : learners;
  }, [learners, learnerSearch]);

  const handleCourseToggle = (courseId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleLearnerToggle = (learnerId: string) => {
    setSelectedLearnerIds((prev) =>
      prev.includes(learnerId)
        ? prev.filter((id) => id !== learnerId)
        : [...prev, learnerId]
    );
  };

  // "Select all" acts on what is currently visible (i.e. after searching),
  // and keeps anything already selected outside the current search.
  const allVisibleCoursesSelected =
    visibleCourses.length > 0 && visibleCourses.every((c) => selectedCourseIds.includes(c.id));
  const allVisibleLearnersSelected =
    visibleLearners.length > 0 && visibleLearners.every((l) => selectedLearnerIds.includes(l.id));

  const handleSelectAllCourses = () => {
    const visibleIds = visibleCourses.map((c) => c.id);
    setSelectedCourseIds((prev) =>
      allVisibleCoursesSelected
        ? prev.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...prev, ...visibleIds]))
    );
  };

  const handleSelectAllLearners = () => {
    const visibleIds = visibleLearners.map((l) => l.id);
    setSelectedLearnerIds((prev) =>
      allVisibleLearnersSelected
        ? prev.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...prev, ...visibleIds]))
    );
  };

  const handleAssign = async () => {
    await assignCourses({
      courseIds: selectedCourseIds,
      learnerIds: selectedLearnerIds,
    });
    setStep("done");
  };

  const handleClose = () => {
    setStep("courses");
    setSelectedCourseIds([]);
    setSelectedLearnerIds([]);
    setCourseSearch("");
    setLearnerSearch("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={FULLSCREEN_CLASS}>
        {step === "courses" && (
          <>
            <DialogHeader className="border-b px-6 py-4 pr-14">
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Select Courses
              </DialogTitle>
              <DialogDescription>
                Choose the courses you want to assign to learners
              </DialogDescription>
            </DialogHeader>

            {coursesLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : publishedCourses.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                No published courses available
              </div>
            ) : (
              <>
                <SearchAndSelectAll
                  idPrefix="courses"
                  placeholder="Search courses by name..."
                  search={courseSearch}
                  onSearchChange={setCourseSearch}
                  allSelected={allVisibleCoursesSelected}
                  onSelectAll={handleSelectAllCourses}
                  visibleCount={visibleCourses.length}
                  selectedCount={selectedCourseIds.length}
                  noun="course"
                />
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                  {visibleCourses.length === 0 ? (
                    <p className="py-12 text-center text-muted-foreground">
                      No courses match "{courseSearch}"
                    </p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {visibleCourses.map((course) => (
                        <CourseItem
                          key={course.id}
                          course={course}
                          selected={selectedCourseIds.includes(course.id)}
                          onToggle={() => handleCourseToggle(course.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <DialogFooter className="gap-2 border-t px-6 py-4">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep("learners")}
                disabled={selectedCourseIds.length === 0}
              >
                Next: Select Learners
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "learners" && (
          <>
            <DialogHeader className="border-b px-6 py-4 pr-14">
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Select Learners
              </DialogTitle>
              <DialogDescription>
                {selectedCourseIds.length} course(s) selected. Search for a learner or choose several to assign.
              </DialogDescription>
            </DialogHeader>

            {learnersLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : learners.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                No learners available
              </div>
            ) : (
              <>
                <SearchAndSelectAll
                  idPrefix="learners"
                  placeholder="Search learners by name or email..."
                  search={learnerSearch}
                  onSearchChange={setLearnerSearch}
                  allSelected={allVisibleLearnersSelected}
                  onSelectAll={handleSelectAllLearners}
                  visibleCount={visibleLearners.length}
                  selectedCount={selectedLearnerIds.length}
                  noun="learner"
                />
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                  {visibleLearners.length === 0 ? (
                    <p className="py-12 text-center text-muted-foreground">
                      No learners match "{learnerSearch}"
                    </p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {visibleLearners.map((learner) => (
                        <LearnerItem
                          key={learner.id}
                          learner={learner}
                          selected={selectedLearnerIds.includes(learner.id)}
                          onToggle={() => handleLearnerToggle(learner.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <DialogFooter className="gap-2 border-t px-6 py-4">
              <Button variant="outline" onClick={() => setStep("courses")}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleAssign}
                disabled={selectedLearnerIds.length === 0 || isAssigning}
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Assign to {selectedLearnerIds.length || ""} learner
                    {selectedLearnerIds.length === 1 ? "" : "s"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "done" && (
          <>
            <DialogHeader className="border-b px-6 py-4 pr-14">
              <DialogTitle className="flex items-center gap-2 text-[hsl(var(--success))]">
                <Check className="h-5 w-5" />
                Courses Assigned
              </DialogTitle>
              <DialogDescription>
                Successfully assigned {selectedCourseIds.length} course(s) to{" "}
                {selectedLearnerIds.length} learner(s).
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--success))]/10">
                <Check className="h-8 w-8 text-[hsl(var(--success))]" />
              </div>
              <p className="text-sm text-muted-foreground">
                The selected learners now have access to the assigned courses.
              </p>
            </div>

            <DialogFooter className="border-t px-6 py-4">
              <Button onClick={handleClose}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SearchAndSelectAll({
  idPrefix,
  placeholder,
  search,
  onSearchChange,
  allSelected,
  onSelectAll,
  visibleCount,
  selectedCount,
  noun,
}: {
  idPrefix: string;
  placeholder: string;
  search: string;
  onSearchChange: (v: string) => void;
  allSelected: boolean;
  onSelectAll: () => void;
  visibleCount: number;
  selectedCount: number;
  noun: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-b px-6 py-3">
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`select-all-${idPrefix}`}
          checked={allSelected}
          onCheckedChange={onSelectAll}
          disabled={visibleCount === 0}
        />
        <label
          htmlFor={`select-all-${idPrefix}`}
          className="cursor-pointer text-sm font-medium"
        >
          {search.trim() ? `Select all matching (${visibleCount})` : `Select All (${visibleCount})`}
        </label>
      </div>
      <span className="ml-auto text-sm text-muted-foreground">
        {selectedCount} {noun}
        {selectedCount === 1 ? "" : "s"} selected
      </span>
    </div>
  );
}

function CourseItem({
  course,
  selected,
  onToggle,
}: {
  course: Course;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        selected ? "bg-primary/5 border-primary" : "hover:bg-muted/50"
      }`}
      onClick={onToggle}
    >
      <Checkbox 
        checked={selected} 
        onClick={(e) => e.stopPropagation()}
        onCheckedChange={() => onToggle()} 
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{course.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {course.course_modules?.length || 0} modules
        </p>
      </div>
    </div>
  );
}

function LearnerItem({
  learner,
  selected,
  onToggle,
}: {
  learner: Learner;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        selected ? "bg-primary/5 border-primary" : "hover:bg-muted/50"
      }`}
      onClick={onToggle}
    >
      <Checkbox 
        checked={selected} 
        onClick={(e) => e.stopPropagation()}
        onCheckedChange={() => onToggle()} 
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {learner.full_name || learner.email}
        </p>
        <p className="text-xs text-muted-foreground truncate">{learner.email}</p>
      </div>
    </div>
  );
}
