import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { getRoleDisplayName } from "@/lib/roleDisplayNames";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";
import { 
  Sparkles, 
  Library, 
  BookOpen, 
  Users, 
  LayoutDashboard,
  GraduationCap,
  Settings,
  Layers,
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  ClipboardList,
  BarChart3,
  Plus,
  FolderOpen,
  Building2,
  Award
} from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AppSidebarProps {
  children: React.ReactNode;
}

export function AppSidebar({ children }: AppSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { role, isAdmin, isManager, isSME, isLearner, isSMEExpert } = useUserRole();

  const isActive = (path: string) => location.pathname === path;

  const getNavItems = (): NavItem[] => {
    if (isAdmin) {
      return [
        { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { path: "/admin/users", label: "Users", icon: Users },
        { path: "/admin/organizations", label: "Organizations", icon: Building2 },
        { path: "/admin/levels", label: "Levels", icon: Layers },
        { path: "/library", label: "Modules", icon: Library },
        { path: "/courses", label: "Courses", icon: BookOpen },
      ];
    }

    if (isManager) {
      return [
        { path: "/manager", label: "Dashboard", icon: LayoutDashboard },
        { path: "/manager/learners", label: "Learners", icon: Users },
        { path: "/courses", label: "Courses", icon: BookOpen },
        { path: "/manager/assessments", label: "Assignments", icon: ClipboardList },
        { path: "/manager/progress", label: "Progress", icon: BarChart3 },
      ];
    }

    if (isSMEExpert) {
      return [
        { path: "/sme-expert", label: "Dashboard", icon: LayoutDashboard },
        { path: "/library", label: "Browse Modules", icon: Library },
        { path: "/courses", label: "Courses", icon: BookOpen },
      ];
    }

    if (isSME) {
      return [
        { path: "/sme", label: "Dashboard", icon: LayoutDashboard },
        { path: "/library", label: "All Modules", icon: Library },
        { path: "/sme/my-modules", label: "My Modules", icon: FolderOpen },
      ];
    }

    if (isLearner) {
      return [
        { path: "/learner", label: "Dashboard", icon: LayoutDashboard },
        { path: "/learner/courses", label: "My Courses", icon: GraduationCap },
        { path: "/learner/certificates", label: "Certificates", icon: Award },
      ];
    }

    return [
      { path: "/", label: "Create Module", icon: Sparkles },
      { path: "/library", label: "Modules", icon: Library },
      { path: "/courses", label: "Courses", icon: BookOpen },
    ];
  };

  const navItems = getNavItems();

  const getHomeLink = () => {
    switch (role) {
      case "admin": return "/admin";
      case "manager": return "/manager";
      case "sme": return "/sme";
      case "sme_expert": return "/sme-expert";
      case "learner": return "/learner";
      default: return "/";
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-destructive text-destructive-foreground";
      case "manager": return "bg-primary text-primary-foreground";
      case "sme": return "bg-secondary text-secondary-foreground";
      case "sme_expert": return "bg-accent text-accent-foreground";
      case "learner": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full bg-card border-r transition-all duration-300 ease-in-out flex flex-col",
          isExpanded ? "w-56" : "w-14"
        )}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-3 border-b">
          <Link to={getHomeLink()} className="flex items-center gap-2 overflow-hidden">
            <Sparkles className="h-6 w-6 text-primary shrink-0" />
            <span className={cn(
              "font-bold text-lg whitespace-nowrap transition-opacity duration-300",
              isExpanded ? "opacity-100" : "opacity-0"
            )}>
              Pathshala
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors",
                  isActive(item.path)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className={cn(
                  "whitespace-nowrap transition-opacity duration-300",
                  isExpanded ? "opacity-100" : "opacity-0"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="border-t p-2 space-y-1">
          {/* Notifications */}
          <div className={cn(
            "flex items-center gap-3 px-2 py-2",
            isExpanded ? "justify-start" : "justify-center"
          )}>
            <NotificationBell />
            {isExpanded && (
              <span className="text-sm text-muted-foreground">Notifications</span>
            )}
          </div>

          {/* Settings */}
          <Link
            to="/settings"
            className={cn(
              "flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors",
              isActive("/settings")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span className={cn(
              "whitespace-nowrap transition-opacity duration-300",
              isExpanded ? "opacity-100" : "opacity-0"
            )}>
              Settings
            </span>
          </Link>

        {/* User Section */}
          {user && (
            <div className="pt-2 border-t mt-2">
              <div className={cn(
                "flex items-center gap-3 px-2 py-2",
                isExpanded ? "justify-start" : "justify-center"
              )}>
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {(user.user_metadata?.full_name || user.email)?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                {isExpanded && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {user.user_metadata?.full_name || user.email}
                    </p>
                    {role && (
                      <Badge className={cn("text-xs mt-0.5", getRoleBadgeColor(role))}>
                        {getRoleDisplayName(role)}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Sign Out */}
              <button
                onClick={signOut}
                className={cn(
                  "flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors w-full",
                  "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                )}
              >
                <LogOut className="h-5 w-5 shrink-0" />
                <span className={cn(
                  "whitespace-nowrap transition-opacity duration-300",
                  isExpanded ? "opacity-100" : "opacity-0"
                )}>
                  Sign Out
                </span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300",
        "ml-14" // Always offset by collapsed sidebar width
      )}>
        {children}
      </main>
    </div>
  );
}
