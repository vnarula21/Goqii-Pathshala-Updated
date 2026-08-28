import { useState } from "react";
import PDFModuleDisplay from "./PDFModuleDisplay";
import VideoModuleDisplay from "./VideoModuleDisplay";
import UploadedDocumentDisplay from "./UploadedDocumentDisplay";
import QuizModuleDisplay from "./QuizModuleDisplay";
import QuizSection from "./QuizSection";
import PresentationModuleDisplay from "./PresentationModuleDisplay";
import NarratedSlideshow from "./NarratedSlideshow";
import InteractivePPTPlayer from "./InteractivePPTPlayer";
import ArticleModuleDisplay from "./ArticleModuleDisplay";
import DocumentModuleDisplay from "./DocumentModuleDisplay";
import VideoScriptDisplay from "./VideoScriptDisplay";
import type { QuizQuestion } from "./QuizBuilder";
import { extractQuestionsToShow } from "@/lib/quizShuffle";

/**
 * Unified quiz data extraction - handles all possible quiz data locations:
 * 1. module.quiz (direct array)
 * 2. module.questions (alternative format)
 * 3. module.slides?.quiz (embedded in slides for file uploads)
 * 4. module.quiz_data?.questions (AI-generated format from Module Forge)
 * 5. module.formatted_output?.quiz (from forge formatted output)
 * 6. module.slides?.quiz_data?.questions (nested AI-generated)
 */
function extractQuizData(module: any): QuizQuestion[] {
  // Priority 1: Direct quiz array on module
  if (Array.isArray(module?.quiz) && module.quiz.length > 0) {
    return module.quiz;
  }
  
  // Priority 2: Direct questions array (alternative format)
  if (Array.isArray(module?.questions) && module.questions.length > 0) {
    return module.questions;
  }
  
  // Priority 3: Quiz embedded in slides (file uploads with manual quiz)
  if (Array.isArray(module?.slides?.quiz) && module.slides.quiz.length > 0) {
    return module.slides.quiz;
  }
  
  // Priority 4: AI-generated quiz_data (from Module Forge)
  if (Array.isArray(module?.quiz_data?.questions) && module.quiz_data.questions.length > 0) {
    return module.quiz_data.questions;
  }
  
  // Priority 5: quiz_data as direct array
  if (Array.isArray(module?.quiz_data) && module.quiz_data.length > 0) {
    return module.quiz_data;
  }
  
  // Priority 6: Formatted output quiz (from forge)
  if (Array.isArray(module?.formatted_output?.quiz) && module.formatted_output.quiz.length > 0) {
    return module.formatted_output.quiz;
  }
  
  // Priority 7: Nested in slides.quiz_data
  if (Array.isArray(module?.slides?.quiz_data?.questions) && module.slides.quiz_data.questions.length > 0) {
    return module.slides.quiz_data.questions;
  }
  
  if (Array.isArray(module?.slides?.quiz_data) && module.slides.quiz_data.length > 0) {
    return module.slides.quiz_data;
  }
  
  return [];
}

interface ModuleRouterProps {
  module: any;
  moduleType?: string;
  savedModuleId?: string;
  existingData?: {
    description?: string;
    isFavorite?: boolean;
    tagIds?: string[];
  };
  timeLimitMinutes?: number;
  isModulePublished?: boolean;
  passingScore?: number;
  onComplete?: (score: number, isFirstAttempt: boolean) => void;
  onContentComplete?: () => void;
}

// Content type detection logic
function detectModuleContentType(module: any, moduleType?: string) {
  // Get the slides data - could be the module itself or nested in slides property
  const slides = module?.slides || module;
  
  // Check for file URL - indicates uploaded file
  const fileUrl = module?.fileUrl || slides?.fileUrl;
  const fileType = module?.type || slides?.type || moduleType;
  
  if (fileUrl) {
    return {
      renderMode: "file" as const,
      fileUrl,
      fileType,
      fileName: module?.fileName || slides?.fileName,
    };
  }
  
  // AI-generated presentation (has slides array with bullet points)
  if (slides?.slides && Array.isArray(slides.slides)) {
    return {
      renderMode: "ai_presentation" as const,
      slides: slides.slides,
      chapters: slides.chapters,
    };
  }
  
  // AI-generated presentation with chapters
  if (slides?.chapters && Array.isArray(slides.chapters)) {
    return {
      renderMode: "ai_presentation" as const,
      chapters: slides.chapters,
    };
  }
  
  // AI-generated article (has sections + heroImageUrl)
  if (slides?.sections && slides?.heroImageUrl !== undefined) {
    return {
      renderMode: "ai_article" as const,
      content: slides,
    };
  }
  
  // AI-generated document (has sections and/or definitions)
  if (slides?.sections && (slides?.definitions !== undefined || slides?.learning_objectives !== undefined || slides?.key_points !== undefined)) {
    return {
      renderMode: "ai_document" as const,
      content: slides,
    };
  }
  
  // Generic sections-based content (could be article or document)
  if (slides?.sections && Array.isArray(slides.sections)) {
    return {
      renderMode: "ai_document" as const,
      content: slides,
    };
  }
  
  // AI-generated video script
  if (slides?.scenes || slides?.explain_scenes) {
    return {
      renderMode: "ai_video_script" as const,
      content: slides,
      scenes: slides?.scenes || [],
    };
  }
  
  // Check for inline slides array in module itself (direct presentation format)
  if (Array.isArray(module?.slides) && module.slides.length > 0 && module.slides[0]?.title) {
    return {
      renderMode: "ai_presentation" as const,
      slides: module.slides,
    };
  }
  
  return { renderMode: "unknown" as const };
}

export default function ModuleRouter({
  module,
  moduleType,
  savedModuleId,
  timeLimitMinutes,
  isModulePublished,
  passingScore,
  onComplete,
  onContentComplete,
}: ModuleRouterProps) {
  const [isContentComplete, setIsContentComplete] = useState(false);

  // Determine effective type - prioritize module.type for uploaded files
  const type = module?.type || moduleType || module?.module_type || "document";
  
  // Detect content type
  const contentInfo = detectModuleContentType(module, type);

  // Unified quiz data extraction - check all possible locations
  const quizData = extractQuizData(module);
  const hasQuiz = Array.isArray(quizData) && quizData.length > 0;
  const questionsToShow = extractQuestionsToShow(module);

  const handleContentComplete = () => {
    setIsContentComplete(true);
    onContentComplete?.();
  };

  // Helper to render quiz section with conditional logic
  const renderQuizSection = () => {
    if (!hasQuiz) return null;
    
    return (
      <QuizSection
        quiz={quizData}
        moduleTitle={module?.title || "Module"}
        savedModuleId={savedModuleId}
        isModuleComplete={isContentComplete}
        passingScore={passingScore}
        questionsToShow={questionsToShow}
        onComplete={onComplete}
      />
    );
  };

  // Route based on detected content type first, then fall back to module type
  
  // Handle file-based modules
  if (contentInfo.renderMode === "file") {
    const { fileType, fileUrl, fileName } = contentInfo;
    
    // PDF file
    if (fileType === "pdf" || fileUrl?.toLowerCase().endsWith(".pdf")) {
      return (
        <>
          <PDFModuleDisplay 
            module={{ title: module.title, fileUrl, fileName }} 
            savedModuleId={savedModuleId}
            onModuleComplete={handleContentComplete}
          />
          {renderQuizSection()}
        </>
      );
    }
    
    // PPT/PPTX file → narrated slideshow (rendered slides read aloud with AI
    // narration). Falls back to the raw deck viewer only if we have no module id.
    if (fileType === "ppt" || fileUrl?.toLowerCase().match(/\.pptx?$/)) {
      return (
        <>
          {savedModuleId ? (
            <NarratedSlideshow
              moduleId={savedModuleId}
              title={module.title}
              onModuleComplete={handleContentComplete}
            />
          ) : (
            <PresentationModuleDisplay
              module={{ title: module.title, fileUrl, fileName }}
              savedModuleId={savedModuleId}
              timeLimitMinutes={timeLimitMinutes}
              onModuleComplete={handleContentComplete}
            />
          )}
          {renderQuizSection()}
        </>
      );
    }
    
    // Video file
    if (fileType === "video" || fileUrl?.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/)) {
      return (
        <>
          <VideoModuleDisplay 
            module={{ title: module.title, fileUrl, fileName }} 
            savedModuleId={savedModuleId}
            onModuleComplete={handleContentComplete}
          />
          {renderQuizSection()}
        </>
      );
    }
    
    // Document file (Word, TXT, RTF)
    if (fileType === "document" || fileType === "uploaded_document" || 
        fileUrl?.toLowerCase().match(/\.(docx?|txt|rtf)$/)) {
      return (
        <>
          <UploadedDocumentDisplay 
            module={{ title: module.title, fileUrl, fileName }} 
            savedModuleId={savedModuleId}
            onModuleComplete={handleContentComplete}
          />
          {renderQuizSection()}
        </>
      );
    }
    
    // Generic file fallback
    return (
      <>
        <UploadedDocumentDisplay 
          module={{ title: module.title, fileUrl, fileName }} 
          savedModuleId={savedModuleId}
          onModuleComplete={handleContentComplete}
        />
        {renderQuizSection()}
      </>
    );
  }
  
  // Handle AI-generated interactive PPT (has narration_text or isInteractivePPT flag)
  if (contentInfo.renderMode === "ai_presentation") {
    const slides = contentInfo.slides || [];
    const isInteractive = 
      module?.slides?.isInteractivePPT || 
      module?.isInteractivePPT ||
      slides.some((s: any) => s.narration_text);

    if (isInteractive) {
      return (
        <>
          <InteractivePPTPlayer 
            module={{ 
              title: module.title, 
              slides: slides,
            }} 
            savedModuleId={savedModuleId}
            onModuleComplete={handleContentComplete}
          />
          {renderQuizSection()}
        </>
      );
    }

    // Regular presentation
    return (
      <>
        <PresentationModuleDisplay 
          module={{ 
            title: module.title, 
            slides: contentInfo.slides,
            chapters: contentInfo.chapters,
          }} 
          savedModuleId={savedModuleId}
          timeLimitMinutes={timeLimitMinutes}
          onModuleComplete={handleContentComplete}
        />
        {renderQuizSection()}
      </>
    );
  }
  
  // Handle AI-generated article
  if (contentInfo.renderMode === "ai_article") {
    return (
      <>
        <ArticleModuleDisplay 
          module={{ 
            title: module.title, 
            ...contentInfo.content,
          }} 
          savedModuleId={savedModuleId}
          timeLimitMinutes={timeLimitMinutes}
          onModuleComplete={handleContentComplete}
        />
        {renderQuizSection()}
      </>
    );
  }
  
  // Handle AI-generated video script
  if (contentInfo.renderMode === "ai_video_script") {
    const scenes = contentInfo.scenes || [];
    const videoUrl = module?.resolvedVideoUrl;

    // If a rendered video URL exists, show the video player
    if (videoUrl) {
      return (
        <>
          <VideoModuleDisplay
            module={{ title: module.title, fileUrl: videoUrl }}
            savedModuleId={savedModuleId}
            onModuleComplete={handleContentComplete}
          />
          {renderQuizSection()}
        </>
      );
    }

    // Otherwise show the scene script preview
    return (
      <>
        <VideoScriptDisplay
          title={module?.title || "Video Script"}
          scenes={scenes}
          totalDuration={contentInfo.content?.total_duration}
        />
        {renderQuizSection()}
      </>
    );
  }

  // Handle AI-generated document
  if (contentInfo.renderMode === "ai_document") {
    return (
      <>
        <DocumentModuleDisplay 
          module={{ 
            title: module.title, 
            description: module.description,
            ...contentInfo.content,
          }} 
          savedModuleId={savedModuleId}
          timeLimitMinutes={timeLimitMinutes}
          onModuleComplete={handleContentComplete}
        />
        {renderQuizSection()}
      </>
    );
  }

  // Fall back to type-based routing for edge cases
  switch (type) {
    case "pdf":
      return (
        <>
          <PDFModuleDisplay module={module} savedModuleId={savedModuleId} onModuleComplete={handleContentComplete} />
          {renderQuizSection()}
        </>
      );
    case "ppt":
    case "presentation":
      return (
        <>
          <PresentationModuleDisplay 
            module={module} 
            savedModuleId={savedModuleId}
            timeLimitMinutes={timeLimitMinutes}
            onModuleComplete={handleContentComplete}
          />
          {renderQuizSection()}
        </>
      );
    case "video":
      return (
        <>
          <VideoModuleDisplay 
            module={module} 
            savedModuleId={savedModuleId}
            onModuleComplete={handleContentComplete}
          />
          {renderQuizSection()}
        </>
      );
    case "uploaded_document":
    case "document":
      // Try to detect if it's an AI document with sections
      if (module?.sections || module?.slides?.sections) {
        return (
          <>
            <DocumentModuleDisplay 
              module={{ 
                title: module.title, 
                description: module.description,
                sections: module.sections || module.slides?.sections,
                definitions: module.definitions || module.slides?.definitions,
                learning_objectives: module.learning_objectives || module.slides?.learning_objectives,
                key_points: module.key_points || module.slides?.key_points,
                content_summary: module.content_summary || module.slides?.content_summary,
              }} 
              savedModuleId={savedModuleId}
              timeLimitMinutes={timeLimitMinutes}
              onModuleComplete={handleContentComplete}
            />
            {renderQuizSection()}
          </>
        );
      }
      return (
        <>
          <UploadedDocumentDisplay 
            module={module} 
            savedModuleId={savedModuleId}
            onModuleComplete={handleContentComplete}
          />
          {renderQuizSection()}
        </>
      );
    case "Article":
      return (
        <>
          <ArticleModuleDisplay 
            module={{ 
              title: module.title, 
              description: module.description,
              sections: module.sections || module.slides?.sections,
              heroImageUrl: module.heroImageUrl || module.slides?.heroImageUrl,
              summary: module.summary || module.slides?.summary,
            }} 
            savedModuleId={savedModuleId}
            timeLimitMinutes={timeLimitMinutes}
            onModuleComplete={handleContentComplete}
          />
          {renderQuizSection()}
        </>
      );
    case "quiz":
      return (
        <QuizModuleDisplay
          module={{
            ...module,
            quiz_time_limit_minutes: timeLimitMinutes,
          }}
          savedModuleId={savedModuleId}
          passingScore={passingScore}
          onComplete={onComplete}
        />
      );
    default:
      // Final fallback - try to show something useful
      if (module?.sections || module?.slides?.sections) {
        return (
          <>
            <DocumentModuleDisplay 
              module={{ 
                title: module.title || "Untitled Module", 
                description: module.description,
                sections: module.sections || module.slides?.sections,
              }} 
              savedModuleId={savedModuleId}
              timeLimitMinutes={timeLimitMinutes}
              onModuleComplete={handleContentComplete}
            />
            {renderQuizSection()}
          </>
        );
      }
      return (
        <div className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Module: {module?.title || "Untitled"}</h2>
          <p className="text-muted-foreground">Module type "{type}" display coming soon.</p>
        </div>
      );
  }
}
