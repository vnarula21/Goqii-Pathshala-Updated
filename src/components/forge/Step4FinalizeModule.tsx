import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Pencil, ChevronDown, HelpCircle, ClipboardList, Loader2, ArrowRight } from "lucide-react";
import { UseModuleForge } from "@/hooks/useModuleForge";
import { useContentHistory } from "@/hooks/useContentHistory";
import EditablePPTPreview from "./EditablePPTPreview";
import EditableArticlePreview from "./EditableArticlePreview";
import EditableDocumentPreview from "./EditableDocumentPreview";
import EditableVideoPreview from "./EditableVideoPreview";
import UndoRedoToolbar from "./UndoRedoToolbar";

interface Step4Props {
  forge: UseModuleForge;
}

export default function Step4FinalizeModule({ forge }: Step4Props) {
  const { module, updateFormattedContent } = forge;
  const [previewOpen, setPreviewOpen] = useState(true);
  const [quizOpen, setQuizOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);

  const inputs = module.forgeInputs;
  const includeQuiz = inputs?.includeQuiz ?? false;
  const includeAssignments = inputs?.includeAssignments ?? false;

  const {
    state: editableContent,
    setState: setEditableContent,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory,
    historyLength,
  } = useContentHistory(module.formattedOutput?.content || null);

  useEffect(() => {
    if (module.formattedOutput?.content) {
      resetHistory(module.formattedOutput.content);
    }
  }, [module.formattedOutput?.type]);

  useEffect(() => {
    if (editableContent && module.formattedOutput) {
      updateFormattedContent(editableContent);
    }
  }, [editableContent]);

  const handleContentChange = (newContent: any) => {
    setEditableContent(newContent);
  };

  // Auto-generate quiz and assignments if configured
  const [quizGenerated, setQuizGenerated] = useState(!!module.quizData);
  const [assignmentsGenerated, setAssignmentsGenerated] = useState(!!module.assignmentData);

  const handleGenerateQuiz = async () => {
    if (!inputs?.quizSettings) return;
    await forge.generateQuiz(inputs.quizSettings);
    setQuizGenerated(true);
  };

  const handleGenerateAssignments = async () => {
    if (!inputs?.assignmentSettings) return;
    await forge.generateAssignments(inputs.assignmentSettings);
    setAssignmentsGenerated(true);
  };

  const handleContinue = () => {
    forge.setCurrentStep(5);
  };

  const renderEditablePreview = () => {
    if (!module.formattedOutput) return null;
    switch (module.formattedOutput.type) {
      case "PPT":
        return <EditablePPTPreview content={module.formattedOutput.content} onContentChange={handleContentChange} />;
      case "Article":
        return <EditableArticlePreview content={module.formattedOutput.content} onContentChange={handleContentChange} />;
      case "Document":
        return <EditableDocumentPreview content={module.formattedOutput.content} onContentChange={handleContentChange} />;
      case "Video":
        return <EditableVideoPreview content={module.formattedOutput.content} onContentChange={handleContentChange} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Edit & Review</h2>
        <p className="text-sm text-muted-foreground">
          Edit your module content, generate quiz & assignments, then proceed to save
        </p>
      </div>

      {/* Editable Preview */}
      <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit Module Content
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${previewOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  Click any text to edit • Hover images for controls
                </CardTitle>
                <UndoRedoToolbar
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onUndo={undo}
                  onRedo={redo}
                  historyLength={historyLength}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {renderEditablePreview()}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Quiz Generation */}
      {includeQuiz && (
        <Collapsible open={quizOpen} onOpenChange={setQuizOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                Quiz {quizGenerated ? `(${module.quizData?.questions.length || 0} questions)` : "(Not generated)"}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${quizOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <Card>
              <CardContent className="p-4 space-y-4">
                {!quizGenerated ? (
                  <Button onClick={handleGenerateQuiz} disabled={forge.isGeneratingQuiz} className="w-full">
                    {forge.isGeneratingQuiz ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating Quiz...</>
                    ) : (
                      <>Generate {inputs?.quizSettings?.numberOfQuestions || 5} Quiz Questions</>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{module.quizData?.questions.length} questions generated</p>
                      <Badge variant="outline" className="text-primary">
                        {inputs?.quizSettings?.difficulty}
                      </Badge>
                    </div>
                    {module.quizData?.questions.map((q) => (
                      <div key={q.id} className="flex items-start gap-2 p-2 bg-muted rounded text-sm">
                        <Checkbox
                          checked={q.included}
                          onCheckedChange={(checked) => forge.updateQuizQuestion(q.id, { included: !!checked })}
                        />
                        <span className="flex-1">{q.question}</span>
                        <Badge variant="secondary" className="text-xs">{q.type}</Badge>
                      </div>
                    ))}
                    {(() => {
                      const includedCount = module.quizData?.questions.filter((q) => q.included).length || 0;
                      const questionsToShow = module.quizData?.settings?.questionsToShow ?? includedCount;
                      if (includedCount === 0) return null;
                      return (
                        <div className="flex items-center justify-between gap-3 pt-3 mt-1 border-t">
                          <div>
                            <p className="text-sm font-medium">Questions shown to each learner</p>
                            <p className="text-xs text-muted-foreground">
                              A random subset is picked from the {includedCount} question{includedCount !== 1 ? "s" : ""} above, shuffled per learner - reduces answer-copying between learners.
                            </p>
                          </div>
                          <Input
                            type="number"
                            min={1}
                            max={includedCount}
                            value={Math.min(questionsToShow, includedCount)}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              forge.updateQuizSettings({ questionsToShow: Math.max(1, Math.min(val, includedCount)) });
                            }}
                            className="w-20 shrink-0"
                          />
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Assignment Generation */}
      {includeAssignments && (
        <Collapsible open={assignmentOpen} onOpenChange={setAssignmentOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Assignments {assignmentsGenerated ? `(${module.assignmentData?.assignments.length || 0})` : "(Not generated)"}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${assignmentOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <Card>
              <CardContent className="p-4 space-y-4">
                {!assignmentsGenerated ? (
                  <Button onClick={handleGenerateAssignments} disabled={forge.isGeneratingAssignments} className="w-full">
                    {forge.isGeneratingAssignments ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating Assignments...</>
                    ) : (
                      <>Generate {inputs?.assignmentSettings?.numberOfAssignments || 2} Assignments</>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{module.assignmentData?.assignments.length} assignments generated</p>
                    {module.assignmentData?.assignments.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 p-2 bg-muted rounded text-sm">
                        <Checkbox
                          checked={a.included}
                          onCheckedChange={(checked) => forge.updateAssignment(a.id, { included: !!checked })}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{a.title}</p>
                          <p className="text-muted-foreground text-xs">{a.goal}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Continue */}
      <div className="flex justify-end">
        <Button onClick={handleContinue} size="lg">
          Continue to Save & Submit
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
