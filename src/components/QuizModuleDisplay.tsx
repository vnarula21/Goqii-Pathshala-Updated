import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Check, X, Trophy, RotateCcw, Clock, Zap, ClipboardList, ArrowRight } from "lucide-react";
import { QuizTimer, useQuizTimer } from "@/components/gamification/QuizTimer";
import { useGamification } from "@/hooks/useGamification";
import { toast } from "sonner";
import type { QuizQuestion } from "./QuizBuilder";

// Normalize question types to handle different AI output formats
const normalizeQuestionType = (type: string): string => {
  const typeMap: Record<string, string> = {
    "mcq": "multiple_choice",
    "MCQ": "multiple_choice",
    "multipleChoice": "multiple_choice",
    "trueFalse": "true_false",
    "fillInBlank": "fill_blank",
    "shortAnswer": "short_answer",
    "matchColumn": "match_column",
  };
  return typeMap[type] || type;
};

interface QuizModuleDisplayProps {
  module: {
    title: string;
    questions: QuizQuestion[];
    quiz_time_limit_minutes?: number;
  };
  savedModuleId?: string;
  passingScore?: number;
  onComplete?: (score: number, isFirstAttempt: boolean) => void;
  assignmentCount?: number;
  onViewAssignments?: () => void;
  onContinue?: () => void;
}

export default function QuizModuleDisplay({ 
  module, 
  passingScore = 70, 
  onComplete,
  assignmentCount = 0,
  onViewAssignments,
  onContinue
}: QuizModuleDisplayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const isFirstAttemptRef = useRef(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const { totalSeconds, isTimeUp, handleTimeUp, hasTimeLimit } = useQuizTimer(
    module.quiz_time_limit_minutes
  );

  // Support both 'questions' and 'quiz' data formats, normalize types and add defaults
  const rawQuestions = module.questions || (module as any).quiz || [];
  const questions = rawQuestions.map((q: any, idx: number) => ({
    ...q,
    id: q.id || `q-${idx}`,
    type: normalizeQuestionType(q.type || "multiple_choice"),
    points: q.points ?? 1,
  }));

  const { addXPAsync, updateStreak, awardBadgeByName } = useGamification();

  // Auto-submit when time is up
  useEffect(() => {
    if (isTimeUp && !submitted) {
      handleSubmitQuiz();
    }
  }, [isTimeUp, submitted]);

  const handleSubmitQuiz = async () => {
    setSubmitted(true);
    setShowResults(true);
    
    const score = calculateScore();
    const passed = score.percentage >= passingScore;
    const isFirstAttempt = isFirstAttemptRef.current;

    if (passed && score.percentage >= 100) {
      awardBadgeByName("Perfect Score");
    }

    // Award XP for first attempt pass
    if (passed && isFirstAttempt) {
      try {
        await addXPAsync({ amount: 50, reason: "Quiz passed on first attempt! 🎯" });
        updateStreak();
        toast.success("+50 XP: Quiz mastered on first try!", {
          icon: <Zap className="h-4 w-4 text-yellow-500" />,
        });
      } catch (e) {
        console.error("Failed to award quiz XP:", e);
      }
    } else if (passed) {
      try {
        await addXPAsync({ amount: 10, reason: "Quiz passed" });
        updateStreak();
      } catch (e) {
        console.error("Failed to award quiz XP:", e);
      }
    }
    
    isFirstAttemptRef.current = false;
    setAttemptCount(prev => prev + 1);
  };
  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const handleAnswer = (questionId: string, answer: any) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleSubmitQuiz();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const calculateScore = () => {
    let correct = 0;
    let total = 0;

    questions.forEach((q) => {
      total += q.points;
      const answer = answers[q.id];
      
      if (q.type === "multiple_choice" || q.type === "true_false") {
        // Handle both indexed answers and full-text answers (AI format)
        if (answer === q.correctAnswer) {
          correct += q.points;
        } else if (q.options && q.options.indexOf(answer) !== -1 && answer === q.correctAnswer) {
          // Direct match with selected option text
          correct += q.points;
        } else if (q.options && typeof q.correctAnswer === 'string' && q.options.includes(q.correctAnswer) && answer === q.correctAnswer) {
          // AI format: correctAnswer is the full option text
          correct += q.points;
        }
      } else if (q.type === "fill_blank") {
        const correctAnswers = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
        if (correctAnswers.some(ca => ca?.toLowerCase().trim() === answer?.toLowerCase().trim())) {
          correct += q.points;
        }
      }
      // Short answer and others need manual grading
    });

    return { correct, total, percentage: total > 0 ? Math.round((correct / total) * 100) : 0 };
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
    setShowResults(false);
    setCurrentIndex(0);
    // Note: isFirstAttemptRef is already false after first attempt
  };

  if (showResults) {
    const score = calculateScore();
    const passed = score.percentage >= passingScore;

    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader className="text-center">
            <div className={`h-20 w-20 rounded-full mx-auto flex items-center justify-center mb-4 ${passed ? "bg-green-500/10" : "bg-amber-500/10"}`}>
              {passed ? (
                <Trophy className="h-10 w-10 text-green-500" />
              ) : (
                <Clock className="h-10 w-10 text-amber-500" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {passed 
                ? score.percentage >= 90 ? "Excellent!" : "You Passed!" 
                : "Below Passing Score"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div>
              <p className="text-4xl font-bold text-foreground">{score.percentage}%</p>
              <p className="text-muted-foreground">
                {score.correct} out of {score.total} points
              </p>
            </div>

            <Progress value={score.percentage} className="h-3" />

            <p className={`font-medium ${passed ? "text-green-600" : "text-amber-600"}`}>
              {passed
                ? `You met the passing score of ${passingScore}%`
                : `You need ${passingScore}% to pass. You scored ${passingScore - score.percentage}% below the requirement.`}
            </p>

            {/* Action buttons row */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={handleRetry}>
                <RotateCcw className="mr-2 h-5 w-5" />
                Retry Quiz
              </Button>
              {assignmentCount > 0 && onViewAssignments && (
                <Button 
                  variant="secondary"
                  onClick={() => {
                    // Complete the module first, then view assignments
                    if (onComplete) {
                      onComplete(score.percentage, isFirstAttemptRef.current);
                    }
                    onViewAssignments();
                  }}
                >
                  <ClipboardList className="mr-2 h-5 w-5" />
                  View Assignments ({assignmentCount})
                </Button>
              )}
            </div>

            {/* Continue button */}
            <div className="pt-2">
              {onContinue ? (
                <Button 
                  onClick={() => {
                    if (onComplete) {
                      onComplete(score.percentage, isFirstAttemptRef.current);
                    }
                    onContinue();
                  }}
                  variant={passed ? "default" : "secondary"}
                  className="w-full sm:w-auto"
                >
                  <ArrowRight className="mr-2 h-5 w-5" />
                  {passed ? "Continue to Course" : "Submit & Continue"}
                </Button>
              ) : onComplete && (
                <Button 
                  onClick={() => onComplete(score.percentage, isFirstAttemptRef.current)}
                  variant={passed ? "default" : "secondary"}
                >
                  <Check className="mr-2 h-5 w-5" />
                  {passed ? "Complete Module" : "Submit Anyway"}
                </Button>
              )}
            </div>
            
            {!passed && (
              <p className="text-sm text-muted-foreground">
                Tip: Review the material and retry to improve your score before submitting.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No questions in this quiz.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Timer */}
      {hasTimeLimit && totalSeconds && (
        <div className="flex justify-center mb-4">
          <QuizTimer
            totalSeconds={totalSeconds}
            onTimeUp={handleTimeUp}
            isPaused={submitted}
          />
        </div>
      )}

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <span>{currentQuestion.points} point{currentQuestion.points !== 1 ? "s" : ""}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{currentQuestion.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Multiple Choice */}
          {currentQuestion.type === "multiple_choice" && currentQuestion.options && (
            <RadioGroup
              value={answers[currentQuestion.id] || ""}
              onValueChange={(value) => handleAnswer(currentQuestion.id, value)}
            >
              {currentQuestion.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50">
                  <RadioGroupItem value={option} id={`opt-${index}`} />
                  <Label htmlFor={`opt-${index}`} className="flex-1 cursor-pointer">{option}</Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {/* True/False */}
          {currentQuestion.type === "true_false" && (
            <RadioGroup
              value={answers[currentQuestion.id] || ""}
              onValueChange={(value) => handleAnswer(currentQuestion.id, value)}
              className="flex gap-4"
            >
              {["True", "False"].map((option) => (
                <div key={option} className="flex-1">
                  <div className={`flex items-center justify-center p-4 rounded-lg border cursor-pointer transition-colors ${
                    answers[currentQuestion.id] === option ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                  }`}>
                    <RadioGroupItem value={option} id={option} className="sr-only" />
                    <Label htmlFor={option} className="cursor-pointer font-medium">{option}</Label>
                  </div>
                </div>
              ))}
            </RadioGroup>
          )}

          {/* Short Answer */}
          {currentQuestion.type === "short_answer" && (
            <Textarea
              value={answers[currentQuestion.id] || ""}
              onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
              placeholder="Type your answer here..."
              rows={4}
            />
          )}

          {/* Fill in the Blank */}
          {currentQuestion.type === "fill_blank" && (
            <Input
              value={answers[currentQuestion.id] || ""}
              onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
              placeholder="Enter your answer..."
            />
          )}

          {/* Match Column - Simplified */}
          {currentQuestion.type === "match_column" && currentQuestion.matchPairs && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Match the items on the left with the correct items on the right.</p>
              {currentQuestion.matchPairs.map((pair, index) => (
                <div key={index} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                  <span className="flex-1 font-medium">{pair.left}</span>
                  <span className="text-muted-foreground">→</span>
                  <Input
                    value={answers[currentQuestion.id]?.[index] || ""}
                    onChange={(e) => {
                      const newAnswers = { ...(answers[currentQuestion.id] || {}) };
                      newAnswers[index] = e.target.value;
                      handleAnswer(currentQuestion.id, newAnswers);
                    }}
                    placeholder="Match..."
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Sequence */}
          {currentQuestion.type === "sequence" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Enter the items in the correct order (one per line).</p>
              <Textarea
                value={answers[currentQuestion.id] || ""}
                onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                placeholder="First item&#10;Second item&#10;Third item"
                rows={4}
              />
            </div>
          )}

          {/* Hotspot - Placeholder */}
          {currentQuestion.type === "hotspot" && (
            <div className="p-8 border-2 border-dashed rounded-lg text-center">
              <p className="text-muted-foreground">Hotspot interaction would be displayed here.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        <Button
          onClick={handleNext}
          disabled={!answers[currentQuestion.id]}
        >
          {currentIndex === questions.length - 1 ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Submit
            </>
          ) : (
            <>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
