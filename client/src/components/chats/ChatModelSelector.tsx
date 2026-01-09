import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Bot, ChevronDown, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

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

const ChatModelSelector = () => {
  const { toast } = useToast();
  const [selectedModel, setSelectedModel] = useState<string>("");

  // Fetch available models
  const { data: availableModels, isLoading } = useQuery<AvailableModelsResponse>({
    queryKey: ["/api/preferences/available-models"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/preferences/available-models");
      return await response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
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
        title: "AI Model Updated",
        description: `Now using ${data.model_name} for new conversations`,
      });
      // Refresh preferences
      queryClient.invalidateQueries({ queryKey: ["/api/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/preferences/available-models"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to switch model",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Update selected model when data loads
  useEffect(() => {
    if (availableModels?.user_preferred) {
      setSelectedModel(availableModels.user_preferred);
    }
  }, [availableModels]);

  const handleModelChange = (newModel: string) => {
    if (newModel === selectedModel) return; // No change needed
    setSelectedModel(newModel);
    setModelMutation.mutate(newModel);
  };

  const getCurrentModel = () => {
    return availableModels?.models.find(m => m.value === selectedModel);
  };

  const getModelDisplayName = (model: AvailableModel) => {
    // Shorter names for the dropdown
    if (model.value === "gemini") return "Gemini";
    if (model.value === "grok") return "Grok";
    if (model.value === "openai") return "GPT-5 mini";
    return model.name;
  };

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled className="bg-gray-800 border-gray-700">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        <span className="text-xs">Loading...</span>
      </Button>
    );
  }

  if (!availableModels?.models || availableModels.models.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled className="bg-gray-800 border-gray-700">
        <AlertCircle className="w-3 h-3 mr-1 text-red-400" />
        <span className="text-xs">No Models</span>
      </Button>
    );
  }

  const currentModel = getCurrentModel();
  const availableCount = availableModels.models.filter(m => m.is_available).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="bg-gray-800 border-gray-700 hover:bg-gray-700 text-white"
          disabled={setModelMutation.isPending}
        >
          <Bot className="w-3 h-3 mr-1 text-blue-400" />
          <span className="text-xs">
            {setModelMutation.isPending ? "Switching..." : getModelDisplayName(currentModel || availableModels.models[0])}
          </span>
          {setModelMutation.isPending ? (
            <Loader2 className="w-3 h-3 ml-1 animate-spin" />
          ) : (
            <ChevronDown className="w-3 h-3 ml-1" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700 min-w-64">
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-gray-300">AI Model ({availableCount} available)</p>
          <p className="text-xs text-gray-500">Changes apply to new messages</p>
        </div>
        <DropdownMenuSeparator className="bg-gray-700" />
        {availableModels.models.map((model) => (
          <DropdownMenuItem
            key={model.value}
            onClick={() => handleModelChange(model.value)}
            disabled={!model.is_available || setModelMutation.isPending}
            className={`flex items-start space-x-2 p-2 cursor-pointer ${
              !model.is_available 
                ? "opacity-60 cursor-not-allowed" 
                : selectedModel === model.value
                ? "bg-gray-700"
                : "hover:bg-gray-700"
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {!model.is_available ? (
                <AlertCircle className="w-3 h-3 text-red-400" />
              ) : selectedModel === model.value ? (
                <CheckCircle className="w-3 h-3 text-green-400" />
              ) : (
                <Bot className="w-3 h-3 text-blue-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-1 mb-0.5">
                <span className={`text-sm font-medium ${
                  model.is_available ? "text-white" : "text-gray-500"
                }`}>
                  {model.name}
                </span>
                {model.is_default && (
                  <Badge variant="secondary" className="text-xs px-1 py-0">
                    Default
                  </Badge>
                )}
                {!model.is_available && (
                  <Badge variant="destructive" className="text-xs px-1 py-0">
                    Offline
                  </Badge>
                )}
              </div>
              <p className={`text-xs leading-tight ${
                model.is_available ? "text-gray-400" : "text-gray-600"
              }`}>
                {model.description.length > 60 
                  ? `${model.description.substring(0, 60)}...` 
                  : model.description
                }
              </p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ChatModelSelector;
