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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourseProgressSummary } from "@/hooks/useCourseProgressSummary";
import { exportToCsv } from "@/lib/exportCsv";
import { Search, Download } from "lucide-react";

export function CourseProgressSummaryTable() {
  const { summaries, isLoading } = useCourseProgressSummary();
  const [search, setSearch] = useState("");

  const filtered = summaries.filter((s) =>
    s.courseTitle.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    if (!filtered.length) return;
    const rows = filtered.map((s) => ({
      "Course": s.courseTitle,
      "Assigned Learners": s.totalAssigned,
      "Completed": s.completedCount,
      "In Progress": s.inProgressCount,
      "Completion Rate": `${Math.round((s.completedCount / (s.totalAssigned || 1)) * 100)}%`,
      "Average Score": s.avgScore ?? "",
    }));
    exportToCsv(`course-progress-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Course Progress</CardTitle>
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
          <CardTitle>Course Progress</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={handleExport} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!filtered.length ? (
          <div className="text-center py-8 text-muted-foreground">
            No courses have been assigned to learners yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Completion</TableHead>
                <TableHead>Avg Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const completionPercent = Math.round((s.completedCount / (s.totalAssigned || 1)) * 100);
                return (
                  <TableRow key={s.courseId}>
                    <TableCell className="font-medium">{s.courseTitle}</TableCell>
                    <TableCell>{s.totalAssigned} learners</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[180px]">
                        <Progress value={completionPercent} className="h-2 flex-1" />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {s.completedCount}/{s.totalAssigned}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.avgScore != null ? (
                        <Badge variant="outline">{s.avgScore}%</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
