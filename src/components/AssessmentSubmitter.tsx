import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMySubmissions, SubmittedFile } from "@/hooks/useAssessmentSubmissions";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, X, Loader2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { validateFile } from "@/lib/fileValidation";
import { formatDaysRemaining, isOverdue } from "@/lib/relativeDeadlines";

interface AssessmentSubmitterProps {
  assessmentId: string;
  courseId: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  maxScore: number;
  dueDate?: Date | null;
  onSubmitted?: () => void;
}

export function AssessmentSubmitter({
  assessmentId,
  courseId,
  title,
  description,
  instructions,
  maxScore,
  dueDate,
  onSubmitted,
}: AssessmentSubmitterProps) {
  const [responseText, setResponseText] = useState("");
  const [files, setFiles] = useState<SubmittedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const { submitAssessment } = useMySubmissions();
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles?.length) return;

    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const uploadedFiles: SubmittedFile[] = [];

      for (const file of Array.from(selectedFiles)) {
        const validation = validateFile(file, "assessment");
        if (!validation.valid) {
          toast({ title: "File rejected", description: validation.error, variant: "destructive" });
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${userData.user.id}/${assessmentId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("module-files")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("module-files")
          .getPublicUrl(fileName);

        uploadedFiles.push({
          name: file.name,
          url: urlData.publicUrl,
        });
      }

      setFiles((prev) => [...prev, ...uploadedFiles]);
      toast({ title: "Files uploaded successfully" });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!responseText.trim() && files.length === 0) {
      toast({
        title: "Please provide a response",
        description: "Add text or upload files to submit",
        variant: "destructive",
      });
      return;
    }

    await submitAssessment.mutateAsync({
      assessmentId,
      courseId,
      responseText: responseText || undefined,
      files: files.length > 0 ? files : undefined,
    });

    onSubmitted?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {dueDate && (
          <p className={`text-sm flex items-center gap-1.5 mt-1 ${isOverdue(dueDate) ? "text-destructive" : "text-muted-foreground"}`}>
            <Clock className="h-3.5 w-3.5" />
            {formatDaysRemaining(dueDate)} (due {dueDate.toLocaleDateString()})
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {instructions && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <Label className="text-sm font-medium">Instructions</Label>
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
              {instructions}
            </p>
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          Maximum Score: <span className="font-medium">{maxScore}</span>
        </div>

        <div className="space-y-2">
          <Label htmlFor="response">Your Response</Label>
          <Textarea
            id="response"
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Write your response here..."
            rows={6}
          />
        </div>

        <div className="space-y-2">
          <Label>Attach Files</Label>
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,image/*,audio/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              disabled={uploading}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {uploading ? "Uploading..." : "Click to upload files"}
              </span>
            </label>
          </div>

          {files.length > 0 && (
            <div className="space-y-2 mt-4">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-muted/50 rounded"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-sm truncate">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeFile(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitAssessment.isPending}
          className="w-full"
        >
          {submitAssessment.isPending ? "Submitting..." : "Submit Assignment"}
        </Button>
      </CardContent>
    </Card>
  );
}
