import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical } from "lucide-react";
import type { QuizQuestion } from "./QuizBuilder";

interface QuizQuestionEditorProps {
  question: QuizQuestion;
  onChange: (updates: Partial<QuizQuestion>) => void;
}

export default function QuizQuestionEditor({ question, onChange }: QuizQuestionEditorProps) {
  const addOption = () => {
    if (question.options) {
      onChange({ options: [...question.options, ""] });
    }
  };

  const removeOption = (index: number) => {
    if (question.options && question.options.length > 2) {
      const newOptions = question.options.filter((_, i) => i !== index);
      onChange({ options: newOptions });
    }
  };

  const updateOption = (index: number, value: string) => {
    if (question.options) {
      const newOptions = [...question.options];
      newOptions[index] = value;
      onChange({ options: newOptions });
    }
  };

  const addMatchPair = () => {
    if (question.matchPairs) {
      onChange({ matchPairs: [...question.matchPairs, { left: "", right: "" }] });
    }
  };

  const removeMatchPair = (index: number) => {
    if (question.matchPairs && question.matchPairs.length > 1) {
      const newPairs = question.matchPairs.filter((_, i) => i !== index);
      onChange({ matchPairs: newPairs });
    }
  };

  const updateMatchPair = (index: number, side: "left" | "right", value: string) => {
    if (question.matchPairs) {
      const newPairs = [...question.matchPairs];
      newPairs[index] = { ...newPairs[index], [side]: value };
      onChange({ matchPairs: newPairs });
    }
  };

  return (
    <div className="space-y-4">
      {/* Question Text */}
      <div className="space-y-2">
        <Label>Question *</Label>
        <Textarea
          value={question.question}
          onChange={(e) => onChange({ question: e.target.value })}
          placeholder="Enter your question here..."
          rows={2}
        />
      </div>

      {/* Points */}
      <div className="space-y-2">
        <Label>Points</Label>
        <Input
          type="number"
          min={1}
          max={100}
          value={question.points}
          onChange={(e) => onChange({ points: parseInt(e.target.value) || 1 })}
          className="w-24"
        />
      </div>

      {/* Multiple Choice Options */}
      {question.type === "multiple_choice" && question.options && (
        <div className="space-y-2">
          <Label>Options (select correct answer)</Label>
          <RadioGroup
            value={(question.correctAnswer as string) ?? ""}
            onValueChange={(value) => onChange({ correctAnswer: value })}
          >
            {question.options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <RadioGroupItem value={option || `option-${index}`} id={`option-${index}`} />
                <Input
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOption(index)}
                  disabled={question.options!.length <= 2}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </RadioGroup>
          <Button variant="outline" size="sm" onClick={addOption}>
            <Plus className="h-4 w-4 mr-1" /> Add Option
          </Button>
        </div>
      )}

      {/* True/False */}
      {question.type === "true_false" && (
        <div className="space-y-2">
          <Label>Correct Answer</Label>
          <RadioGroup
            value={(question.correctAnswer as string) ?? ""}
            onValueChange={(value) => onChange({ correctAnswer: value })}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="True" id="true" />
              <Label htmlFor="true" className="cursor-pointer">True</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="False" id="false" />
              <Label htmlFor="false" className="cursor-pointer">False</Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {/* Short Answer */}
      {question.type === "short_answer" && (
        <div className="space-y-2">
          <Label>Sample/Expected Answer (for grading reference)</Label>
          <Textarea
            value={question.correctAnswer as string || ""}
            onChange={(e) => onChange({ correctAnswer: e.target.value })}
            placeholder="Enter the expected answer..."
            rows={2}
          />
        </div>
      )}

      {/* Match the Column */}
      {question.type === "match_column" && question.matchPairs && (
        <div className="space-y-2">
          <Label>Match Pairs</Label>
          <div className="space-y-2">
            {question.matchPairs.map((pair, index) => (
              <div key={index} className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={pair.left}
                  onChange={(e) => updateMatchPair(index, "left", e.target.value)}
                  placeholder="Left item"
                  className="flex-1"
                />
                <span className="text-muted-foreground">→</span>
                <Input
                  value={pair.right}
                  onChange={(e) => updateMatchPair(index, "right", e.target.value)}
                  placeholder="Right item"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMatchPair(index)}
                  disabled={question.matchPairs!.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={addMatchPair}>
            <Plus className="h-4 w-4 mr-1" /> Add Pair
          </Button>
        </div>
      )}

      {/* Fill in the Blank */}
      {question.type === "fill_blank" && (
        <div className="space-y-2">
          <Label>Correct Answer(s)</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Use [BLANK] in your question where the blank should appear
          </p>
          <Input
            value={Array.isArray(question.correctAnswer) ? question.correctAnswer.join(", ") : question.correctAnswer as string || ""}
            onChange={(e) => onChange({ correctAnswer: e.target.value.split(",").map(s => s.trim()) })}
            placeholder="Enter correct answer(s), comma separated"
          />
        </div>
      )}

      {/* Sequence/Ordering */}
      {question.type === "sequence" && (
        <div className="space-y-2">
          <Label>Items in Correct Order</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Enter items in the correct sequence (one per line)
          </p>
          <Textarea
            value={Array.isArray(question.correctAnswer) ? (question.correctAnswer as string[]).join("\n") : ""}
            onChange={(e) => onChange({ correctAnswer: e.target.value.split("\n").filter(s => s.trim()) })}
            placeholder="First item&#10;Second item&#10;Third item"
            rows={4}
          />
        </div>
      )}

      {/* Hotspot */}
      {question.type === "hotspot" && (
        <div className="space-y-2">
          <Label>Hotspot Configuration</Label>
          <p className="text-sm text-muted-foreground">
            Hotspot questions require an image with clickable areas. 
            This feature requires additional setup for image upload and area selection.
          </p>
          <Input
            value={question.correctAnswer as string || ""}
            onChange={(e) => onChange({ correctAnswer: e.target.value })}
            placeholder="Describe the correct hotspot area"
          />
        </div>
      )}

      {/* Explanation */}
      <div className="space-y-2">
        <Label>Explanation (shown after answering)</Label>
        <Textarea
          value={question.explanation || ""}
          onChange={(e) => onChange({ explanation: e.target.value })}
          placeholder="Explain why the answer is correct..."
          rows={2}
        />
      </div>
    </div>
  );
}
