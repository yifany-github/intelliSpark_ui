import { CheckCircle, ArrowRight, Eye, Heart } from 'lucide-react';
import { Character } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CharacterCreationSuccessProps {
  character: Character;
  onStartChat: () => void;
  onViewCharacter: () => void;
  onCreateAnother: () => void;
  onGoToCharacters: () => void;
}

export default function CharacterCreationSuccess({
  character,
  onStartChat,
  onViewCharacter,
  onCreateAnother,
  onGoToCharacters
}: CharacterCreationSuccessProps) {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card className="text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Character Created Successfully!</CardTitle>
          <CardDescription>
            {character.name} has been created and is ready for conversations
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Character Preview */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-4">
              <img
                src={character.avatarUrl || (character as any).avatar_url || '/assets/characters_img/Elara.jpeg'}
                alt={character.name}
                className="w-16 h-16 rounded-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/assets/characters_img/Elara.jpeg';
                }}
              />
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-white">{character.name}</h3>
                <p className="text-sm text-gray-400 line-clamp-2">{character.description || character.backstory}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {character.traits.slice(0, 3).map((trait) => (
                    <span key={trait} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              onClick={onStartChat}
              className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Start Chatting</span>
            </Button>
            
            <Button
              onClick={onViewCharacter}
              variant="outline"
              className="flex items-center justify-center space-x-2"
            >
              <Eye className="w-4 h-4" />
              <span>View Character</span>
            </Button>
            
            <Button
              onClick={onCreateAnother}
              variant="outline"
              className="flex items-center justify-center space-x-2"
            >
              <Heart className="w-4 h-4" />
              <span>Create Another</span>
            </Button>
            
            <Button
              onClick={onGoToCharacters}
              variant="secondary"
              className="flex items-center justify-center space-x-2"
            >
              <span>Browse Characters</span>
            </Button>
          </div>

          {/* Next Steps */}
          <div className="text-sm text-gray-400 space-y-2">
            <p>🎉 Your character is now live and ready for conversations!</p>
            <p>💡 Tip: You can always edit your character's details later from your profile.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}