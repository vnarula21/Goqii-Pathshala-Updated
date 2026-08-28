import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Types for the Module Forge workflow
export interface ForgeInputs {
  topic: string;
  description: string;
  scope: string;
  depth: "Quick" | "Standard" | "Deep";
  imagesRequired: boolean;
  style: string;
  // Format preferences (moved from Step4)
  format: FormatType;
  formatPreferences: FormatPreferences;
  // Quiz config (optional)
  includeQuiz: boolean;
  quizSettings?: QuizSettings;
  // Assignment config (optional)
  includeAssignments: boolean;
  assignmentSettings?: AssignmentSettings;
  // Interactive PPT
  enableNarration?: boolean;
  narrationVoice?: string;
}

export interface QuizQuestion {
  id: string;
  type: "mcq" | "true-false" | "scenario";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  included: boolean;
}

export interface Assignment {
  id: string;
  title: string;
  goal: string;
  instructions: string;
  expectedOutput: string;
  evaluationCriteria: string[];
  rubric?: {
    criterion: string;
    excellent: string;
    good: string;
    needsImprovement: string;
  }[];
  included: boolean;
}

export interface QuizSettings {
  numberOfQuestions: number;
  difficulty: "Easy" | "Medium" | "Hard";
  types: ("MCQ" | "True-False" | "Scenario")[];
  /** How many of the generated/included questions to randomly show each
   * learner (a shuffled subset, different per attempt, to reduce copying
   * answers between learners). Falls back to showing all questions if unset. */
  questionsToShow?: number;
}

export interface AssignmentSettings {
  numberOfAssignments: number;
  type: "worksheet" | "case study" | "project";
  rubricRequired: boolean;
}

export type FormatType = "PPT" | "Article" | "Document" | "Video";

export interface PPTPreferences {
  numberOfSlides?: number;
  includeSpeakerNotes?: boolean;
  includeImages?: boolean;
}

export interface ArticlePreferences {
  readingLength?: "Short" | "Medium" | "Long";
  includeHeadings?: boolean;
  includeImages?: boolean;
}

export interface DocumentPreferences {
  formatStyle?: "Textbook" | "Workbook";
  includeSummaryBoxes?: boolean;
  includeImages?: boolean;
}

export interface VideoPreferences {
  durationSeconds?: number;
  outputType?: "Script only" | "Script + Storyboard";
  voiceTone?: string;
}

export type FormatPreferences = PPTPreferences & ArticlePreferences & DocumentPreferences & VideoPreferences;

export interface FormattedOutput {
  type: FormatType;
  content: any;
  preferences: FormatPreferences;
}

export type ForgeStatus = 
  | "draft_input" 
  | "prompt_approved" 
  | "content_generated" 
  | "formatted" 
  | "submitted_to_sme";

export interface ForgeModule {
  id?: string;
  forgeStatus: ForgeStatus;
  forgeInputs: ForgeInputs | null;
  approvedPrompt: string | null;
  rawContent: string | null;
  formattedOutput: FormattedOutput | null;
  quizData: {
    questions: QuizQuestion[];
    settings: QuizSettings;
  } | null;
  assignmentData: {
    assignments: Assignment[];
    settings: AssignmentSettings;
  } | null;
  title: string;
  description: string;
}

export interface UseModuleForge {
  module: ForgeModule;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  
  // Step 1
  saveInputs: (inputs: ForgeInputs) => Promise<void>;
  
  // Step 2
  generatePrompt: (inputs: ForgeInputs) => Promise<string>;
  regeneratePrompt: () => Promise<string>;
  approvePrompt: (prompt: string) => Promise<void>;
  
  // Step 3 - Generate formatted module directly
  generateFinalModule: (format: FormatType, preferences: FormatPreferences, rawContent?: string) => Promise<FormattedOutput>;
  saveFormattedOutput: (output: FormattedOutput) => void;
  saveContentDraft: (content: string) => Promise<void>;
  
  // Step 4 - Edit & Review: Quiz/Assignment generation from generated content
  generateQuiz: (settings: QuizSettings) => Promise<QuizQuestion[]>;
  generateAssignments: (settings: AssignmentSettings) => Promise<Assignment[]>;
  updateQuizQuestion: (questionId: string, updates: Partial<QuizQuestion>) => void;
  updateQuizSettings: (updates: Partial<QuizSettings>) => void;
  updateAssignment: (assignmentId: string, updates: Partial<Assignment>) => void;
  updateFormattedContent: (content: any) => void;
  
  // Step 5
  submitToSME: () => Promise<string | undefined>;
  
  // Loading states
  isGeneratingPrompt: boolean;
  isGeneratingContent: boolean;
  isFormatting: boolean;
  isGeneratingQuiz: boolean;
  isGeneratingAssignments: boolean;
  isSaving: boolean;
  
  resetForge: () => void;
}

const initialModule: ForgeModule = {
  forgeStatus: "draft_input",
  forgeInputs: null,
  approvedPrompt: null,
  rawContent: null,
  formattedOutput: null,
  quizData: null,
  assignmentData: null,
  title: "",
  description: "",
};

export function useModuleForge(): UseModuleForge {
  const { user } = useAuth();
  const [module, setModule] = useState<ForgeModule>(initialModule);
  const [currentStep, setCurrentStep] = useState(1);
  
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isGeneratingAssignments, setIsGeneratingAssignments] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Step 1: Save inputs
  const saveInputs = useCallback(async (inputs: ForgeInputs) => {
    setModule((prev) => ({
      ...prev,
      forgeInputs: inputs,
      title: inputs.topic,
      description: inputs.description,
    }));
  }, []);

  // Step 2: Generate prompt (now includes format/quiz/assignment context)
  const generatePrompt = useCallback(async (inputs: ForgeInputs): Promise<string> => {
    setIsGeneratingPrompt(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-prompt", {
        body: {
          topic: inputs.topic,
          description: inputs.description,
          scope: inputs.scope,
          depth: inputs.depth,
          imagesRequired: inputs.imagesRequired,
          format: inputs.format,
          formatPreferences: inputs.formatPreferences,
          includeQuiz: inputs.includeQuiz,
          quizSettings: inputs.quizSettings,
          includeAssignments: inputs.includeAssignments,
          assignmentSettings: inputs.assignmentSettings,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data.masterPrompt;
    } catch (err) {
      console.error("Error generating prompt:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate prompt");
      throw err;
    } finally {
      setIsGeneratingPrompt(false);
    }
  }, []);

  const regeneratePrompt = useCallback(async (): Promise<string> => {
    if (!module.forgeInputs) throw new Error("No inputs to regenerate from");
    return generatePrompt(module.forgeInputs);
  }, [module.forgeInputs, generatePrompt]);

  const approvePrompt = useCallback(async (prompt: string) => {
    setModule((prev) => ({
      ...prev,
      approvedPrompt: prompt,
      forgeStatus: "prompt_approved",
    }));
  }, []);

  // Step 3: Generate final formatted module directly from approved prompt
  const generateFinalModule = useCallback(async (
    format: FormatType,
    preferences: FormatPreferences,
    rawContent?: string
  ): Promise<FormattedOutput> => {
    const contentToUse = rawContent || module.rawContent || module.approvedPrompt;
    if (!contentToUse) throw new Error("No content to format");
    
    setIsFormatting(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-final-module", {
        body: {
          moduleContent: contentToUse,
          targetFormat: format,
          formatPreferences: preferences,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const output: FormattedOutput = {
        type: format,
        content: data.formattedContent,
        preferences,
      };

      return output;
    } catch (err) {
      console.error("Error generating final module:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate module");
      throw err;
    } finally {
      setIsFormatting(false);
    }
  }, [module.rawContent, module.approvedPrompt]);

  const saveFormattedOutput = useCallback((output: FormattedOutput) => {
    setModule((prev) => ({
      ...prev,
      formattedOutput: output,
      forgeStatus: "formatted",
    }));
  }, []);

  const saveContentDraft = useCallback(async (content: string) => {
    setModule((prev) => ({
      ...prev,
      rawContent: content,
      forgeStatus: "content_generated",
    }));
  }, []);

  // Step 4: Generate quiz from formatted content
  const generateQuiz = useCallback(async (settings: QuizSettings): Promise<QuizQuestion[]> => {
    const content = module.rawContent || JSON.stringify(module.formattedOutput?.content);
    if (!content) throw new Error("No content to generate quiz from");
    
    setIsGeneratingQuiz(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: {
          moduleContent: content,
          numberOfQuestions: settings.numberOfQuestions,
          difficulty: settings.difficulty,
          types: settings.types,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const questions = data.questions as QuizQuestion[];
      
      setModule((prev) => ({
        ...prev,
        quizData: { questions, settings },
      }));

      return questions;
    } catch (err) {
      console.error("Error generating quiz:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate quiz");
      throw err;
    } finally {
      setIsGeneratingQuiz(false);
    }
  }, [module.rawContent, module.formattedOutput]);

  const generateAssignments = useCallback(async (settings: AssignmentSettings): Promise<Assignment[]> => {
    const content = module.rawContent || JSON.stringify(module.formattedOutput?.content);
    if (!content) throw new Error("No content to generate assignments from");
    
    setIsGeneratingAssignments(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-assignments", {
        body: {
          moduleContent: content,
          numberOfAssignments: settings.numberOfAssignments,
          type: settings.type,
          rubricRequired: settings.rubricRequired,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const assignments = data.assignments as Assignment[];
      
      setModule((prev) => ({
        ...prev,
        assignmentData: { assignments, settings },
      }));

      return assignments;
    } catch (err) {
      console.error("Error generating assignments:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate assignments");
      throw err;
    } finally {
      setIsGeneratingAssignments(false);
    }
  }, [module.rawContent, module.formattedOutput]);

  const updateQuizQuestion = useCallback((questionId: string, updates: Partial<QuizQuestion>) => {
    setModule((prev) => {
      if (!prev.quizData) return prev;
      return {
        ...prev,
        quizData: {
          ...prev.quizData,
          questions: prev.quizData.questions.map((q) =>
            q.id === questionId ? { ...q, ...updates } : q
          ),
        },
      };
    });
  }, []);

  const updateQuizSettings = useCallback((updates: Partial<QuizSettings>) => {
    setModule((prev) => {
      if (!prev.quizData) return prev;
      return {
        ...prev,
        quizData: {
          ...prev.quizData,
          settings: { ...prev.quizData.settings, ...updates },
        },
      };
    });
  }, []);

  const updateAssignment = useCallback((assignmentId: string, updates: Partial<Assignment>) => {
    setModule((prev) => {
      if (!prev.assignmentData) return prev;
      return {
        ...prev,
        assignmentData: {
          ...prev.assignmentData,
          assignments: prev.assignmentData.assignments.map((a) =>
            a.id === assignmentId ? { ...a, ...updates } : a
          ),
        },
      };
    });
  }, []);

  const updateFormattedContent = useCallback((content: any) => {
    setModule((prev) => {
      if (!prev.formattedOutput) return prev;
      return {
        ...prev,
        formattedOutput: {
          ...prev.formattedOutput,
          content,
        },
      };
    });
  }, []);

  // Step 5: Submit to SME
  const submitToSME = useCallback(async () => {
    if (!user) {
      toast.error("You must be logged in to submit a module");
      return;
    }

    if (!module.formattedOutput) {
      toast.error("Please generate your module first before submitting");
      return;
    }

    if (!module.title) {
      toast.error("Module title is required");
      return;
    }
    
    setIsSaving(true);
    try {
      const includedQuizQuestions = module.quizData?.questions.filter((q) => q.included) || [];
      const includedAssignments = module.assignmentData?.assignments.filter((a) => a.included) || [];

      let moduleType = "document";
      if (module.formattedOutput) {
        if (module.formattedOutput.content?.isInteractivePPT) {
          moduleType = "presentation";
        } else {
          switch (module.formattedOutput.type) {
            case "PPT":
              moduleType = "presentation";
              break;
            case "Article":
              moduleType = "document";
              break;
            case "Document":
              moduleType = "document";
              break;
            case "Video":
              moduleType = "video";
              break;
          }
        }
      }

      const { data, error } = await supabase.from("modules").insert([{
        user_id: user.id,
        title: module.title,
        description: module.description,
        module_type: moduleType,
        slides: module.formattedOutput?.content || {},
        forge_status: "submitted_to_sme",
        forge_inputs: module.forgeInputs as any,
        approved_prompt: module.approvedPrompt,
        raw_content: module.rawContent,
        formatted_output: module.formattedOutput as any,
        quiz_data: includedQuizQuestions.length > 0 ? {
          questions: includedQuizQuestions,
          settings: module.quizData?.settings,
        } as any : null,
        assignment_data: includedAssignments.length > 0 ? {
          assignments: includedAssignments,
          settings: module.assignmentData?.settings,
        } as any : null,
        approval_status: "pending_review",
        submitted_for_review_at: new Date().toISOString(),
        submitted_by: user.id,
      }]).select().single();

      if (error) throw error;

      if (includedQuizQuestions.length > 0) {
        const { error: quizError } = await supabase.from("module_quizzes" as any).insert({
          module_id: data.id,
          module_name: module.title,
          questions: includedQuizQuestions,
          settings: module.quizData?.settings || {},
          quiz_ai_used: null,
        } as any);
        
        if (quizError) {
          console.error("Error saving quiz to module_quizzes:", quizError);
        }
      }

      if (includedAssignments.length > 0) {
        const assignmentInserts = includedAssignments.map((assignment, idx) => ({
          module_id: data.id,
          module_name: module.title,
          title: assignment.title,
          goal: assignment.goal,
          instructions: assignment.instructions,
          expected_output: assignment.expectedOutput,
          evaluation_criteria: assignment.evaluationCriteria || [],
          rubric: assignment.rubric || null,
          order_index: idx,
        }));

        const { error: assignmentError } = await supabase
          .from("module_assignments" as any)
          .insert(assignmentInserts as any);
        
        if (assignmentError) {
          console.error("Error saving assignments to module_assignments:", assignmentError);
        }
      }

      if (module.formattedOutput?.content?.isInteractivePPT && module.formattedOutput?.content?.slides) {
        const slides = module.formattedOutput.content.slides as any[];
        const audioInserts = slides
          .filter((s: any) => s.speakerNotes || s.narration_text)
          .map((s: any) => ({
            module_id: data.id,
            slide_number: s.slideNumber || s.slide_number,
            narration_text: s.speakerNotes || s.narration_text,
            audio_status: "pending",
          }));

        if (audioInserts.length > 0) {
          const { error: audioError } = await supabase
            .from("module_slide_audio" as any)
            .insert(audioInserts as any);
          
          if (audioError) {
            console.error("Error inserting module_slide_audio records:", audioError);
          }
        }
      }

      setModule((prev) => ({
        ...prev,
        id: data.id,
        forgeStatus: "submitted_to_sme",
      }));

      toast.success("Module submitted for SME review!");
      return data.id as string;
    } catch (err) {
      console.error("Error submitting module:", err);
      toast.error(err instanceof Error ? err.message : "Failed to submit module");
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [user, module]);

  const resetForge = useCallback(() => {
    setModule(initialModule);
    setCurrentStep(1);
  }, []);

  return {
    module,
    currentStep,
    setCurrentStep,
    saveInputs,
    generatePrompt,
    regeneratePrompt,
    approvePrompt,
    generateFinalModule,
    saveFormattedOutput,
    saveContentDraft,
    generateQuiz,
    generateAssignments,
    updateQuizQuestion,
    updateQuizSettings,
    updateAssignment,
    updateFormattedContent,
    submitToSME,
    isGeneratingPrompt,
    isGeneratingContent,
    isFormatting,
    isGeneratingQuiz,
    isGeneratingAssignments,
    isSaving,
    resetForge,
  };
}
