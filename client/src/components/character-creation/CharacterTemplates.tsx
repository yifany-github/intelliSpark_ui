import { useState } from 'react';
import { Wand2, User, Sparkles, Crown, Sword, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CharacterTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  category: string;
  data: {
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
    backstory: string;
    occupation: string;
    conversationStyle: string;
  };
}

const templates: CharacterTemplate[] = [
  {
    id: 'friendly-companion',
    name: 'Friendly Companion',
    description: 'A warm, supportive friend who loves to chat and help',
    icon: Heart,
    category: 'Social',
    data: {
      voiceStyle: 'Friendly',
      traits: ['Friendly', 'Caring', 'Optimistic', 'Empathetic'],
      personalityTraits: {
        friendliness: 90,
        intelligence: 70,
        humor: 75,
        confidence: 65,
        empathy: 95,
        creativity: 60
      },
      backstory: 'A compassionate individual who finds joy in connecting with others and offering support.',
      occupation: 'Life Coach',
      conversationStyle: 'Supportive and encouraging'
    }
  },
  {
    id: 'wise-mentor',
    name: 'Wise Mentor',
    description: 'An experienced guide with deep wisdom and knowledge',
    icon: Crown,
    category: 'Educational',
    data: {
      voiceStyle: 'Wise',
      traits: ['Wise', 'Intelligent', 'Patient', 'Thoughtful'],
      personalityTraits: {
        friendliness: 70,
        intelligence: 95,
        humor: 50,
        confidence: 85,
        empathy: 80,
        creativity: 75
      },
      backstory: 'A learned individual with years of experience, dedicated to sharing knowledge and guiding others.',
      occupation: 'Professor',
      conversationStyle: 'Thoughtful and educational'
    }
  },
  {
    id: 'playful-joker',
    name: 'Playful Joker',
    description: 'A fun-loving character who brings laughter and joy',
    icon: Sparkles,
    category: 'Entertainment',
    data: {
      voiceStyle: 'Playful',
      traits: ['Funny', 'Playful', 'Energetic', 'Creative'],
      personalityTraits: {
        friendliness: 85,
        intelligence: 65,
        humor: 95,
        confidence: 80,
        empathy: 60,
        creativity: 90
      },
      backstory: 'A naturally entertaining person who believes laughter is the best medicine.',
      occupation: 'Comedian',
      conversationStyle: 'Humorous and light-hearted'
    }
  },
  {
    id: 'mysterious-enigma',
    name: 'Mysterious Enigma',
    description: 'An intriguing character with secrets and depth',
    icon: User,
    category: 'Mystery',
    data: {
      voiceStyle: 'Mysterious',
      traits: ['Mysterious', 'Intelligent', 'Observant', 'Enigmatic'],
      personalityTraits: {
        friendliness: 50,
        intelligence: 90,
        humor: 40,
        confidence: 75,
        empathy: 65,
        creativity: 85
      },
      backstory: 'A complex individual with a hidden past and deep understanding of human nature.',
      occupation: 'Detective',
      conversationStyle: 'Intriguing and thought-provoking'
    }
  },
  {
    id: 'brave-hero',
    name: 'Brave Hero',
    description: 'A courageous character ready for adventure',
    icon: Sword,
    category: 'Adventure',
    data: {
      voiceStyle: 'Heroic',
      traits: ['Brave', 'Honorable', 'Strong', 'Loyal'],
      personalityTraits: {
        friendliness: 75,
        intelligence: 70,
        humor: 60,
        confidence: 95,
        empathy: 80,
        creativity: 55
      },
      backstory: 'A valiant warrior dedicated to protecting others and upholding justice.',
      occupation: 'Knight',
      conversationStyle: 'Inspiring and motivational'
    }
  },
  {
    id: 'creative-artist',
    name: 'Creative Artist',
    description: 'An imaginative soul with artistic flair',
    icon: Wand2,
    category: 'Creative',
    data: {
      voiceStyle: 'Creative',
      traits: ['Creative', 'Passionate', 'Sensitive', 'Artistic'],
      personalityTraits: {
        friendliness: 70,
        intelligence: 80,
        humor: 65,
        confidence: 60,
        empathy: 85,
        creativity: 95
      },
      backstory: 'A gifted artist who sees beauty in everything and expresses emotions through creative work.',
      occupation: 'Artist',
      conversationStyle: 'Expressive and imaginative'
    }
  }
];

interface CharacterTemplatesProps {
  onSelectTemplate: (template: CharacterTemplate) => void;
  onSkipTemplate: () => void;
}

export default function CharacterTemplates({ onSelectTemplate, onSkipTemplate }: CharacterTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<CharacterTemplate | null>(null);

  const categories = Array.from(new Set(templates.map(t => t.category)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Choose a Starting Template</h2>
        <p className="text-gray-400">
          Select a template to get started quickly, or skip to create from scratch
        </p>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedTemplate?.id === template.id
                ? 'ring-2 ring-blue-500 border-blue-500'
                : 'hover:border-gray-600'
            }`}
            onClick={() => setSelectedTemplate(template)}
          >
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <template.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <div className="text-xs text-blue-400 uppercase tracking-wider">
                    {template.category}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                {template.description}
              </CardDescription>
              
              {/* Traits Preview */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-white">Key Traits:</div>
                <div className="flex flex-wrap gap-1">
                  {template.data.traits.slice(0, 3).map((trait) => (
                    <span
                      key={trait}
                      className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
                    >
                      {trait}
                    </span>
                  ))}
                  {template.data.traits.length > 3 && (
                    <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                      +{template.data.traits.length - 3} more
                    </span>
                  )}
                </div>
              </div>
              
              {/* Personality Preview */}
              <div className="mt-4 space-y-2">
                <div className="text-sm font-medium text-white">Personality:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Friendliness:</span>
                    <span className="text-blue-400">{template.data.personalityTraits.friendliness}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Intelligence:</span>
                    <span className="text-blue-400">{template.data.personalityTraits.intelligence}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Humor:</span>
                    <span className="text-blue-400">{template.data.personalityTraits.humor}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Creativity:</span>
                    <span className="text-blue-400">{template.data.personalityTraits.creativity}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Selected Template Preview */}
      {selectedTemplate && (
        <Card className="border-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <selectedTemplate.icon className="w-5 h-5 text-blue-400" />
              <span>Selected: {selectedTemplate.name}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300 mb-4">{selectedTemplate.data.backstory}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-white">Voice Style:</span>
                <span className="ml-2 text-blue-400">{selectedTemplate.data.voiceStyle}</span>
              </div>
              <div>
                <span className="font-medium text-white">Occupation:</span>
                <span className="ml-2 text-blue-400">{selectedTemplate.data.occupation}</span>
              </div>
              <div className="md:col-span-2">
                <span className="font-medium text-white">Conversation Style:</span>
                <span className="ml-2 text-blue-400">{selectedTemplate.data.conversationStyle}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onSkipTemplate}
        >
          Start from Scratch
        </Button>
        
        <Button
          onClick={() => selectedTemplate && onSelectTemplate(selectedTemplate)}
          disabled={!selectedTemplate}
          className="flex items-center space-x-2"
        >
          <span>Use This Template</span>
          <Wand2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}