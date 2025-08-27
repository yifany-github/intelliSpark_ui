import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bot, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface AvailableModel {
  value: string;
  name: string;
  description: string;
  is_available: boolean;
  is_default: boolean;
}

interface AvailableModelsResponse {
  models: AvailableModel[];
  user_preferred: string;
}

interface UserPreferences {
  preferred_ai_model: string;
  memory_enabled: boolean;
  user_id: number;
  username: string;
}

const AIModelSelector = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedModel, setSelectedModel] = useState<string>("");

  // Fetch available models
  const { data: availableModels, isLoading: isLoadingModels, error: modelsError } = useQuery<AvailableModelsResponse>({
    queryKey: ["/api/preferences/available-models"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/preferences/available-models");
      return await response.json();
    },
    retry: 1,
  });

  // Fetch current user preferences
  const { data: userPreferences, isLoading: isLoadingPrefs, error: prefsError } = useQuery<UserPreferences>({
    queryKey: ["/api/preferences"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/preferences");
      return await response.json();
    },
    retry: 1,
  });

  // Set AI model preference
  const setModelMutation = useMutation({
    mutationFn: async (model: string) => {
      const response = await apiRequest("POST", "/api/preferences/ai-model", { model });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `AI model set to ${data.model_name}`,
      });
      // Refresh preferences
      queryClient.invalidateQueries({ queryKey: ["/api/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/preferences/available-models"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set AI model preference",
        variant: "destructive",
      });
    },
  });

  // Update selected model when data loads
  useEffect(() => {
    if (userPreferences?.preferred_ai_model) {
      setSelectedModel(userPreferences.preferred_ai_model);
    } else if (availableModels?.user_preferred) {
      setSelectedModel(availableModels.user_preferred);
    }
  }, [userPreferences, availableModels]);

  const handleModelChange = (newModel: string) => {
    setSelectedModel(newModel);
    setModelMutation.mutate(newModel);
  };

  const getModelIcon = (model: AvailableModel) => {
    if (!model.is_available) {
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    }
    if (selectedModel === model.value) {
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    }
    return <Bot className="w-4 h-4 text-blue-400" />;
  };

  const getModelBadge = (model: AvailableModel) => {
    if (model.is_default) {
      return <Badge variant="secondary" className="text-xs">Default</Badge>;
    }
    if (!model.is_available) {
      return <Badge variant="destructive" className="text-xs">Unavailable</Badge>;
    }
    return null;
  };

  if (isLoadingModels || isLoadingPrefs) {
    return (
      <Card className="bg-gray-800 border-gray-700 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Bot className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-lg text-white">AI Model</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          <span className="ml-2 text-gray-400">Loading models...</span>
        </div>
      </Card>
    );
  }

  // Show error state if there are errors
  if (modelsError || prefsError) {
    return (
      <Card className="bg-gray-800 border-gray-700 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Bot className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-lg text-white">AI Model Selection</h3>
        </div>
        <div className="text-center py-8">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 font-medium">Failed to load AI models</p>
          <p className="text-gray-400 text-sm mt-1">
            {modelsError?.message || prefsError?.message || "Please check your connection and try refreshing the page"}
          </p>
          <Button 
            onClick={() => {
              window.location.reload();
            }}
            className="mt-4"
            variant="outline"
          >
            Refresh Page
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800 border-gray-700 p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Bot className="w-5 h-5 text-blue-400" />
        <h3 className="font-semibold text-lg text-white">AI Model Selection</h3>
      </div>
      
      <div className="space-y-4">
        <p className="text-sm text-gray-400">
          Choose your preferred AI model for character conversations. Different models have unique personalities and conversation styles.
        </p>
        
        {availableModels?.models && availableModels.models.length > 0 ? (
          <RadioGroup 
            value={selectedModel} 
            onValueChange={handleModelChange}
            className="space-y-3"
          >
            {availableModels.models.map((model) => (
              <div 
                key={model.value} 
                className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                  model.is_available 
                    ? "border-gray-600 hover:border-gray-500 cursor-pointer" 
                    : "border-gray-700 opacity-60 cursor-not-allowed"
                } ${selectedModel === model.value ? "border-blue-500 bg-blue-500/10" : ""}`}
                onClick={() => {
                  if (model.is_available && !setModelMutation.isPending) {
                    handleModelChange(model.value);
                  }
                }}
              >
                <RadioGroupItem 
                  value={model.value} 
                  id={model.value}
                  disabled={!model.is_available || setModelMutation.isPending}
                  className="text-blue-400 pointer-events-none"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    {getModelIcon(model)}
                    <Label 
                      htmlFor={model.value} 
                      className={`font-medium cursor-pointer select-none ${
                        model.is_available ? "text-white" : "text-gray-500"
                      }`}
                    >
                      {model.name}
                    </Label>
                    {getModelBadge(model)}
                  </div>
                  <p className={`text-xs select-none ${model.is_available ? "text-gray-400" : "text-gray-600"}`}>
                    {model.description}
                  </p>
                </div>
                {setModelMutation.isPending && selectedModel === model.value && (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                )}
              </div>
            ))}
          </RadioGroup>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-gray-400">No AI models available at the moment</p>
          </div>
        )}
        
        {selectedModel && (
          <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
            <p className="text-sm text-gray-300">
              <span className="font-medium">Current selection:</span>{" "}
              {availableModels?.models.find(m => m.value === selectedModel)?.name || selectedModel}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default AIModelSelector;