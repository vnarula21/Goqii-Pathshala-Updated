import { Link } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { LearnerProgressTable } from "@/components/LearnerProgressTable";
import { CourseProgressSummaryTable } from "@/components/CourseProgressSummaryTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";

export default function LearnerProgressPage() {
  return (
    <AppSidebar>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/manager">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Progress</h1>
              <p className="text-muted-foreground">
                Track course and assessment progress for all learners
              </p>
            </div>
          </div>

          <Tabs defaultValue="learners">
            <TabsList className="mb-4">
              <TabsTrigger value="learners">Learner Progress</TabsTrigger>
              <TabsTrigger value="courses">Course Progress</TabsTrigger>
            </TabsList>
            <TabsContent value="learners">
              <LearnerProgressTable />
            </TabsContent>
            <TabsContent value="courses">
              <CourseProgressSummaryTable />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppSidebar>
  );
}
