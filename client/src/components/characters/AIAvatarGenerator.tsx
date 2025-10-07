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
  const [style, setStyle] = useState<string>('realistic');
  const [generatedAvatars, setGeneratedAvatars] = useState<string[]>([]);

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
        setGeneratedAvatars(prev => [result.avatarUrl, ...prev]);
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
    <div className="space-y-4 p-4 border border-slate-700 rounded-lg bg-slate-800/50">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">
          {t('aiAvatarGenerator') || 'AI Avatar Generator'}
        </h3>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-2 p-3 bg-blue-950/30 border border-blue-800/50 rounded-md">
        <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-200">
          {t('aiGeneratorInfo') || 'Describe your character and our AI will generate a unique avatar. Generation takes 10-30 seconds.'}
        </p>
      </div>

      {/* Prompt Input */}
      <div className="space-y-2">
        <Label htmlFor="ai-prompt" className="text-sm font-medium text-slate-200">
          {t('characterDescription') || 'Character Description'}
        </Label>
        <Input
          id="ai-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('aiPromptPlaceholder') || 'e.g., elegant warrior with long silver hair, blue eyes, mystical aura'}
          className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
          disabled={isGenerating}
        />
        <p className="text-xs text-slate-400">
          {t('aiPromptHelp') || 'Describe appearance, clothing, mood, or special features'}
        </p>
      </div>

      {/* Style Selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-200">
          {t('artStyle') || 'Art Style'}
        </Label>
        <Select value={style} onValueChange={setStyle} disabled={isGenerating}>
          <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
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
      <p className="text-xs text-center text-slate-400">
        {t('rateLimitInfo') || 'Limit: 5 generations/min, 20/hour'}
      </p>

      {/* Generated Avatars History */}
      {generatedAvatars.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-700">
          <Label className="text-sm font-medium text-slate-200">
            {t('generatedAvatars') || 'Generated Avatars'}
          </Label>
          <div className="grid grid-cols-3 gap-3">
            {generatedAvatars.map((avatarUrl, index) => (
              <div key={index} className="relative group">
                <img
                  src={avatarUrl}
                  alt={`Generated avatar ${index + 1}`}
                  className="w-full h-auto aspect-square object-cover rounded-lg border-2 border-slate-700"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onAvatarGenerated(avatarUrl)}
                    className="bg-white/90 hover:bg-white text-slate-900 text-xs px-2 py-1"
                  >
                    {t('useThisAvatar') || 'Use'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAvatarGenerator;
