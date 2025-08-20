import { CheckCircle, ArrowRight, Eye, Heart } from 'lucide-react';
import { Character } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();

  // Validate callback functions to prevent runtime errors
  const handleStartChat = () => {
    try {
      onStartChat?.();
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  const handleViewCharacter = () => {
    try {
      onViewCharacter?.();
    } catch (error) {
      console.error('Error viewing character:', error);
    }
  };

  const handleCreateAnother = () => {
    try {
      onCreateAnother?.();
    } catch (error) {
      console.error('Error creating another character:', error);
    }
  };

  const handleGoToCharacters = () => {
    try {
      onGoToCharacters?.();
    } catch (error) {
      console.error('Error navigating to characters:', error);
    }
  };
  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card className="text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl">{t('characterCreatedSuccessfully')}</CardTitle>
          <CardDescription>
            {character.name} {t('characterReadyForConversations')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Character Preview */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-4">
              <img
                src={character.avatarUrl || '/assets/characters_img/Elara.jpeg'}
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
              onClick={handleStartChat}
              className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700"
            >
              <ArrowRight className="w-4 h-4" />
              <span>{t('startChatting')}</span>
            </Button>
            
            <Button
              onClick={handleViewCharacter}
              variant="outline"
              className="flex items-center justify-center space-x-2"
            >
              <Eye className="w-4 h-4" />
              <span>{t('viewCharacter')}</span>
            </Button>
            
            <Button
              onClick={handleCreateAnother}
              variant="outline"
              className="flex items-center justify-center space-x-2"
            >
              <Heart className="w-4 h-4" />
              <span>{t('createAnother')}</span>
            </Button>
            
            <Button
              onClick={handleGoToCharacters}
              variant="secondary"
              className="flex items-center justify-center space-x-2"
            >
              <span>{t('browseCharacters')}</span>
            </Button>
          </div>

          {/* Next Steps */}
          <div className="text-sm text-gray-400 space-y-2">
            <p>{t('characterNowLive')}</p>
            <p>{t('editCharacterTip')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}