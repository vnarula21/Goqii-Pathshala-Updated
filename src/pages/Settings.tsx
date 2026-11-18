import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  useAISettings, 
  AIProvider, 
  QuizAIProvider, 
  NarrationAIProvider,
  providers, 
  providerModels, 
  quizProviders, 
  quizProviderModels,
  narrationProviders,
  narrationProviderModels,
} from "@/hooks/useAISettings";
import { useAuth } from "@/hooks/useAuth";
import { useCustomAIProviders } from "@/hooks/useCustomAIProviders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Loader2, Shield, Sparkles, Key, ExternalLink, Check, X, Eye, EyeOff, 
  User, Lock, Plug, Settings as SettingsIcon, AlertTriangle, Circle, 
  ChevronDown, Brain, Lightbulb, BarChart3, PlusCircle, Mic
} from "lucide-react";
import { cn } from "@/lib/utils";
import AIUsageStats from "@/components/AIUsageStats";
import CustomAIProviderManager from "@/components/CustomAIProviderManager";
import { useUserRole } from "@/hooks/useUserRole";

export default function Settings() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { settings, loading, saveSettings, testConnection, isAdmin } = useAISettings();
  const { providers: customProviders, getProvidersForType } = useCustomAIProviders();
  const { isSME } = useUserRole();

  // Content & Image AI state
  const [aiMode, setAiMode] = useState<"lovable" | "own">("lovable");
  const [provider, setProvider] = useState<AIProvider>("google");
  const [model, setModel] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  // Quiz AI state
  const [quizAiMode, setQuizAiMode] = useState<"lovable" | "own">("lovable");
  const [quizProvider, setQuizProvider] = useState<QuizAIProvider>("mistral");
  const [quizModel, setQuizModel] = useState<string>("");
  const [quizApiKeyInput, setQuizApiKeyInput] = useState("");
  const [showQuizApiKey, setShowQuizApiKey] = useState(false);

  // Narration AI state
  const [narrationAiMode, setNarrationAiMode] = useState<"lovable" | "own">("lovable");
  const [narrationProvider, setNarrationProvider] = useState<NarrationAIProvider>("elevenlabs");
  const [narrationModel, setNarrationModel] = useState<string>("");
  const [narrationApiKeyInput, setNarrationApiKeyInput] = useState("");
  const [showNarrationApiKey, setShowNarrationApiKey] = useState(false);

  // UI state
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingQuiz, setIsTestingQuiz] = useState(false);
  const [isTestingNarration, setIsTestingNarration] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [quizTestResult, setQuizTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [narrationTestResult, setNarrationTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(["content"]);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (settings && isInitialLoad.current) {
      setAiMode(settings.aiMode);
      setProvider(settings.provider);
      setModel(settings.model || providerModels[settings.provider]?.[0]?.id || "");
      setQuizAiMode(settings.quizAiMode);
      setQuizProvider(settings.quizAiProvider);
      setQuizModel(settings.quizAiModel || quizProviderModels[settings.quizAiProvider]?.[0]?.id || "");
      setNarrationAiMode(settings.narrationAiMode);
      setNarrationProvider(settings.narrationAiProvider);
      setNarrationModel(settings.narrationAiModel || narrationProviderModels[settings.narrationAiProvider]?.[0]?.id || "");
      isInitialLoad.current = false;
    }
  }, [settings]);

  // Update model when provider changes
  useEffect(() => {
    if (!isInitialLoad.current) {
      const defaultModel = providerModels[provider]?.[0]?.id || "";
      setModel(defaultModel);
      setApiKeyInput("");
      setTestResult(null);
    }
  }, [provider]);

  useEffect(() => {
    if (!isInitialLoad.current) {
      const defaultModel = quizProviderModels[quizProvider]?.[0]?.id || "";
      setQuizModel(defaultModel);
      setQuizApiKeyInput("");
      setQuizTestResult(null);
    }
  }, [quizProvider]);

  useEffect(() => {
    if (!isInitialLoad.current) {
      const defaultModel = narrationProviderModels[narrationProvider]?.[0]?.id || "";
      setNarrationModel(defaultModel);
      setNarrationApiKeyInput("");
      setNarrationTestResult(null);
    }
  }, [narrationProvider]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const handleTestConnection = async () => {
    if (!apiKeyInput.trim()) {
      toast.error("Please enter an API key first");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const result = await testConnection(provider, apiKeyInput);
    setTestResult(result);

    if (result.success) {
      toast.success("Connection successful!");
    } else {
      toast.error(result.message);
    }

    setIsTesting(false);
  };

  const handleTestQuizConnection = async () => {
    if (!quizApiKeyInput.trim()) {
      toast.error("Please enter an API key first");
      return;
    }

    setIsTestingQuiz(true);
    setQuizTestResult(null);

    const result = await testConnection(quizProvider, quizApiKeyInput);
    setQuizTestResult(result);

    if (result.success) {
      toast.success("Quiz AI connection successful!");
    } else {
      toast.error(result.message);
    }

    setIsTestingQuiz(false);
  };

  const handleTestNarrationConnection = async () => {
    if (!narrationApiKeyInput.trim()) {
      toast.error("Please enter an API key first");
      return;
    }

    setIsTestingNarration(true);
    setNarrationTestResult(null);

    const result = await testConnection(narrationProvider, narrationApiKeyInput);
    setNarrationTestResult(result);

    if (result.success) {
      toast.success("Narration AI connection successful!");
    } else {
      toast.error(result.message);
    }

    setIsTestingNarration(false);
  };

  const handleSaveConfiguration = async () => {
    if (!isAdmin) {
      toast.error("Only admins can modify AI settings");
      return;
    }

    if (aiMode === "own" && !apiKeyInput.trim()) {
      toast.error("Please enter an API key for Content AI");
      return;
    }

    if (quizAiMode === "own" && !quizApiKeyInput.trim()) {
      toast.error("Please enter an API key for Quiz AI");
      return;
    }

    if (narrationAiMode === "own" && !narrationApiKeyInput.trim()) {
      toast.error("Please enter an API key for Narration AI");
      return;
    }

    setIsSaving(true);

    try {
      // Save AI settings
      await saveSettings({ 
        aiMode, 
        provider,
        model: model || null,
        quizAiMode,
        quizAiProvider: quizProvider,
        quizAiModel: quizModel || null,
        narrationAiMode,
        narrationAiProvider: narrationProvider,
        narrationAiModel: narrationModel || null,
      });

      // Save API keys to api_key_vault table
      if (aiMode === "own" && apiKeyInput.trim()) {
        const { data: existingKey } = await supabase
          .from('api_key_vault')
          .select('id')
          .eq('provider', provider)
          .maybeSingle();

        if (existingKey) {
          await supabase
            .from('api_key_vault')
            .update({ 
              api_key_encrypted: apiKeyInput,
              updated_at: new Date().toISOString()
            })
            .eq('provider', provider);
        } else {
          await supabase
            .from('api_key_vault')
            .insert({
              provider: provider,
              secret_name: `${provider.toUpperCase()}_API_KEY`,
              api_key_encrypted: apiKeyInput,
            });
        }
      }

      if (quizAiMode === "own" && quizApiKeyInput.trim()) {
        const { data: existingQuizKey } = await supabase
          .from('api_key_vault')
          .select('id')
          .eq('provider', quizProvider)
          .maybeSingle();

        if (existingQuizKey) {
          await supabase
            .from('api_key_vault')
            .update({ 
              api_key_encrypted: quizApiKeyInput,
              updated_at: new Date().toISOString()
            })
            .eq('provider', quizProvider);
        } else {
          await supabase
            .from('api_key_vault')
            .insert({
              provider: quizProvider,
              secret_name: `${quizProvider.toUpperCase()}_API_KEY`,
              api_key_encrypted: quizApiKeyInput,
            });
        }
      }

      // Save narration API key
      if (narrationAiMode === "own" && narrationApiKeyInput.trim()) {
        const { data: existingNarrationKey } = await supabase
          .from('api_key_vault')
          .select('id')
          .eq('provider', narrationProvider)
          .maybeSingle();

        if (existingNarrationKey) {
          await supabase
            .from('api_key_vault')
            .update({ 
              api_key_encrypted: narrationApiKeyInput,
              updated_at: new Date().toISOString()
            })
            .eq('provider', narrationProvider);
        } else {
          await supabase
            .from('api_key_vault')
            .insert({
              provider: narrationProvider,
              secret_name: `${narrationProvider.toUpperCase()}_API_KEY`,
              api_key_encrypted: narrationApiKeyInput,
            });
        }
      }

      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error('Failed to save configuration:', error);
      toast.error("Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedProvider = providers.find(p => p.id === provider);
  const availableModels = providerModels[provider] || [];
  const selectedQuizProvider = quizProviders.find(p => p.id === quizProvider);
  const availableQuizModels = quizProviderModels[quizProvider] || [];
  const selectedNarrationProvider = narrationProviders.find(p => p.id === narrationProvider);
  const availableNarrationModels = narrationProviderModels[narrationProvider] || [];

  if (authLoading || loading) {
    return (
      <AppSidebar>
        <div className="min-h-screen bg-background">
          <div className="flex items-center justify-center h-[calc(100vh-64px)]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </AppSidebar>
    );
  }

  return (
    <AppSidebar>
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
        </div>

        {!isAdmin ? (
          <ProfileCard user={user} />
        ) : (
        <Tabs defaultValue="integrations" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2">
              <Plug className="h-4 w-4" />
              <span className="hidden sm:inline">Integrations</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <ProfileCard user={user} />
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage your security preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Password and security settings are managed through your authentication provider.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations Tab - AI Configuration */}
          <TabsContent value="integrations">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle>AI Provider Configuration</CardTitle>
                </div>
                <CardDescription>
                  Configure AI providers for content generation and quiz creation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isAdmin && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                    <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Only administrators can modify AI settings. Contact your admin to change the provider.
                    </p>
                  </div>
                )}

                {/* Content & Image AI Section */}
                <Collapsible 
                  open={openSections.includes('content')} 
                  onOpenChange={() => toggleSection('content')}
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg bg-gradient-to-r from-violet-500/10 to-purple-500/10 border hover:bg-violet-500/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-violet-500/20 rounded-lg">
                        <Brain className="h-5 w-5 text-violet-600" />
                      </div>
                      <div className="text-left">
                        <span className="font-semibold">Content & Image AI</span>
                        <p className="text-xs text-muted-foreground">Module content generation and images</p>
                      </div>
                    </div>
                    <ChevronDown className={cn(
                      "h-5 w-5 transition-transform",
                      openSections.includes('content') && "rotate-180"
                    )} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <RadioGroup 
                      value={aiMode} 
                      onValueChange={(v) => isAdmin && setAiMode(v as "lovable" | "own")}
                      className="space-y-3"
                    >
                      {/* Lovable AI Option */}
                      <div className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-colors ${
                        aiMode === "lovable" ? "border-primary bg-primary/5" : "border-border"
                      } ${!isAdmin ? "opacity-70" : "hover:bg-muted/50 cursor-pointer"}`}>
                        <RadioGroupItem value="lovable" id="ai-lovable" className="mt-1" disabled={!isAdmin} />
                        <div className="flex-1">
                          <Label htmlFor="ai-lovable" className={`text-base font-medium ${isAdmin ? "cursor-pointer" : ""}`}>
                            Lovable AI
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-2">Recommended</span>
                          </Label>
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2">
                              <Check className="h-3 w-3 text-green-500" />
                              No API key needed
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="h-3 w-3 text-green-500" />
                              Pre-configured and ready to use
                            </li>
                          </ul>
                        </div>
                      </div>

                      {/* Own AI Account Option */}
                      <div className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-colors ${
                        aiMode === "own" ? "border-primary bg-primary/5" : "border-border"
                      } ${!isAdmin ? "opacity-70" : "hover:bg-muted/50 cursor-pointer"}`}>
                        <RadioGroupItem value="own" id="ai-own" className="mt-1" disabled={!isAdmin} />
                        <div className="flex-1">
                          <Label htmlFor="ai-own" className={`text-base font-medium ${isAdmin ? "cursor-pointer" : ""}`}>
                            Own AI Account
                            <span className="text-xs text-muted-foreground ml-2">(Google AI, OpenAI, or Perplexity)</span>
                          </Label>
                        </div>
                      </div>
                    </RadioGroup>

                    {/* Own AI Configuration Panel */}
                    {aiMode === "own" && isAdmin && (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                        {/* Provider Selection */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Provider</Label>
                            <Select value={provider} onValueChange={(v) => setProvider(v as AIProvider)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {providers.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Model Selection */}
                          <div className="space-y-2">
                            <Label>Model</Label>
                            <Select value={model} onValueChange={setModel}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a model" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableModels.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* API Key Input */}
                        <div className="space-y-2">
                          <Label htmlFor="apiKey">API Key</Label>
                          <div className="relative">
                            <Input
                              id="apiKey"
                              type={showApiKey ? "text" : "password"}
                              placeholder={`Enter your ${selectedProvider?.name} API key`}
                              value={apiKeyInput}
                              onChange={(e) => {
                                setApiKeyInput(e.target.value);
                                setTestResult(null);
                              }}
                              className="pr-12"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                              onClick={() => setShowApiKey(!showApiKey)}
                            >
                              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        {/* Get API Key Link */}
                        {selectedProvider && (
                          <a
                            href={selectedProvider.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            <Key className="h-4 w-4" />
                            Get your {selectedProvider.name} API key
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}

                        {/* Test Result */}
                        {testResult && (
                          <div className={`flex items-center gap-2 p-3 rounded-lg ${
                            testResult.success ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'
                          }`}>
                            {testResult.success ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            <span className="text-sm">{testResult.message}</span>
                          </div>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTestConnection}
                          disabled={isTesting || !apiKeyInput.trim()}
                        >
                          {isTesting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            "Test Connection"
                          )}
                        </Button>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                {/* Quiz AI Section */}
                <Collapsible 
                  open={openSections.includes('quiz')} 
                  onOpenChange={() => toggleSection('quiz')}
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border hover:bg-amber-500/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/20 rounded-lg">
                        <Lightbulb className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="text-left">
                        <span className="font-semibold">Quiz AI</span>
                        <p className="text-xs text-muted-foreground">Quiz generation from content summaries</p>
                      </div>
                    </div>
                    <ChevronDown className={cn(
                      "h-5 w-5 transition-transform",
                      openSections.includes('quiz') && "rotate-180"
                    )} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <RadioGroup 
                      value={quizAiMode} 
                      onValueChange={(v) => isAdmin && setQuizAiMode(v as "lovable" | "own")}
                      className="space-y-3"
                    >
                      {/* Lovable AI Option */}
                      <div className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-colors ${
                        quizAiMode === "lovable" ? "border-primary bg-primary/5" : "border-border"
                      } ${!isAdmin ? "opacity-70" : "hover:bg-muted/50 cursor-pointer"}`}>
                        <RadioGroupItem value="lovable" id="quiz-lovable" className="mt-1" disabled={!isAdmin} />
                        <div className="flex-1">
                          <Label htmlFor="quiz-lovable" className={`text-base font-medium ${isAdmin ? "cursor-pointer" : ""}`}>
                            Lovable AI
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-2">Recommended</span>
                          </Label>
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2">
                              <Check className="h-3 w-3 text-green-500" />
                              No API key needed
                            </li>
                          </ul>
                        </div>
                      </div>

                      {/* Own AI Account Option */}
                      <div className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-colors ${
                        quizAiMode === "own" ? "border-primary bg-primary/5" : "border-border"
                      } ${!isAdmin ? "opacity-70" : "hover:bg-muted/50 cursor-pointer"}`}>
                        <RadioGroupItem value="own" id="quiz-own" className="mt-1" disabled={!isAdmin} />
                        <div className="flex-1">
                          <Label htmlFor="quiz-own" className={`text-base font-medium ${isAdmin ? "cursor-pointer" : ""}`}>
                            Own AI Account
                            <span className="text-xs text-muted-foreground ml-2">(Mistral, OpenAI, or Claude)</span>
                          </Label>
                        </div>
                      </div>
                    </RadioGroup>

                    {/* Own Quiz AI Configuration Panel */}
                    {quizAiMode === "own" && isAdmin && (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                        {/* Provider Selection */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Provider</Label>
                            <Select value={quizProvider} onValueChange={(v) => setQuizProvider(v as QuizAIProvider)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {quizProviders.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Model Selection */}
                          <div className="space-y-2">
                            <Label>Model</Label>
                            <Select value={quizModel} onValueChange={setQuizModel}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a model" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableQuizModels.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* API Key Input */}
                        <div className="space-y-2">
                          <Label htmlFor="quizApiKey">API Key</Label>
                          <div className="relative">
                            <Input
                              id="quizApiKey"
                              type={showQuizApiKey ? "text" : "password"}
                              placeholder={`Enter your ${selectedQuizProvider?.name} API key`}
                              value={quizApiKeyInput}
                              onChange={(e) => {
                                setQuizApiKeyInput(e.target.value);
                                setQuizTestResult(null);
                              }}
                              className="pr-12"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                              onClick={() => setShowQuizApiKey(!showQuizApiKey)}
                            >
                              {showQuizApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        {/* Get API Key Link */}
                        {selectedQuizProvider && (
                          <a
                            href={selectedQuizProvider.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            <Key className="h-4 w-4" />
                            Get your {selectedQuizProvider.name} API key
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}

                        {/* Test Result */}
                        {quizTestResult && (
                          <div className={`flex items-center gap-2 p-3 rounded-lg ${
                            quizTestResult.success ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'
                          }`}>
                            {quizTestResult.success ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            <span className="text-sm">{quizTestResult.message}</span>
                          </div>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTestQuizConnection}
                          disabled={isTestingQuiz || !quizApiKeyInput.trim()}
                        >
                          {isTestingQuiz ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            "Test Connection"
                          )}
                        </Button>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                {/* Narration AI Section */}
                <Collapsible 
                  open={openSections.includes('narration')} 
                  onOpenChange={() => toggleSection('narration')}
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border hover:bg-teal-500/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-teal-500/20 rounded-lg">
                        <Mic className="h-5 w-5 text-teal-600" />
                      </div>
                      <div className="text-left">
                        <span className="font-semibold">Narration AI</span>
                        <p className="text-xs text-muted-foreground">Text-to-speech for interactive PPT slides</p>
                      </div>
                    </div>
                    <ChevronDown className={cn(
                      "h-5 w-5 transition-transform",
                      openSections.includes('narration') && "rotate-180"
                    )} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <RadioGroup 
                      value={narrationAiMode} 
                      onValueChange={(v) => isAdmin && setNarrationAiMode(v as "lovable" | "own")}
                      className="space-y-3"
                    >
                      <div className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-colors ${
                        narrationAiMode === "lovable" ? "border-primary bg-primary/5" : "border-border"
                      } ${!isAdmin ? "opacity-70" : "hover:bg-muted/50 cursor-pointer"}`}>
                        <RadioGroupItem value="lovable" id="narration-lovable" className="mt-1" disabled={!isAdmin} />
                        <div className="flex-1">
                          <Label htmlFor="narration-lovable" className={`text-base font-medium ${isAdmin ? "cursor-pointer" : ""}`}>
                            Lovable AI (ElevenLabs)
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-2">Default</span>
                          </Label>
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2">
                              <Check className="h-3 w-3 text-green-500" />
                              Uses platform ElevenLabs key
                            </li>
                          </ul>
                        </div>
                      </div>

                      <div className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-colors ${
                        narrationAiMode === "own" ? "border-primary bg-primary/5" : "border-border"
                      } ${!isAdmin ? "opacity-70" : "hover:bg-muted/50 cursor-pointer"}`}>
                        <RadioGroupItem value="own" id="narration-own" className="mt-1" disabled={!isAdmin} />
                        <div className="flex-1">
                          <Label htmlFor="narration-own" className={`text-base font-medium ${isAdmin ? "cursor-pointer" : ""}`}>
                            Own TTS Account
                            <span className="text-xs text-muted-foreground ml-2">(ElevenLabs, Google TTS, or OpenAI TTS)</span>
                          </Label>
                        </div>
                      </div>
                    </RadioGroup>

                    {narrationAiMode === "own" && isAdmin && (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Provider</Label>
                            <Select value={narrationProvider} onValueChange={(v) => setNarrationProvider(v as NarrationAIProvider)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {narrationProviders.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    <div>
                                      <span>{p.name}</span>
                                      <span className="text-xs text-muted-foreground ml-2">— {p.description}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>{narrationProvider === 'google_tts' ? 'Voice' : 'Model'}</Label>
                            <Select value={narrationModel} onValueChange={setNarrationModel}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableNarrationModels.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="narrationApiKey">API Key</Label>
                          <div className="relative">
                            <Input
                              id="narrationApiKey"
                              type={showNarrationApiKey ? "text" : "password"}
                              placeholder={`Enter your ${selectedNarrationProvider?.name} API key`}
                              value={narrationApiKeyInput}
                              onChange={(e) => {
                                setNarrationApiKeyInput(e.target.value);
                                setNarrationTestResult(null);
                              }}
                              className="pr-12"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                              onClick={() => setShowNarrationApiKey(!showNarrationApiKey)}
                            >
                              {showNarrationApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        {selectedNarrationProvider && (
                          <a
                            href={selectedNarrationProvider.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            <Key className="h-4 w-4" />
                            Get your {selectedNarrationProvider.name} API key
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}

                        {narrationTestResult && (
                          <div className={`flex items-center gap-2 p-3 rounded-lg ${
                            narrationTestResult.success ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'
                          }`}>
                            {narrationTestResult.success ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            <span className="text-sm">{narrationTestResult.message}</span>
                          </div>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTestNarrationConnection}
                          disabled={isTestingNarration || !narrationApiKeyInput.trim()}
                        >
                          {isTestingNarration ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            "Test Connection"
                          )}
                        </Button>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                {/* Billing Warning */}
                {(aiMode === "own" || quizAiMode === "own" || narrationAiMode === "own") && isAdmin && (
                  <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700">
                      <strong>Usage & Billing:</strong> All API calls will be charged to your configured AI accounts.
                    </p>
                  </div>
                )}

                {/* Save Button */}
                {isAdmin && (
                  <div className="pt-4 border-t">
                    <Button
                      onClick={handleSaveConfiguration}
                      disabled={isSaving}
                      className="w-full"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Configuration"
                      )}
                    </Button>
                  </div>
                )}

                {/* Current Status Indicator */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                      <span className="text-sm text-muted-foreground">
                        Content AI: {settings?.aiMode === 'lovable' ? 'Lovable AI' : `${providers.find(p => p.id === settings?.provider)?.name || 'Own AI'}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Circle className="h-2 w-2 fill-amber-500 text-amber-500" />
                      <span className="text-sm text-muted-foreground">
                        Quiz AI: {settings?.quizAiMode === 'lovable' ? 'Lovable AI' : `${quizProviders.find(p => p.id === settings?.quizAiProvider)?.name || 'Own AI'}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Circle className="h-2 w-2 fill-teal-500 text-teal-500" />
                      <span className="text-sm text-muted-foreground">
                        Narration AI: {settings?.narrationAiMode === 'lovable' ? 'Lovable AI (ElevenLabs)' : `${narrationProviders.find(p => p.id === settings?.narrationAiProvider)?.name || 'Own TTS'}`}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Usage Statistics */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <CardTitle>AI Usage Statistics</CardTitle>
                </div>
                <CardDescription>
                  Track your AI API usage and estimated costs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AIUsageStats />
              </CardContent>
            </Card>

            {/* Custom AI Providers */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-primary" />
                  <CardTitle>Custom AI Providers</CardTitle>
                </div>
                <CardDescription>
                  Add your own AI providers for content or quiz generation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CustomAIProviderManager />
              </CardContent>
            </Card>

            {/* Temporary: TTS Test Link */}
            {(isAdmin || isSME) && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Mic className="h-5 w-5 text-primary" />
                    <CardTitle>TTS Service Test</CardTitle>
                  </div>
                  <CardDescription>
                    Validate the AI4Bharat narration service before enabling automatic PPT narration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link to="/tts-test">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open TTS Test Page
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
                <CardDescription>Manage your account preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Account management features coming soon.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        )}
        </main>
      </div>
    </AppSidebar>
  );
}

function ProfileCard({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const original = (user?.user_metadata?.full_name as string | undefined) || "";
  const [name, setName] = useState(original);
  const [saving, setSaving] = useState(false);

  useEffect(() => setName(original), [original]);

  const trimmed = name.trim();
  const dirty = trimmed !== original.trim() && trimmed.length > 0;

  const save = async () => {
    if (!user || !dirty) return;
    setSaving(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: trimmed })
        .eq("id", user.id);
      if (profileError) throw profileError;
      const { error: authError } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
      if (authError) throw authError;
      toast.success("Name updated");
    } catch (e) {
      toast.error("Could not update name: " + (e instanceof Error ? e.message : "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>You can change your name. Other details are managed by your administrator.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Name</Label>
          <Input id="profile-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email || ""} disabled className="bg-muted" />
        </div>
        <Button onClick={save} disabled={!dirty || saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save name
        </Button>
      </CardContent>
    </Card>
  );
}
