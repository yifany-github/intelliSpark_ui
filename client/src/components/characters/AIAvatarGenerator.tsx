import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AIAvatarGeneratorProps {
  characterName: string;
  characterGender: string;
  characterDescription?: string;
  onAvatarGenerated: (avatarUrl: string) => void;
}

const AIAvatarGenerator = ({
  characterName,
  characterGender,
  characterDescription,
  onAvatarGenerated
}: AIAvatarGeneratorProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState(characterDescription || '');
  const [style, setStyle] = useState<string>('fantasy');

  const styleOptions = [
    { value: 'fantasy', label: t('fantasyStyle') || 'Fantasy' },
    { value: 'realistic', label: t('realisticStyle') || 'Realistic' },
    { value: 'anime', label: t('animeStyle') || 'Anime' },
    { value: 'chinese', label: t('chineseStyle') || 'Traditional Chinese' },
    { value: 'scifi', label: t('scifiStyle') || 'Sci-Fi' },
    { value: 'medieval', label: t('medievalStyle') || 'Medieval' }
  ];

  const handleGenerate = async () => {
    if (!characterName || characterName.trim().length === 0) {
      toast({
        title: t('error'),
        description: t('pleaseEnterCharacterName') || 'Please enter a character name first',
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);

    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('character_name', characterName);
      formData.append('gender', characterGender || 'female');
      formData.append('style', style);

      const response = await apiRequest('POST', '/api/characters/generate-avatar', formData);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Generation failed');
      }

      const result = await response.json();

      if (result.avatarUrl) {
        onAvatarGenerated(result.avatarUrl);
        toast({
          title: t('success') || 'Success',
          description: t('avatarGeneratedSuccessfully') || 'Avatar generated successfully!'
        });
      } else {
        throw new Error('No avatar URL returned');
      }
    } catch (error) {
      console.error('Avatar generation error:', error);
      toast({
        title: t('generationFailed') || 'Generation Failed',
        description: error instanceof Error ? error.message : t('tryAgain') || 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border border-slate-200 rounded-lg bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-slate-900">
          {t('aiAvatarGenerator') || 'AI Avatar Generator'}
        </h3>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800">
          {t('aiGeneratorInfo') || 'Describe your character and our AI will generate a unique avatar. Generation takes 10-30 seconds.'}
        </p>
      </div>

      {/* Prompt Input */}
      <div className="space-y-2">
        <Label htmlFor="ai-prompt" className="text-sm font-medium">
          {t('characterDescription') || 'Character Description'}
        </Label>
        <Input
          id="ai-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('aiPromptPlaceholder') || 'e.g., elegant warrior with long silver hair, blue eyes, mystical aura'}
          className="bg-white"
          disabled={isGenerating}
        />
        <p className="text-xs text-muted-foreground">
          {t('aiPromptHelp') || 'Describe appearance, clothing, mood, or special features'}
        </p>
      </div>

      {/* Style Selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          {t('artStyle') || 'Art Style'}
        </Label>
        <Select value={style} onValueChange={setStyle} disabled={isGenerating}>
          <SelectTrigger className="bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {styleOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !characterName}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('generating') || 'Generating...'}
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            {t('generateAvatar') || 'Generate Avatar'}
          </>
        )}
      </Button>

      {/* Rate Limit Info */}
      <p className="text-xs text-center text-muted-foreground">
        {t('rateLimitInfo') || 'Limit: 5 generations/min, 20/hour'}
      </p>
    </div>
  );
};

export default AIAvatarGenerator;
