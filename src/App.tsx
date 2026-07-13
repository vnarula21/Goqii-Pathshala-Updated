import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Library from "./pages/Library";
import ModuleViewer from "./pages/ModuleViewer";
import ModuleCreationHub from "./pages/ModuleCreationHub";
import Settings from "./pages/Settings";
import Courses from "./pages/Courses";
import CourseCreator from "./pages/CourseCreator";
import CourseViewer from "./pages/CourseViewer";
import ModuleQuizPage from "./pages/ModuleQuizPage";
import ModuleAssignmentsPage from "./pages/ModuleAssignmentsPage";
import NotFound from "./pages/NotFound";
import { RoleGuard } from "./components/RoleGuard";
import LearnerDashboard from "./pages/LearnerDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import ManagerModuleBrowser from "./pages/ManagerModuleBrowser";
import ManagerCourseViewer from "./pages/ManagerCourseViewer";
import SMEDashboard from "./pages/SMEDashboard";
import SMEExpertDashboard from "./pages/SMEExpertDashboard";
import MyModules from "./pages/MyModules";
import AdminDashboard from "./pages/AdminDashboard";
import UserManagement from "./pages/UserManagement";
import LevelManagement from "./pages/LevelManagement";
import OrganizationManagement from "./pages/OrganizationManagement";
import AssessmentManagement from "./pages/AssessmentManagement";
import LearnerProgressPage from "./pages/LearnerProgressPage";
import ModuleReviewPage from "./pages/ModuleReviewPage";
import CourseGroupManagement from "./pages/CourseGroupManagement";
import TTSTestPage from "./pages/TTSTestPage";
import ChangePassword from "./pages/ChangePassword";
import ResetPassword from "./pages/ResetPassword";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:moduleId" element={<ModuleViewer />} />
          <Route path="/create" element={<ModuleCreationHub />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/create" element={<CourseCreator />} />
          <Route path="/courses/:id" element={<CourseViewer />} />
          <Route path="/courses/:courseId/module/:moduleId/quiz" element={<ModuleQuizPage />} />
          <Route path="/courses/:courseId/module/:moduleId/assignments" element={<ModuleAssignmentsPage />} />
          <Route path="/settings" element={<Settings />} />
          
          {/* Learner Routes */}
          <Route path="/learner" element={
            <RoleGuard allowedRoles={["learner"]}>
              <LearnerDashboard />
            </RoleGuard>
          } />
          <Route path="/learner/courses" element={
            <RoleGuard allowedRoles={["learner"]}>
              <Courses />
            </RoleGuard>
          } />
          
          {/* Manager Routes */}
          <Route path="/manager" element={
            <RoleGuard allowedRoles={["manager"]}>
              <ManagerDashboard />
            </RoleGuard>
          } />
          <Route path="/manager/learners" element={
            <RoleGuard allowedRoles={["manager"]}>
              <UserManagement />
            </RoleGuard>
          } />
          <Route path="/manager/modules" element={
            <RoleGuard allowedRoles={["manager"]}>
              <ManagerModuleBrowser />
            </RoleGuard>
          } />
          <Route path="/manager/modules/:moduleId" element={
            <RoleGuard allowedRoles={["manager", "admin"]}>
              <ModuleViewer />
            </RoleGuard>
          } />
          <Route path="/manager/assessments" element={
            <RoleGuard allowedRoles={["manager", "admin"]}>
              <AssessmentManagement />
            </RoleGuard>
          } />
          <Route path="/manager/progress" element={
            <RoleGuard allowedRoles={["manager", "admin"]}>
              <LearnerProgressPage />
            </RoleGuard>
          } />
          
          {/* SME (Module Designer) Routes */}
          <Route path="/sme" element={
            <RoleGuard allowedRoles={["sme"]}>
              <SMEDashboard />
            </RoleGuard>
          } />
          <Route path="/sme/my-modules" element={
            <RoleGuard allowedRoles={["sme"]}>
              <MyModules />
            </RoleGuard>
          } />
          
          {/* SME Expert Routes */}
          <Route path="/sme-expert" element={
            <RoleGuard allowedRoles={["sme_expert", "admin"]}>
              <SMEExpertDashboard />
            </RoleGuard>
          } />
          <Route path="/sme-expert/review/:moduleId" element={
            <RoleGuard allowedRoles={["sme_expert", "admin"]}>
              <ModuleReviewPage />
            </RoleGuard>
          } />
          
          {/* Manager Course Groups */}
          <Route path="/manager/course-groups" element={
            <RoleGuard allowedRoles={["manager", "admin"]}>
              <CourseGroupManagement />
            </RoleGuard>
          } />
          <Route path="/manager/courses/:courseId" element={
            <RoleGuard allowedRoles={["manager", "admin"]}>
              <ManagerCourseViewer />
            </RoleGuard>
          } />
          
          {/* Admin Routes */}
          <Route path="/admin" element={
            <RoleGuard allowedRoles={["admin"]}>
              <AdminDashboard />
            </RoleGuard>
          } />
          <Route path="/admin/users" element={
            <RoleGuard allowedRoles={["admin"]}>
              <UserManagement />
            </RoleGuard>
          } />
          <Route path="/admin/levels" element={
            <RoleGuard allowedRoles={["admin"]}>
              <LevelManagement />
            </RoleGuard>
          } />
          <Route path="/admin/organizations" element={
            <RoleGuard allowedRoles={["admin"]}>
              <OrganizationManagement />
            </RoleGuard>
          } />
          
          {/* Internal QA: TTS service test */}
          <Route path="/tts-test" element={
            <RoleGuard allowedRoles={["admin", "sme"]}>
              <TTSTestPage />
            </RoleGuard>
          } />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
