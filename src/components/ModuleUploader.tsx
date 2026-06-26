import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Video, FileText, Presentation, File, Upload, Check, FileQuestion, Save, Send } from "lucide-react";
import { TagSelector } from "./TagSelector";
import { useSaveModule } from "@/hooks/useSaveModule";
import QuizBuilderCore, { QuizQuestion } from "./QuizBuilderCore";
import { validateFile, getModuleFileContext } from "@/lib/fileValidation";
import { extractPptxSpeakerNotes, getPptxSlideCount, type SlideNote } from "@/lib/pptxNotes";

type UploadType = "video" | "ppt" | "pdf" | "uploaded_document";

interface UploadOption {
  id: UploadType;
  label: string;
  icon: typeof Video;
  accept: string;
  description: string;
}

const uploadOptions: UploadOption[] = [
  {
    id: "video",
    label: "Video",
    icon: Video,
    accept: "video/mp4,video/webm,video/quicktime",
    description: "MP4, WebM, MOV"
  },
  {
    id: "ppt",
    label: "Presentation",
    icon: Presentation,
    accept: ".pptx,.ppt",
    description: "PowerPoint files"
  },
  {
    id: "pdf",
    label: "PDF",
    icon: FileText,
    accept: ".pdf",
    description: "PDF documents"
  },
  {
    id: "uploaded_document",
    label: "Document",
    icon: File,
    accept: ".doc,.docx,.txt,.rtf",
    description: "Word, TXT, RTF"
  }
];

export default function ModuleUploader() {
  const navigate = useNavigate();
  const { saveModuleAsync, isSaving } = useSaveModule();
  
  const [uploadType, setUploadType] = useState<UploadType>("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [narrationProvider, setNarrationProvider] = useState<"elevenlabs" | "ai4bharat">("elevenlabs");
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState<string>("EXAVITQu4vr4xnSDxMaL"); // Sarah
  const [voiceDescription, setVoiceDescription] = useState(
    "A clear female Indian English speaker with a neutral pace and natural intonation, recorded in a quiet studio."
  );
  const [narrationProgress, setNarrationProgress] = useState<string>("");
  
  // File size limit (100 MB)
  const MAX_FILE_SIZE_MB = 100;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  
  // Quiz attachment state
  const [includeQuiz, setIncludeQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);

  const currentOption = uploadOptions.find(o => o.id === uploadType)!;

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      
      const validation = validateFile(droppedFile, getModuleFileContext(uploadType));
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }
      
      setFile(droppedFile);
      if (!title) {
        setTitle(droppedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  }, [title, MAX_FILE_SIZE_BYTES]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      const validation = validateFile(selectedFile, getModuleFileContext(uploadType));
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }
      
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUpload = async (status: "draft" | "pending_review" = "draft") => {
    if (!file || !title.trim()) {
      toast.error("Please select a file and enter a title");
      return;
    }

    // Validate quiz if enabled
    if (includeQuiz && quizQuestions.length === 0) {
      toast.error("Please add at least one quiz question or disable the quiz");
      return;
    }

    if (includeQuiz) {
      const invalidQuestions = quizQuestions.filter(q => !q.question.trim());
      if (invalidQuestions.length > 0) {
        toast.error("All quiz questions must have question text");
        return;
      }
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("module-files")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("module-files")
        .getPublicUrl(fileName);

      // Extract speaker notes for PPTX so we can pre-generate narration
      let slideNotes: SlideNote[] = [];
      let slideCount = 0;
      if (uploadType === "ppt") {
        try {
          slideCount = await getPptxSlideCount(file);
          slideNotes = await extractPptxSpeakerNotes(file);
          if (file.name.toLowerCase().endsWith(".ppt")) {
            toast.message("Speaker-notes narration requires .pptx; uploading without narration.");
          }
        } catch (e) {
          console.error("Failed to read speaker notes:", e);
        }
      }

      // Build slides data with optional quiz
      const slidesData: any = { 
        type: uploadType, 
        fileUrl: publicUrl, 
        fileName: file.name 
      };
      if (uploadType === "ppt") {
        slidesData.slideCount = slideCount;
        slidesData.hasNarration = slideNotes.length > 0;
        // Persist notes + narration settings so creators can regenerate later
        if (slideNotes.length > 0) {
          slidesData.speakerNotes = slideNotes;
          slidesData.narrationProvider = narrationProvider;
          slidesData.narrationVoiceId = narrationProvider === "elevenlabs" ? elevenLabsVoiceId : undefined;
          slidesData.narrationVoiceDescription = narrationProvider === "ai4bharat" ? voiceDescription : undefined;
        }
      }
      
      if (includeQuiz && quizQuestions.length > 0) {
        slidesData.quiz = quizQuestions;
      }

      // Map UI type to database-valid type
      const dbModuleType = uploadType === "uploaded_document" ? "document" : uploadType;

      // Save module with file URL and optional quiz
      const { id: newModuleId } = await saveModuleAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        slides: slidesData,
        moduleType: dbModuleType,
        tagIds: selectedTags.length > 0 ? selectedTags : undefined,
        visibility: "private",
        approvalStatus: status,
      });

      // Narration is handled entirely by the convert-ppt-to-video pipeline
      // (speaker notes → edge-tts, or LLM-generated narration for note-less
      // decks). No separate pre-generation step is needed here.

      // Auto-kick the narrated-video render (slides → narration → ffmpeg MP4).
      // Fire-and-forget: the module viewer shows live progress and plays the
      // finished MP4. We don't await here so the upload finishes promptly.
      // Every uploaded deck becomes a narrated video: speaker notes drive the
      // narration when present, otherwise the pipeline narrates each slide's text.
      const willGenerateVideo = !!newModuleId && uploadType === "ppt";
      if (willGenerateVideo) {
        setNarrationProgress("Starting video…");
        void supabase.functions
          .invoke("convert-ppt-to-video", { body: { moduleId: newModuleId } })
          .then(({ error: fnError }) => {
            if (fnError) console.error("convert-ppt-to-video kick-off failed:", fnError);
          })
          .catch((e) => console.error("convert-ppt-to-video kick-off failed:", e));
      }

      if (willGenerateVideo) {
        toast.success("Module saved! Generating your narrated video…");
      } else if (status === "pending_review") {
        toast.success("Module saved and sent for expert review!");
      } else {
        toast.success("Module saved as draft!");
      }
      // Land on the module so the creator can watch video generation; fall back
      // to the library if we somehow don't have an id.
      navigate(newModuleId ? `/library/${newModuleId}` : "/library");

    } catch (error: any) {
      toast.error(error.message || "Failed to upload module");
    } finally {
      setUploading(false);
    }
  };

  const isLoading = uploading || isSaving;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Upload Your Content</h2>
        <p className="text-muted-foreground">
          Upload existing learning materials and optionally attach an assessment quiz
        </p>
      </div>

      {/* Content Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Content Type</CardTitle>
          <CardDescription>Select the type of content you're uploading</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={uploadType}
            onValueChange={(v) => {
              setUploadType(v as UploadType);
              setFile(null);
            }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {uploadOptions.map((option) => (
              <Label
                key={option.id}
                htmlFor={option.id}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  uploadType === option.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value={option.id} id={option.id} className="sr-only" />
                <option.icon className={`h-8 w-8 mb-2 ${uploadType === option.id ? "text-primary" : "text-muted-foreground"}`} />
                <span className="font-medium text-sm">{option.label}</span>
                <span className="text-xs text-muted-foreground mt-1">{option.description}</span>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload File</CardTitle>
          <CardDescription>Drag and drop or click to select a file</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
              dragActive
                ? "border-primary bg-primary/5"
                : file
                ? "border-green-500 bg-green-500/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <input
              type="file"
              accept={currentOption.accept}
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Check className="h-6 w-6 text-green-500" />
                </div>
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                <Button variant="outline" size="sm" onClick={() => setFile(null)}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">Drop your file here</p>
                <p className="text-sm text-muted-foreground">
                  or click to browse ({currentOption.description}) - Max {MAX_FILE_SIZE_MB}MB
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Module Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Module Details</CardTitle>
          <CardDescription>Add information about your content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter module title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what learners will gain from this content"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagSelector
              selectedTagIds={selectedTags}
              onTagsChange={setSelectedTags}
            />
          </div>
        </CardContent>
      </Card>

      {/* Narration Settings (PPT only) */}
      {uploadType === "ppt" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Narration (from speaker notes)</CardTitle>
            <CardDescription>
              We'll read the speaker notes embedded in your .pptx aloud. Notes are never shown to learners.
              .ppt (legacy) files are uploaded without narration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Voice provider</Label>
              <RadioGroup
                value={narrationProvider}
                onValueChange={(v) => setNarrationProvider(v as "elevenlabs" | "ai4bharat")}
                className="grid grid-cols-2 gap-3"
              >
                <Label
                  htmlFor="prov-elevenlabs"
                  className={`flex flex-col p-3 rounded-md border-2 cursor-pointer transition-all ${
                    narrationProvider === "elevenlabs" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value="elevenlabs" id="prov-elevenlabs" className="sr-only" />
                  <span className="font-medium text-sm">ElevenLabs (recommended)</span>
                  <span className="text-xs text-muted-foreground mt-1">Studio-quality voices, fast.</span>
                </Label>
                <Label
                  htmlFor="prov-ai4bharat"
                  className={`flex flex-col p-3 rounded-md border-2 cursor-pointer transition-all ${
                    narrationProvider === "ai4bharat" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value="ai4bharat" id="prov-ai4bharat" className="sr-only" />
                  <span className="font-medium text-sm">AI4Bharat (backup)</span>
                  <span className="text-xs text-muted-foreground mt-1">Indic Parler-TTS, 20 Indian languages.</span>
                </Label>
              </RadioGroup>
            </div>

            {narrationProvider === "elevenlabs" ? (
              <div className="space-y-2">
                <Label htmlFor="elevenVoice">ElevenLabs voice</Label>
                <select
                  id="elevenVoice"
                  value={elevenLabsVoiceId}
                  onChange={(e) => setElevenLabsVoiceId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="EXAVITQu4vr4xnSDxMaL">Sarah — warm female</option>
                  <option value="cgSgspJ2msm6clMCkdW9">Jessica — friendly female</option>
                  <option value="XrExE9yKIg1WjnnlVkGX">Matilda — calm female</option>
                  <option value="JBFqnCBsd6RMkjVDRZzb">George — mature male</option>
                  <option value="onwK4e9ZLuTAKqWW03F9">Daniel — narrator male</option>
                  <option value="CwhRBWXzGAHq8TQ4Fs17">Roger — confident male</option>
                  <option value="IKne3meq5aSn9XLyUdCD">Charlie — energetic male</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Multilingual ElevenLabs model. Billed against your ElevenLabs credits.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="voiceDescription">Narrator voice description</Label>
                <Textarea
                  id="voiceDescription"
                  value={voiceDescription}
                  onChange={(e) => setVoiceDescription(e.target.value)}
                  rows={2}
                  placeholder='e.g. "A warm male speaker with a clear Hindi accent, calm pace."'
                />
                <p className="text-xs text-muted-foreground">
                  Plain-English voice prompt. Parler-TTS supports 20 Indic languages.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Optional Quiz Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileQuestion className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Assessment Quiz</CardTitle>
                <CardDescription>Attach a quiz to test learner understanding</CardDescription>
              </div>
            </div>
            <Switch
              checked={includeQuiz}
              onCheckedChange={setIncludeQuiz}
            />
          </div>
        </CardHeader>
        {includeQuiz && (
          <CardContent>
            <QuizBuilderCore
              questions={quizQuestions}
              onQuestionsChange={setQuizQuestions}
              disabled={isLoading}
            />
          </CardContent>
        )}
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => navigate("/library")} disabled={isLoading}>
          Cancel
        </Button>
        <Button 
          variant="outline" 
          onClick={() => handleUpload("draft")} 
          disabled={isLoading || !file || !title.trim()}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save as Draft
        </Button>
        <Button 
          onClick={() => handleUpload("pending_review")} 
          disabled={isLoading || !file || !title.trim()}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {narrationProgress || "Uploading..."}
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Save & Send for Review
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
