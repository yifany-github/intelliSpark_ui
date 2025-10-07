import { useEffect, useMemo, useRef, useState } from 'react';
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
import CharacterPreviewModal from '@/components/characters/CharacterPreviewModal';
import CharacterCreationWizard, { CharacterCreationStep } from '@/components/character-creation/CharacterCreationWizard';
import CategorySelector from '@/components/characters/CategorySelector';
import DefaultAvatarGrid from '@/components/characters/DefaultAvatarGrid';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Toggle } from '@/components/ui/toggle';
import { X, Loader2 } from 'lucide-react';

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
  const { setSelectedCharacter, startChat, favorites, toggleFavorite } = useRolePlay();
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
    avatar: null,
    category: 'original',
    categories: [],
    gender: 'female',
    isPublic: true,
    isNsfw: false
  });
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const wizardSteps = useMemo(() => ([
    {
      id: 1,
      title: t('basicInfo'),
      description: t('essentialDetails'),
    },
    {
      id: 2,
      title: t('characterAvatar'),
      description: t('uploadImageOrDefault'),
    },
    {
      id: 3,
      title: t('characterTraits'),
      description: t('addTraitsHelp'),
    },
    {
      id: 4,
      title: t('characterSettings'),
      description: t('configureSharing'),
    },
  ]), [t]);


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
      await startChatWithCharacter(createdCharacter);
    }
  };

  const startChatWithCharacter = async (character: Character) => {
    try {
      const chatId = await startChat(character);
      if (chatId) {
        navigateToPath(`/chat/${chatId}`);
      }
    } catch (error) {
      toast({
        title: t('failedToStartChat'),
        description: t('pleaseRetry'),
        variant: 'destructive'
      });
    }
  };

  const handleViewCharacter = () => {
    setIsPreviewOpen(true);
  };

  const handleCreateAnother = () => {
    setCurrentStep(CreationStep.FORM);
    setCreatedCharacter(null);
    setWizardStep(1);
    setFormData({
      name: '',
      description: '',
      personaPrompt: '',
      traits: [],
      avatar: null,
      category: 'original',
      categories: [],
      gender: 'female',
      isPublic: true,
      isNsfw: false
    });
  };

  const handleGoToCharacters = () => {
    setIsPreviewOpen(false);
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
              step={wizardStep}
              onStepChange={setWizardStep}
              steps={wizardSteps}
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
            onToggleFavorite={toggleFavorite}
            isFavorite={favorites?.some((fav) => fav.id === createdCharacter.id) ?? false}
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
          {createdCharacter && (
            <CharacterPreviewModal
              character={createdCharacter}
              isOpen={isPreviewOpen}
              onClose={() => setIsPreviewOpen(false)}
              onStartChat={async (character) => {
                setIsPreviewOpen(false);
                await startChatWithCharacter(character);
              }}
              onToggleFavorite={toggleFavorite}
              isFavorite={favorites?.some((fav) => fav.id === createdCharacter.id) ?? false}
            />
          )}
        </div>
      </div>
    </GlobalLayout>
  );
};

// Character Creation Form Component
const CharacterCreationForm = ({ initialData, onSubmit, onCancel, isLoading, step, onStepChange, steps }: {
  initialData: CharacterFormData;
  onSubmit: (data: CharacterFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
  step: number;
  onStepChange: (step: number) => void;
  steps: CharacterCreationStep[];
}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<CharacterFormData>(initialData);
  const [newTrait, setNewTrait] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [descriptionTouched, setDescriptionTouched] = useState(false);

  const nameError = formData.name.trim().length === 0
    ? t('characterNameRequired')
    : formData.name.trim().length < 2
      ? t('characterNameMinLength')
      : null;

  const descriptionError = formData.description.trim().length === 0
    ? t('characterDescriptionRequired')
    : formData.description.trim().length < 10
      ? t('characterDescriptionMinLength')
      : null;

  useEffect(() => {
    setFormData(initialData);
    setNameTouched(false);
    setDescriptionTouched(false);
  }, [initialData]);

  const nextStep = () => {
    if (step < steps.length) {
      onStepChange(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      onStepChange(step - 1);
    }
  };

  const goToStep = (targetStep: number) => {
    onStepChange(targetStep);
  };

  const validateStep = (current: number) => {
    switch (current) {
      case 1:
        return !nameError && !descriptionError;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (step === steps.length) {
      onSubmit(formData);
    } else if (validateStep(step)) {
      nextStep();
    } else {
      let errorMessage = t('error');
      if (step === 1) {
        setNameTouched(true);
        setDescriptionTouched(true);
        errorMessage = nameError ?? descriptionError;
      }
      toast({
        title: t('error'),
        description: errorMessage ?? t('characterNameRequired'),
        variant: 'destructive'
      });
    }
  };

  const handlePrev = () => {
    prevStep();
  };

  const handleGoToStep = (target: number) => {
    if (target <= step || validateStep(step)) {
      goToStep(target);
    } else {
      if (step === 1) {
        setNameTouched(true);
        setDescriptionTouched(true);
      }
    }
  };

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
    handleNext();
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
      <CharacterCreationWizard
        steps={steps}
        currentStep={step}
        onNextStep={handleNext}
        onPrevStep={handlePrev}
        onGoToStep={handleGoToStep}
        canProceed={validateStep(step)}
        isSubmitting={isLoading}
        showNavigation={false}
      >
        <form onSubmit={handleSubmit} className="space-y-8">
          {step === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">{t('characterName')}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      setNameTouched(true);
                    }}
                    onBlur={() => setNameTouched(true)}
                    placeholder={t('enterCharacterName')}
                    required
                  />
                  {nameTouched && nameError && (
                    <p className="text-xs text-rose-500">{nameError}</p>
                  )}
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
                <Label htmlFor="description" className="text-sm font-medium">{t('characterDescription')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                    setDescriptionTouched(true);
                  }}
                  onBlur={() => setDescriptionTouched(true)}
                  placeholder={t('characterDescriptionPlaceholder')}
                  rows={4}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t('characterDescriptionHelp')}
                </p>
                {descriptionTouched && descriptionError && (
                  <p className="text-xs text-rose-500">{descriptionError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="personaPrompt" className="text-sm font-medium">{t('personaPrompt')}</Label>
                <Textarea
                  id="personaPrompt"
                  value={formData.personaPrompt}
                  onChange={(e) => {
                    setFormData({ ...formData, personaPrompt: e.target.value });
                    setDescriptionTouched(true);
                  }}
                  onBlur={() => setDescriptionTouched(true)}
                  placeholder={t('personaPromptPlaceholder')}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  {t('personaPromptHelp')}
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {/* Avatar Preview */}
              <div className="flex items-center gap-4">
                <ImageWithFallback
                  src={formData.avatar || undefined}
                  alt={t('characterAvatar')}
                  fallbackText={formData.name || '?'}
                  size="xl"
                  className="bg-slate-100"
                />
                <div className="flex-1">
                  <h3 className="text-lg font-medium">{t('selectedAvatar') || 'Selected Avatar'}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formData.avatar
                      ? (t('customAvatarSelected') || 'Custom avatar or default selected')
                      : (t('noAvatarSelected') || 'No avatar selected yet')}
                  </p>
                </div>
              </div>

              {/* Hidden file input for custom upload */}
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

              {/* Default Avatar Grid */}
              <div>
                <Label className="text-sm font-medium mb-3 block">
                  {t('chooseDefaultOrUpload') || 'Choose a default avatar or upload your own'}
                </Label>
                <DefaultAvatarGrid
                  selectedAvatarUrl={formData.avatar}
                  onAvatarSelect={(url) => setFormData({ ...formData, avatar: url })}
                  onUploadClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.click();
                    }
                  }}
                  filterGender={formData.gender}
                  filterNsfwLevel={formData.isNsfw ? 1 : 0}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
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

              <div>
                <Label className="text-sm font-medium">{t('selectCategory')}</Label>
                <CategorySelector
                  selectedCategories={formData.categories}
                  onCategoriesChange={(categories) => {
                    setFormData({
                      ...formData,
                      categories,
                      category: categories.length > 0 ? categories[0] : 'original'
                    });
                  }}
                  maxSelections={5}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
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
          )}

          <div className="flex justify-end items-center gap-4 pt-6 border-t border-border">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrev}
                disabled={isLoading}
                size="lg"
              >
                {t('stepBack')}
              </Button>
            )}
            <Button
              type="submit"
              disabled={isLoading}
              size="lg"
              className="min-w-[200px] bg-brand-secondary text-zinc-900 hover:bg-brand-secondary/90"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {step === steps.length ? t('createCharacter') : t('stepNext')}
            </Button>
          </div>
        </form>
      </CharacterCreationWizard>
      <div className="mt-4 flex justify-start">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" disabled={isLoading}>
              {t('cancel')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('cancelCharacterCreation')}</AlertDialogTitle>
              <AlertDialogDescription>{t('cancelCharacterCreationDescription')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80">
                {t('keepEditing')}
              </AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onCancel}>
                {t('confirmCancel')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default ImprovedCreateCharacterPage;
