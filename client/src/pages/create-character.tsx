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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { X } from 'lucide-react';

enum CreationStep {
  FORM = 'form',
  SUCCESS = 'success'
}

interface CharacterFormData {
  name: string;              // ✅ Form field: Character Name input
  backstory: string;         // ✅ Form field: Character Description textarea
  traits: string[];          // ✅ Form field: Dynamic trait badges
  avatar: string | null;     // ✅ Form field: Avatar upload
  category: string;          // ✅ Form field: Category dropdown
  gender: string;            // ✅ Form field: Gender dropdown
  isPublic: boolean;         // ✅ Form field: Make Public switch
  isNsfw: boolean;          // ✅ Form field: NSFW Content switch
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
    backstory: '',
    traits: [],
    avatar: '/assets/characters_img/Elara.jpeg',
    category: 'original',
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
        description: characterData.backstory, // Use backstory as description
        avatarUrl: characterData.avatar,
        backstory: characterData.backstory,
        voiceStyle: "casual", // Default voice style since not in form
        traits: characterData.traits,
        category: characterData.category,
        gender: characterData.gender,
        conversationStyle: "detailed", // Default conversation style since not in form
        isPublic: characterData.isPublic,
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
      backstory: '',
      traits: [],
      avatar: '/assets/characters_img/Elara.jpeg',
      category: 'original',
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
            <Label htmlFor="backstory" className="text-sm font-medium">{t('characterDescription')}</Label>
            <Textarea
              id="backstory"
              value={formData.backstory}
              onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
              placeholder={t('characterDescriptionPlaceholder')}
              rows={5}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t('characterDescriptionHelp')}
            </p>
          </div>
        </div>

        {/* Character Avatar */}
        <div className="bg-card/50 rounded-lg p-6 space-y-6">
          <h3 className="text-xl font-semibold border-b border-border pb-3">{t('characterAvatar')}</h3>
          
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
              <img
                src={formData.avatar || '/assets/characters_img/Elara.jpeg'}
                alt={t('characterAvatar')}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/assets/characters_img/Elara.jpeg';
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

        {/* Character Settings */}
        <div className="bg-card/50 rounded-lg p-6 space-y-6">
          <h3 className="text-xl font-semibold border-b border-border pb-3">{t('characterSettings')}</h3>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('category')}</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="original">{t('original')}</SelectItem>
                <SelectItem value="anime">{t('anime')}</SelectItem>
                <SelectItem value="game">{t('game')}</SelectItem>
                <SelectItem value="movie">{t('movie')}</SelectItem>
                <SelectItem value="book">{t('book')}</SelectItem>
                <SelectItem value="fantasy">{t('fantasy')}</SelectItem>
                <SelectItem value="sci-fi">{t('sciFi')}</SelectItem>
                <SelectItem value="romance">{t('romance')}</SelectItem>
                <SelectItem value="action">{t('action')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <Label className="text-sm font-medium">{t('nsfwContent')}</Label>
                <p className="text-xs text-muted-foreground">{t('enableMatureContent')}</p>
              </div>
              <Switch
                checked={formData.isNsfw}
                onCheckedChange={(checked) => setFormData({ ...formData, isNsfw: checked })}
              />
            </div>
          </div>
        </div>



        {/* Form Actions */}
        <div className="flex justify-between items-center pt-6 border-t border-border">
          <Button type="button" variant="outline" onClick={onCancel} size="lg">
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={isLoading} size="lg" className="min-w-[200px]">
            {isLoading ? t('creatingCharacter') : t('createCharacter')}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ImprovedCreateCharacterPage;