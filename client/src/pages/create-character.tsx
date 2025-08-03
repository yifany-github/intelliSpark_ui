import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Character } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRolePlay } from '@/contexts/RolePlayContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import GlobalLayout from '@/components/layout/GlobalLayout';
import CharacterTemplates from '@/components/character-creation/CharacterTemplates';
import CharacterCreationSuccess from '@/components/character-creation/CharacterCreationSuccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

enum CreationStep {
  TEMPLATE_SELECTION = 'template',
  FORM = 'form',
  SUCCESS = 'success'
}

interface CharacterFormData {
  name: string;
  description: string;
  backstory: string;
  voiceStyle: string;
  traits: string[];
  personalityTraits: {
    friendliness: number;
    intelligence: number;
    humor: number;
    confidence: number;
    empathy: number;
    creativity: number;
  };
  avatar: string | null;
  category: string;
  isPublic: boolean;
  nsfwLevel: number;
  gender: string;
  age: string;
  occupation: string;
  hobbies: string[];
  catchphrase: string;
  conversationStyle: string;
}

const ImprovedCreateCharacterPage = () => {
  const [_, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { setSelectedCharacter } = useRolePlay();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    if (!file) return;
    
    // Client-side validation
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Please choose an image under 5MB',
        variant: 'destructive'
      });
      return;
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please choose a JPEG, PNG, WebP, or GIF image',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      
      const response = await apiRequest('POST', '/api/characters/upload-avatar', uploadFormData);
      const result = await response.json();
      
      setFormData(prev => ({ ...prev, avatar: result.avatarUrl }));
      
      toast({
        title: 'Image uploaded successfully',
        description: 'Your character image has been saved'
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Please try again with a different image',
        variant: 'destructive'
      });
    }
  };

  const [currentStep, setCurrentStep] = useState<CreationStep>(CreationStep.TEMPLATE_SELECTION);
  const [createdCharacter, setCreatedCharacter] = useState<Character | null>(null);
  const [formData, setFormData] = useState<CharacterFormData>({
    name: '',
    description: '',
    backstory: '',
    voiceStyle: 'Casual',
    traits: [],
    personalityTraits: {
      friendliness: 50,
      intelligence: 50,
      humor: 50,
      confidence: 50,
      empathy: 50,
      creativity: 50,
    },
    avatar: '/assets/characters_img/Elara.jpeg',
    category: 'Original',
    isPublic: true,
    nsfwLevel: 0,
    gender: '',
    age: '',
    occupation: '',
    hobbies: [],
    catchphrase: '',
    conversationStyle: 'Detailed responses'
  });

  // Handle template selection
  const handleTemplateSelect = (template: any) => {
    setFormData(prev => ({
      ...prev,
      voiceStyle: template.data.voiceStyle,
      traits: template.data.traits,
      personalityTraits: template.data.personalityTraits,
      backstory: template.data.backstory,
      occupation: template.data.occupation,
      conversationStyle: template.data.conversationStyle,
      category: template.category
    }));
    setCurrentStep(CreationStep.FORM);
  };

  // Skip template selection
  const handleSkipTemplate = () => {
    setCurrentStep(CreationStep.FORM);
  };

  // Save character mutation
  const saveCharacterMutation = useMutation({
    mutationFn: async (characterData: CharacterFormData) => {
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }

      const response = await apiRequest("POST", "/api/characters", {
        name: characterData.name,
        description: characterData.description,
        avatarUrl: characterData.avatar,
        backstory: characterData.backstory,
        voiceStyle: characterData.voiceStyle,
        traits: characterData.traits,
        personalityTraits: characterData.personalityTraits,
        category: characterData.category,
        gender: characterData.gender,
        age: characterData.age,
        occupation: characterData.occupation,
        hobbies: characterData.hobbies,
        catchphrase: characterData.catchphrase,
        conversationStyle: characterData.conversationStyle,
        isPublic: characterData.isPublic,
        nsfwLevel: characterData.nsfwLevel
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
        title: 'Character created successfully!',
        description: `${character.name} has been saved and is now available to all users.`
      });
      
      // Invalidate queries to refresh character lists
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create character',
        description: error.message,
        variant: 'destructive'
      });
      
      // Log error for debugging
      console.error('Character creation error:', error);
    }
  });

  // Handle form submission
  const handleCreateCharacter = async (characterData: CharacterFormData) => {
    if (!isAuthenticated) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to create a character',
        variant: 'destructive'
      });
      navigate('/login'); // Redirect to login if needed
      return;
    }

    saveCharacterMutation.mutate(characterData);
  };

  // Success page actions
  const handleStartChat = () => {
    if (createdCharacter) {
      setSelectedCharacter(createdCharacter);
      navigate('/chat');
    }
  };

  const handleViewCharacter = () => {
    navigate('/characters');
  };

  const handleCreateAnother = () => {
    setCurrentStep(CreationStep.TEMPLATE_SELECTION);
    setCreatedCharacter(null);
    setFormData({
      name: '',
      description: '',
      backstory: '',
      voiceStyle: 'Casual',
      traits: [],
      personalityTraits: {
        friendliness: 50,
        intelligence: 50,
        humor: 50,
        confidence: 50,
        empathy: 50,
        creativity: 50,
      },
      avatar: '/assets/characters_img/Elara.jpeg',
      category: 'Original',
      isPublic: true,
      nsfwLevel: 0,
      gender: '',
      age: '',
      occupation: '',
      hobbies: [],
      catchphrase: '',
      conversationStyle: 'Detailed responses'
    });
  };

  const handleGoToCharacters = () => {
    navigate('/characters');
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case CreationStep.TEMPLATE_SELECTION:
        return (
          <CharacterTemplates
            onSelectTemplate={handleTemplateSelect}
            onSkipTemplate={handleSkipTemplate}
          />
        );
      
      case CreationStep.FORM:
        return (
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Create Your Character</h2>
              <p className="text-muted-foreground">Fill in the details to bring your character to life</p>
            </div>
            <CharacterCreationForm
              initialData={formData}
              onSubmit={handleCreateCharacter}
              onCancel={() => setCurrentStep(CreationStep.TEMPLATE_SELECTION)}
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
  const [formData, setFormData] = useState<CharacterFormData>(initialData);
  const [newTrait, setNewTrait] = useState("");

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
    <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">Character Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter character name"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of your character..."
              rows={3}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Character Avatar</Label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
              <img
                src={formData.avatar || '/assets/characters_img/Elara.jpeg'}
                alt="Character avatar"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/assets/characters_img/Elara.jpeg';
                }}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImageUpload(file);
                  }
                }}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Upload an image or use the default avatar. Supported formats: JPG, PNG, GIF
              </p>
              {formData.avatar && formData.avatar !== '/assets/characters_img/Elara.jpeg' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData({ ...formData, avatar: '/assets/characters_img/Elara.jpeg' })}
                >
                  Reset to Default
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="backstory" className="text-sm font-medium">Backstory</Label>
          <Textarea
            id="backstory"
            value={formData.backstory}
            onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
            placeholder="Describe the character's background, history, and motivations..."
            rows={4}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="voiceStyle" className="text-sm font-medium">Voice Style</Label>
          <Textarea
            id="voiceStyle"
            value={formData.voiceStyle}
            onChange={(e) => setFormData({ ...formData, voiceStyle: e.target.value })}
            placeholder="Describe how the character speaks and their communication style..."
            rows={3}
            required
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Character Traits</Label>
          <div className="flex gap-2">
            <Input
              value={newTrait}
              onChange={(e) => setNewTrait(e.target.value)}
              placeholder="Add a trait..."
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTrait())}
            />
            <Button type="button" onClick={addTrait}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="gender" className="text-sm font-medium">Gender</Label>
            <Input
              id="gender"
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              placeholder="e.g., Male, Female, Non-binary"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age" className="text-sm font-medium">Age</Label>
            <Input
              id="age"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              placeholder="e.g., 25, Young Adult"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="occupation" className="text-sm font-medium">Occupation</Label>
          <Input
            id="occupation"
            value={formData.occupation}
            onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
            placeholder="What does your character do?"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="catchphrase" className="text-sm font-medium">Catchphrase</Label>
          <Input
            id="catchphrase"
            value={formData.catchphrase}
            onChange={(e) => setFormData({ ...formData, catchphrase: e.target.value })}
            placeholder="A memorable phrase your character might say"
          />
        </div>

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Back
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Character'}
          </Button>
        </div>
    </form>
  );
};

export default ImprovedCreateCharacterPage;