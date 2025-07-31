import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Character } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRolePlay } from '@/context/RolePlayContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import GlobalLayout from '@/components/layout/GlobalLayout';
import CharacterTemplates from '@/components/character-creation/CharacterTemplates';
import CharacterCreationSuccess from '@/components/character-creation/CharacterCreationSuccess';

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
    avatar: null,
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
      avatar: null,
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
        // Import and use the original form component
        const CreateCharacterForm = require('./create-character').default;
        return (
          <CreateCharacterForm
            initialData={formData}
            onSubmit={handleCreateCharacter}
            onCancel={() => setCurrentStep(CreationStep.TEMPLATE_SELECTION)}
            isLoading={saveCharacterMutation.isPending}
          />
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

export default ImprovedCreateCharacterPage;