import type { QuizQuestion } from "@/components/QuizBuilder";

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Given a full pool of quiz questions and how many should be shown, returns
 * a shuffled subset. If questionsToShow is unset or >= the pool size, all
 * questions are returned, still shuffled (order randomization alone still
 * helps against learners comparing notes on "question 1, question 2...").
 * Called fresh each time a learner starts the quiz, so different learners
 * (and different attempts) get different questions/order.
 */
export function selectShuffledQuizQuestions(
  pool: QuizQuestion[],
  questionsToShow?: number | null
): QuizQuestion[] {
  const shuffled = shuffleArray(pool);
  if (!questionsToShow || questionsToShow >= shuffled.length) {
    return shuffled;
  }
  return shuffled.slice(0, questionsToShow);
}

/**
 * Finds the "questions to show" setting from whichever quiz storage shape
 * the module uses (AI-generated quiz_data.settings, or manual QuizBuilder's
 * slides.quiz_questions_to_show).
 */
export function extractQuestionsToShow(module: any): number | undefined {
  return (
    module?.quiz_data?.settings?.questionsToShow ??
    module?.slides?.quiz_data?.settings?.questionsToShow ??
    module?.slides?.quiz_questions_to_show ??
    undefined
  );
}
