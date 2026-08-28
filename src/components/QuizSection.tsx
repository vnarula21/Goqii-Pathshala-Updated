import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, Lock, Play } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import QuizModuleDisplay from "./QuizModuleDisplay";
import type { QuizQuestion } from "./QuizBuilder";
import { selectShuffledQuizQuestions } from "@/lib/quizShuffle";

interface QuizSectionProps {
  quiz: QuizQuestion[];
  moduleTitle: string;
  savedModuleId?: string;
  isModuleComplete: boolean;
  passingScore?: number;
  questionsToShow?: number;
  onComplete?: (score: number, isFirstAttempt: boolean) => void;
}

export default function QuizSection({
  quiz,
  moduleTitle,
  savedModuleId,
  isModuleComplete,
  passingScore = 70,
  questionsToShow,
  onComplete,
}: QuizSectionProps) {
  const { isSME, isSMEExpert } = useUserRole();
  const [quizStarted, setQuizStarted] = useState(false);

  const isContentCreator = isSME || isSMEExpert;

  // Shuffled + subset-selected only for the learner-facing attempt. Memoized
  // so it's picked ONCE per quiz session (component mount) and stays stable
  // while the learner is answering - it must not reshuffle mid-attempt.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const learnerQuiz = useMemo(() => selectShuffledQuizQuestions(quiz, questionsToShow), []);

  // SME/SME Expert View: Direct quiz preview
  if (isContentCreator) {
    return (
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Quiz Preview ({quiz.length} question{quiz.length !== 1 ? "s" : ""})
          </h2>
        </div>
        
        {/* Show quiz questions directly for review */}
        <QuizModuleDisplay
          module={{
            title: `${moduleTitle} - Quiz`,
            questions: quiz,
          }}
          savedModuleId={savedModuleId}
          passingScore={passingScore}
          onComplete={onComplete}
        />
      </div>
    );
  }

  // Learner/Manager View: Conditional quiz start
  if (!quizStarted) {
    return (
      <div className="mt-8">
        <Card className="border-dashed">
          <CardHeader className="text-center pb-2">
            <div className={`h-16 w-16 rounded-full mx-auto flex items-center justify-center mb-3 ${
              isModuleComplete ? "bg-primary/10" : "bg-muted"
            }`}>
              {isModuleComplete ? (
                <HelpCircle className="h-8 w-8 text-primary" />
              ) : (
                <Lock className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <CardTitle className="text-xl">
              {isModuleComplete ? "Ready to Test Your Knowledge?" : "Quiz Locked"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {isModuleComplete
                ? `This quiz has ${learnerQuiz.length} question${learnerQuiz.length !== 1 ? "s" : ""}. Good luck!`
                : "Complete the module content above to unlock the quiz."}
            </p>
            <Button
              size="lg"
              disabled={!isModuleComplete}
              onClick={() => setQuizStarted(true)}
              className="gap-2"
            >
              <Play className="h-5 w-5" />
              Start Quiz
            </Button>
            {!isModuleComplete && (
              <p className="text-xs text-muted-foreground">
                Watch the video or read the document completely to enable the quiz.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Quiz started - show actual quiz
  return (
    <div className="mt-8">
      <QuizModuleDisplay
        module={{
          title: `${moduleTitle} - Quiz`,
          questions: learnerQuiz,
        }}
        savedModuleId={savedModuleId}
        passingScore={passingScore}
        onComplete={onComplete}
      />
    </div>
  );
}
