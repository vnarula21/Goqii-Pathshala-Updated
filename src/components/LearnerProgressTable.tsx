import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLearnerProgress, LearnerProgressData } from "@/hooks/useLearnerProgress";
import { Search, ChevronDown, ChevronUp, User, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { exportToCsv } from "@/lib/exportCsv";

export function LearnerProgressTable() {
  const { learnersProgress, isLoading } = useLearnerProgress();
  const [search, setSearch] = useState("");
  const [expandedLearner, setExpandedLearner] = useState<string | null>(null);

  const filteredLearners = learnersProgress?.filter((lp) => {
    const searchLower = search.toLowerCase();
    return (
      lp.learner.email.toLowerCase().includes(searchLower) ||
      lp.learner.full_name?.toLowerCase().includes(searchLower)
    );
  });

  const getOverallProgress = (learner: LearnerProgressData) => {
    const completedCourses = learner.courses.filter((c) => c.is_completed).length;
    const totalCourses = learner.courses.length;
    const avgScore =
      learner.courses.reduce((sum, c) => sum + (c.overall_score || 0), 0) /
      (totalCourses || 1);

    return { completedCourses, totalCourses, avgScore };
  };

  const handleExport = () => {
    if (!filteredLearners?.length) return;

    const rows = filteredLearners.flatMap((lp) => {
      if (lp.courses.length === 0) {
        return [{
          "Learner Name": lp.learner.full_name || "",
          "Email": lp.learner.email,
          "Course": "",
          "Status": "No courses started",
          "Score": "",
          "Started": "",
          "Completed": "",
        }];
      }
      return lp.courses.map((course) => ({
        "Learner Name": lp.learner.full_name || "",
        "Email": lp.learner.email,
        "Course": course.course_title,
        "Status": course.is_completed ? "Completed" : "In Progress",
        "Score": course.overall_score ?? "",
        "Started": course.started_at ? new Date(course.started_at).toLocaleDateString() : "",
        "Completed": course.completed_at ? new Date(course.completed_at).toLocaleDateString() : "",
      }));
    });

    exportToCsv(`learner-progress-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Learner Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Learner Progress</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search learners..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={handleExport} disabled={!filteredLearners?.length}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!filteredLearners?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            No learners found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Learner</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Avg Score</TableHead>
                <TableHead>Assessments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLearners.map((lp) => {
                const { completedCourses, totalCourses, avgScore } =
                  getOverallProgress(lp);
                const isExpanded = expandedLearner === lp.learner.id;
                const pendingAssessments = lp.assessments.filter(
                  (a) => a.status === "submitted"
                ).length;

                return (
                  <>
                    <TableRow
                      key={lp.learner.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        setExpandedLearner(isExpanded ? null : lp.learner.id)
                      }
                    >
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {lp.learner.full_name || "—"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {lp.learner.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {completedCourses}/{totalCourses} completed
                      </TableCell>
                      <TableCell>
                        {totalCourses > 0 ? (
                          <span className="font-medium">
                            {Math.round(avgScore)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {pendingAssessments > 0 ? (
                          <Badge className="bg-amber-100 text-amber-800">
                            {pendingAssessments} pending
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">
                            {lp.assessments.length} total
                          </span>
                        )}
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30">
                          <div className="p-4 space-y-4">
                            {/* Courses Detail */}
                            <div>
                              <h5 className="font-medium mb-2">Courses</h5>
                              {lp.courses.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  No courses started
                                </p>
                              ) : (
                                <div className="grid gap-2">
                                  {lp.courses.map((course) => (
                                    <div
                                      key={course.course_id}
                                      className="flex items-center justify-between bg-background p-2 rounded"
                                    >
                                      <span className="text-sm">
                                        {course.course_title}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <Badge
                                          variant={
                                            course.is_completed
                                              ? "default"
                                              : "secondary"
                                          }
                                        >
                                          {course.is_completed
                                            ? `Completed: ${course.overall_score}%`
                                            : "In Progress"}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Assessments Detail */}
                            <div>
                              <h5 className="font-medium mb-2">Assessments</h5>
                              {lp.assessments.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  No assessments submitted
                                </p>
                              ) : (
                                <div className="grid gap-2">
                                  {lp.assessments.map((assessment) => (
                                    <div
                                      key={assessment.assessment_id}
                                      className="flex items-center justify-between bg-background p-2 rounded"
                                    >
                                      <div>
                                        <span className="text-sm">
                                          {assessment.assessment_title}
                                        </span>
                                        <span className="text-xs text-muted-foreground ml-2">
                                          ({assessment.course_title})
                                        </span>
                                      </div>
                                      <Badge
                                        className={
                                          assessment.status === "graded"
                                            ? "bg-green-100 text-green-800"
                                            : assessment.status === "submitted"
                                            ? "bg-amber-100 text-amber-800"
                                            : "bg-muted"
                                        }
                                      >
                                        {assessment.status === "graded"
                                          ? `${assessment.score}/${assessment.max_score}`
                                          : assessment.status.replace("_", " ")}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
