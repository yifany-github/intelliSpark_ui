import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Character } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRolePlay } from '@/contexts/RolePlayContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import GlobalLayout from '@/components/layout/GlobalLayout';
import CharacterCreationSuccess from '@/components/character-creation/CharacterCreationSuccess';
import CategorySelector from '@/components/characters/CategorySelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Toggle } from '@/components/ui/toggle';
import { X, Loader2 } from 'lucide-react';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

enum CreationStep {
  FORM = 'form',
  SUCCESS = 'success'
}

interface CharacterFormData {
  name: string;              // ✅ Character name
  description: string;       // ✅ Short public description
  personaPrompt: string;     // ✅ LLM persona/backstory prompt
  traits: string[];          // ✅ Dynamic trait badges
  avatar: string | null;     // ✅ Avatar upload
  category: string;          // ✅ Primary category (backwards compatibility)
  categories: string[];      // ✅ Multiple category tags
  gender: string;            // ✅ Gender dropdown
  isPublic: boolean;         // ✅ Make Public switch
  isNsfw: boolean;           // ✅ NSFW Content switch (binary)
  // Note: voiceStyle and conversationStyle are not form fields, set as defaults in API call
}

const ImprovedCreateCharacterPage = () => {
  const { user, isAuthenticated } = useAuth();
  const { setSelectedCharacter, startChat } = useRolePlay();
  const { navigateToLogin, navigateToPath } = useNavigation();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState<CreationStep>(CreationStep.FORM);
  const [createdCharacter, setCreatedCharacter] = useState<Character | null>(null);
  const [formData, setFormData] = useState<CharacterFormData>({
    name: '',
    description: '',
    personaPrompt: '',
    traits: [],
    avatar: '/assets/characters_img/Elara.jpeg',
    category: 'original',
    categories: [], // 新增：多分类标签
    gender: 'female',
    isPublic: true,
    isNsfw: false
  });


  // Save character mutation
  const saveCharacterMutation = useMutation({
    mutationFn: async (characterData: CharacterFormData) => {
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }

      const response = await apiRequest("POST", "/api/characters", {
        name: characterData.name,
        description: characterData.description, // Public description for cards/lists
        avatarUrl: characterData.avatar,
        // LLM persona/backstory: prefer explicit personaPrompt, fallback to empty
        personaPrompt: characterData.personaPrompt || '',
        // Fallback: if personaPrompt is empty, mirror description into backstory for better LLM behavior
        backstory: characterData.personaPrompt || characterData.description || '',
        voiceStyle: "casual", // Default voice style since not in form
        traits: characterData.traits,
        category: characterData.category,
        categories: characterData.categories,
        gender: characterData.gender,
        conversationStyle: "detailed", // Default conversation style since not in form
        isPublic: characterData.isPublic,
        nsfwLevel: characterData.isNsfw ? 1 : 0,
        age: characterData.isNsfw ? 18 : undefined,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create character: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (character) => {
      setCreatedCharacter(character);
      setCurrentStep(CreationStep.SUCCESS);
      
      toast({
        title: t('characterCreatedSuccessfully'),
        description: `${character.name} ${t('characterSavedAvailable')}`
      });
      
      // Invalidate queries to refresh character lists
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
    },
    onError: (error: Error) => {
      toast({
        title: t('failedToCreateCharacter'),
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Handle form submission
  const handleCreateCharacter = async (characterData: CharacterFormData) => {
    if (!isAuthenticated) {
      toast({
        title: t('authenticationRequired'),
        description: t('pleaseLoginToCreate'),
        variant: 'destructive'
      });
      navigateToLogin(); // Redirect to login if needed
      return;
    }

    saveCharacterMutation.mutate(characterData);
  };

  // Success page actions
  const handleStartChat = async () => {
    if (createdCharacter) {
      try {
        const chatId = await startChat(createdCharacter);
        navigateToPath(`/chat/${chatId}`);
      } catch (error) {
        toast({
          title: t('failedToStartChat'),
          description: t('pleaseRetry'),
          variant: 'destructive'
        });
      }
    }
  };

  const handleViewCharacter = () => {
    navigateToPath('/characters');
  };

  const handleCreateAnother = () => {
    setCurrentStep(CreationStep.FORM);
    setCreatedCharacter(null);
    setFormData({
      name: '',
      description: '',
      personaPrompt: '',
      traits: [],
      avatar: '/assets/characters_img/Elara.jpeg',
      category: 'original',
      categories: [], // 重置多分类标签
      gender: 'female',
      isPublic: true,
      isNsfw: false
    });
  };

  const handleGoToCharacters = () => {
    navigateToPath('/characters');
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case CreationStep.FORM:
        return (
          <div className="w-full">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-3">{t('createYourCharacter')}</h1>
              <p className="text-muted-foreground text-lg">{t('fillDetailsCharacterLife')}</p>
            </div>
            <CharacterCreationForm
              initialData={formData}
              onSubmit={handleCreateCharacter}
              onCancel={() => navigateToPath('/characters')}
              isLoading={saveCharacterMutation.isPending}
            />
          </div>
        );
      
      case CreationStep.SUCCESS:
        return createdCharacter ? (
          <CharacterCreationSuccess
            character={createdCharacter}
            onStartChat={handleStartChat}
            onViewCharacter={handleViewCharacter}
            onCreateAnother={handleCreateAnother}
            onGoToCharacters={handleGoToCharacters}
          />
        ) : null;
      
      default:
        return null;
    }
  };

  return (
    <GlobalLayout>
      <div className="w-full h-full overflow-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          {renderCurrentStep()}
        </div>
      </div>
    </GlobalLayout>
  );
};

// Character Creation Form Component
const CharacterCreationForm = ({ initialData, onSubmit, onCancel, isLoading }: {
  initialData: CharacterFormData;
  onSubmit: (data: CharacterFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<CharacterFormData>(initialData);
  const [newTrait, setNewTrait] = useState("");

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    if (!file) return;
    
    // Client-side validation
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: t('fileTooLarge'),
        description: t('selectSmallerImage'),
        variant: 'destructive'
      });
      return;
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: t('invalidFileType'),
        description: t('chooseValidImageFormat'),
        variant: 'destructive'
      });
      return;
    }
    
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      
      const response = await apiRequest('POST', '/api/characters/upload-avatar', uploadFormData);
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.avatarUrl) {
        throw new Error('No avatar URL returned from server');
      }
      
      setFormData(prev => ({ ...prev, avatar: result.avatarUrl }));
      
      toast({
        title: t('uploadedSuccessfully'),
        description: t('characterImageSaved')
      });
    } catch (error) {
      // Reset file input on error to prevent confusion
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Avatar upload failed:', errorMessage);
      
      toast({
        title: t('uploadFailed'),
        description: t('tryDifferentImage'),
        variant: 'destructive'
      });
      
      // Don't update avatar URL on error - keep the previous value
      // This ensures character creation will use the last successful upload or default
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const addTrait = () => {
    if (newTrait.trim()) {
      setFormData({
        ...formData,
        traits: [...formData.traits, newTrait.trim()],
      });
      setNewTrait("");
    }
  };

  const removeTrait = (index: number) => {
    setFormData({
      ...formData,
      traits: formData.traits.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="bg-card/50 rounded-lg p-6 space-y-6">
          <h3 className="text-xl font-semibold border-b border-border pb-3">{t('basicInfo')}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">{t('characterName')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('enterCharacterName')}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('gender')}</Label>
              <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectGender')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">{t('female')}</SelectItem>
                  <SelectItem value="male">{t('male')}</SelectItem>
                  <SelectItem value="non-binary">{t('nonBinary')}</SelectItem>
                  <SelectItem value="other">{t('other')}</SelectItem>
                  <SelectItem value="not-specified">{t('preferNotToSay')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">{t('characterDescription') || 'Description'}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('characterDescriptionPlaceholder') || 'Brief public description shown on cards and lists'}
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t('characterDescriptionHelp') || 'A short summary for discovery and previews.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="personaPrompt" className="text-sm font-medium">Persona Prompt (LLM)</Label>
            <Textarea
              id="personaPrompt"
              value={formData.personaPrompt}
              onChange={(e) => setFormData({ ...formData, personaPrompt: e.target.value })}
              placeholder={'Optional: Define how the AI should behave as this character. If empty, only the description is used.'}
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              This drives the AI’s behavior and backstory. You can leave it blank for a lightweight persona.
            </p>
          </div>
        </div>

        {/* Character Avatar */}
        <div className="bg-card/50 rounded-lg p-6 space-y-6">
          <h3 className="text-xl font-semibold border-b border-border pb-3">{t('characterAvatar')}</h3>
          
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
              <img
                src={(formData.avatar && (formData.avatar.startsWith('http') ? formData.avatar : `${API_BASE_URL}${formData.avatar}`)) || `${API_BASE_URL}/assets/characters_img/Elara.jpeg`}
                alt={t('characterAvatar')}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `${API_BASE_URL}/assets/characters_img/Elara.jpeg`;
                }}
              />
            </div>
            <div className="flex-1 space-y-3">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImageUpload(file);
                  }
                }}
                style={{ display: 'none' }}
              />
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (fileInputRef.current) {
                      fileInputRef.current.click();
                    }
                  }}
                >
{t('chooseAvatarImage')}
                </Button>
                {formData.avatar && formData.avatar !== '/assets/characters_img/Elara.jpeg' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormData({ ...formData, avatar: '/assets/characters_img/Elara.jpeg' })}
                  >
{t('resetToDefault')}
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {t('uploadImageOrDefault')}
              </p>
            </div>
          </div>
        </div>

        {/* Character Traits */}
        <div className="bg-card/50 rounded-lg p-6 space-y-6">
          <h3 className="text-xl font-semibold border-b border-border pb-3">{t('characterTraits')}</h3>
          
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('addCharacterTraits')}</Label>
            <div className="flex gap-2">
              <Input
                value={newTrait}
                onChange={(e) => setNewTrait(e.target.value)}
                placeholder={t('addTraitPlaceholder')}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTrait())}
              />
              <Button type="button" onClick={addTrait}>{t('add')}</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.traits.map((trait, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {trait}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => removeTrait(index)}
                  />
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('addTraitsHelp')}
            </p>
          </div>
        </div>

        {/* Character Categories */}
        <div className="bg-card/50 rounded-lg p-6 space-y-6">
          <h3 className="text-xl font-semibold border-b border-border pb-3">角色分类</h3>
          
          <CategorySelector
            selectedCategories={formData.categories}
            onCategoriesChange={(categories) => {
              setFormData({ 
                ...formData, 
                categories,
                // 同时更新单个category字段以保持向后兼容
                category: categories.length > 0 ? categories[0] : 'original'
              });
            }}
            maxSelections={5}
          />
        </div>

        {/* Character Settings */}
        <div className="bg-card/50 rounded-lg p-6 space-y-6">
          <h3 className="text-xl font-semibold border-b border-border pb-3">{t('characterSettings')}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <Label className="text-sm font-medium">{t('makePublic')}</Label>
                <p className="text-xs text-muted-foreground">{t('allowOthersDiscover')}</p>
              </div>
              <Switch
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
              />
            </div>

            <div className="p-4 rounded-lg border">
              <div className="mb-3">
                <Label className="text-sm font-medium">{t('nsfwContent')}</Label>
                <p className="text-xs text-muted-foreground">{t('enableMatureContent')}</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Toggle
                  pressed={!formData.isNsfw}
                  onPressedChange={() => setFormData({ ...formData, isNsfw: false })}
                  className={`w-full rounded-md px-4 py-2 text-sm border transition-all flex items-center
                    ${!formData.isNsfw
                      ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300 shadow-md shadow-emerald-200'
                      : 'bg-white text-slate-900 border-slate-300 hover:bg-emerald-50'}
                  `}
                >
                  SAFE — Family-friendly prompt
                </Toggle>
                <Toggle
                  pressed={formData.isNsfw}
                  onPressedChange={() => setFormData({ ...formData, isNsfw: true })}
                  className={`w-full rounded-md px-4 py-2 text-sm border transition-all flex items-center
                    ${formData.isNsfw
                      ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white border-rose-700 ring-2 ring-rose-300 shadow-md shadow-rose-200'
                      : 'bg-white text-slate-900 border-slate-300 hover:bg-rose-50'}
                  `}
                >
                  NSFW — Adult-oriented prompt
                </Toggle>
              </div>
            </div>
          </div>
        </div>



        {/* Form Actions */}
        <div className="flex justify-between items-center pt-6 border-t border-border">
          <Button type="button" variant="outline" onClick={onCancel} size="lg">
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={isLoading} size="lg" className="min-w-[200px]">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? t('creatingCharacter') : t('createCharacter')}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ImprovedCreateCharacterPage;
