import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Star, MoreVertical, Trash2, FileText, Presentation, Globe, Lock, User, BookOpen, Video, HelpCircle, Calendar, Send, Clock, CheckCircle, XCircle } from "lucide-react";
import { useSaveModule } from "@/hooks/useSaveModule";
import { useModuleApproval } from "@/hooks/useModuleApproval";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface ModuleCardProps {
  module: {
    id: string;
    title: string;
    description: string | null;
    slides?: any;
    thumbnail_url: string | null;
    is_favorite: boolean;
    created_at: string;
    updated_at: string;
    module_type?: string;
    visibility?: string;
    user_id?: string;
    approval_status?: string | null;
    creator?: {
      id: string;
      full_name: string | null;
      email: string;
    };
    module_tags: {
      tags: {
        id: string;
        name: string;
        color: string;
      };
    }[];
  };
  showOwnerActions?: boolean;
  showCreator?: boolean;
}

const moduleTypeLabels: Record<string, { label: string; icon: typeof FileText }> = {
  document: { label: "Document", icon: FileText },
  presentation: { label: "Presentation", icon: Presentation },
  textbook: { label: "Textbook", icon: BookOpen },
  video: { label: "Video", icon: Video },
  quiz: { label: "Quiz", icon: HelpCircle },
};

const approvalStatusConfig: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  draft: { label: "Draft", className: "border-muted-foreground/50 text-muted-foreground", icon: FileText },
  pending_review: { label: "Pending", className: "border-amber-500 text-amber-600", icon: Clock },
  approved: { label: "Approved", className: "border-green-500 text-green-600", icon: CheckCircle },
  rejected: { label: "Rejected", className: "border-destructive text-destructive", icon: XCircle },
};

export function ModuleCard({ module, showOwnerActions = true, showCreator = false }: ModuleCardProps) {
  const { user } = useAuth();
  const { toggleFavorite, deleteModule } = useSaveModule();
  const { submitForReview, isSubmitting } = useModuleApproval();

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite({ moduleId: module.id, isFavorite: !module.is_favorite });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this module?")) {
      deleteModule(module.id);
    }
  };

  const handleSubmitForReview = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    submitForReview(module.id);
  };

  const TypeIcon = module.module_type && moduleTypeLabels[module.module_type] 
    ? moduleTypeLabels[module.module_type].icon 
    : FileText;

  const approvalStatus = module.approval_status || "draft";
  const statusConfig = approvalStatusConfig[approvalStatus] || approvalStatusConfig.draft;
  const isOwner = user?.id === module.user_id;
  const canSubmitForReview = isOwner && approvalStatus === "draft";

  return (
    <Card className="group hover:shadow-md transition-all duration-200 overflow-hidden">
      <Link to={`/library/${module.id}`} className="flex gap-3 p-3">
        {/* Thumbnail - compact */}
        <div className="shrink-0 w-20 h-16 rounded-md overflow-hidden bg-muted flex items-center justify-center">
          {module.thumbnail_url ? (
            <img
              src={module.thumbnail_url}
              alt={module.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <TypeIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        {/* Content - horizontal layout */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          {/* Title row with badges */}
          <div className="flex items-start gap-2">
            <h3 className="text-sm font-semibold text-foreground line-clamp-1 flex-1">
              {module.title}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              {module.module_type && moduleTypeLabels[module.module_type] && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {moduleTypeLabels[module.module_type].label}
                </Badge>
              )}
              {module.visibility && (
                <Badge 
                  variant="outline" 
                  className={`text-[10px] px-1 py-0 ${
                    module.visibility === "public" 
                      ? "border-green-500 text-green-600" 
                      : "border-muted-foreground text-muted-foreground"
                  }`}
                >
                  {module.visibility === "public" ? (
                    <Globe className="h-2.5 w-2.5" />
                  ) : (
                    <Lock className="h-2.5 w-2.5" />
                  )}
                </Badge>
              )}
              {/* Approval Status Badge */}
              <Badge 
                variant="outline" 
                className={`text-[10px] px-1.5 py-0 ${statusConfig.className}`}
              >
                {statusConfig.label}
              </Badge>
            </div>
          </div>

          {/* Description */}
          {module.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {module.description}
            </p>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5" title="Date created">
              <Calendar className="h-2.5 w-2.5" />
              Created {format(new Date(module.created_at), "d MMM yyyy")}
            </span>
            {module.module_tags.length > 0 && (
              <div className="flex gap-1">
                {module.module_tags.slice(0, 2).map((mt) => (
                  <span
                    key={mt.tags.id}
                    style={{ color: mt.tags.color }}
                    className="font-medium"
                  >
                    #{mt.tags.name}
                  </span>
                ))}
                {module.module_tags.length > 2 && (
                  <span>+{module.module_tags.length - 2}</span>
                )}
              </div>
            )}
            {showCreator && module.creator && (
              <span className="flex items-center gap-0.5">
                <User className="h-2.5 w-2.5" />
                {module.creator.full_name || module.creator.email.split('@')[0]}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {showOwnerActions && (
          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.preventDefault()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleToggleFavorite}
            >
              <Star
                className={`h-3.5 w-3.5 ${
                  module.is_favorite
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground"
                }`}
              />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                {canSubmitForReview && (
                  <>
                    <DropdownMenuItem onClick={handleSubmitForReview} disabled={isSubmitting}>
                      <Send className="mr-2 h-3.5 w-3.5" />
                      Submit for Review
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </Link>
    </Card>
  );
}