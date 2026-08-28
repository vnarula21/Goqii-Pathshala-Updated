import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save, Clock } from "lucide-react";
import { TagSelector } from "./TagSelector";
import { useSaveModule } from "@/hooks/useSaveModule";
import QuizBuilderCore, { QuizQuestion } from "./QuizBuilderCore";

// Re-export types for backward compatibility
export type { QuizQuestion } from "./QuizBuilderCore";

export default function QuizBuilder() {
  const navigate = useNavigate();
  const { saveModule, isSaving } = useSaveModule();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | undefined>(undefined);
  const [questionsToShow, setQuestionsToShow] = useState<number | undefined>(undefined);

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Please enter a quiz title");
      return;
    }

    if (questions.length === 0) {
      toast.error("Please add at least one question");
      return;
    }

    // Validate questions
    const invalidQuestions = questions.filter(q => !q.question.trim());
    if (invalidQuestions.length > 0) {
      toast.error("All questions must have question text");
      return;
    }

    saveModule({
      title: title.trim(),
      description: description.trim() || undefined,
      slides: { 
        type: "quiz", 
        questions,
        quiz_time_limit_minutes: timeLimitMinutes,
        quiz_questions_to_show: questionsToShow,
      },
      moduleType: "quiz",
      tagIds: selectedTags.length > 0 ? selectedTags : undefined,
      visibility: "private"
    }, {
      onSuccess: () => {
        toast.success("Quiz saved successfully!");
        navigate("/library");
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Create Quiz</h2>
        <p className="text-muted-foreground">
          Build interactive assessments with various question types
        </p>
      </div>

      {/* Quiz Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quiz Details</CardTitle>
          <CardDescription>Basic information about your quiz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter quiz title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this quiz covers"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagSelector
              selectedTagIds={selectedTags}
              onTagsChange={setSelectedTags}
            />
          </div>

          {/* Time Limit */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="time-limit">Time Limit</Label>
              </div>
              <Switch
                id="time-limit-toggle"
                checked={timeLimitMinutes !== undefined}
                onCheckedChange={(checked) => {
                  setTimeLimitMinutes(checked ? 15 : undefined);
                }}
              />
            </div>
            {timeLimitMinutes !== undefined && (
              <div className="flex items-center gap-3">
                <Input
                  id="time-limit"
                  type="number"
                  min={1}
                  max={180}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(parseInt(e.target.value) || 15)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {timeLimitMinutes 
                ? `Learners will have ${timeLimitMinutes} minutes to complete this quiz. Auto-submits when time expires.`
                : "No time limit. Learners can take as long as they need."}
            </p>
          </div>

          {/* Questions to show */}
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="questions-to-show">Questions Shown to Each Learner</Label>
            <div className="flex items-center gap-3">
              <Input
                id="questions-to-show"
                type="number"
                min={1}
                max={Math.max(questions.length, 1)}
                value={questionsToShow ?? questions.length}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setQuestionsToShow(Math.max(1, Math.min(val, Math.max(questions.length, 1))));
                }}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                of {questions.length} question{questions.length !== 1 ? "s" : ""} in the pool
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Add more questions than needed, and each learner will get a random, shuffled subset - this reduces answer-copying between learners.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quiz Builder Core */}
      <QuizBuilderCore
        questions={questions}
        onQuestionsChange={setQuestions}
        disabled={isSaving}
      />

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => navigate("/library")} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving || questions.length === 0 || !title.trim()}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Quiz
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
