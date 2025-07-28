import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Character } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRolePlay } from '@/context/RolePlayContext';
import { useToast } from '@/hooks/use-toast';
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

      // Create mock character for demo
      const mockCharacter: Character = {
        id: Date.now(),
        name: characterData.name,
        description: characterData.description,
        backstory: characterData.backstory,
        voiceStyle: characterData.voiceStyle,
        traits: characterData.traits,
        personalityTraits: characterData.personalityTraits,
        avatarUrl: characterData.avatar || 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop',
        createdAt: new Date().toISOString()
      };

      // In real app, this would call the API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

      return mockCharacter;
    },
    onSuccess: (character) => {
      setCreatedCharacter(character);
      setCurrentStep(CreationStep.SUCCESS);
      
      toast({
        title: 'Character created successfully!',
        description: `${character.name} has been created and is ready for conversations.`
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