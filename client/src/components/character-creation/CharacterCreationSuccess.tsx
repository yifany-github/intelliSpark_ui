import { CheckCircle, ArrowRight, Eye, Heart } from 'lucide-react';
import { Character } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import { useLanguage } from '@/contexts/LanguageContext';
import CharacterPreviewModal from '@/components/characters/CharacterPreviewModal';
import { useState } from 'react';

interface CharacterCreationSuccessProps {
  character: Character;
  onStartChat: () => void;
  onViewCharacter: () => void;
  onCreateAnother: () => void;
  onGoToCharacters: () => void;
  onToggleFavorite?: (characterId: number) => void;
  isFavorite?: boolean;
}

export default function CharacterCreationSuccess({
  character,
  onStartChat,
  onViewCharacter,
  onCreateAnother,
  onGoToCharacters,
  onToggleFavorite,
  isFavorite = false
}: CharacterCreationSuccessProps) {
  const { t } = useLanguage();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const openPreview = () => setIsPreviewOpen(true);
  const closePreview = () => setIsPreviewOpen(false);

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
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
              <ImageWithFallback
                src={character.avatarUrl}
                alt={character.name}
                fallbackText={character.name ?? '?'}
                size="lg"
                className="bg-slate-100"
              />
              <div className="flex-1 max-w-xl">
                <h3 className="font-semibold text-white">{character.name}</h3>
                <p className="text-sm text-gray-400 line-clamp-2">{character.description || character.backstory}</p>
                <div className="flex flex-wrap gap-1 mt-2 justify-center sm:justify-start">
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
              className="flex items-center justify-center space-x-2 bg-brand-secondary text-zinc-900 hover:bg-brand-secondary/90"
            >
              <ArrowRight className="w-4 h-4" />
              <span>{t('startChatting')}</span>
            </Button>

            <Button
              onClick={handleViewCharacter}
              variant="outline"
              className="flex items-center justify-center space-x-2 border-brand-secondary/60 text-brand-secondary hover:bg-brand-secondary/10"
            >
              <Eye className="w-4 h-4" />
              <span>{t('previewCharacter')}</span>
            </Button>

            <Button
              onClick={handleCreateAnother}
              variant="outline"
              className="flex items-center justify-center space-x-2 border-brand-secondary/60 text-brand-secondary hover:bg-brand-secondary/10"
            >
              <Heart className="w-4 h-4" />
              <span>{t('createAnother')}</span>
            </Button>

            <Button
              onClick={handleGoToCharacters}
              className="flex items-center justify-center space-x-2 bg-brand-secondary/80 text-zinc-900 hover:bg-brand-secondary"
            >
              <span>{t('browseAllCharacters')}</span>
            </Button>

            {onToggleFavorite && (
              <Button
                onClick={() => onToggleFavorite(character.id)}
                variant={isFavorite ? 'secondary' : 'outline'}
                className={`flex items-center justify-center space-x-2 ${
                  isFavorite
                    ? 'bg-brand-secondary/80 text-zinc-900 hover:bg-brand-secondary'
                    : 'border-brand-secondary/60 text-brand-secondary hover:bg-brand-secondary/10'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current text-rose-500' : ''}`} />
                <span>{isFavorite ? t('removeFromFavorites') : t('addToFavorites')}</span>
              </Button>
            )}
          </div>

          {/* Next Steps */}
          <div className="text-sm text-gray-400 space-y-2">
            <p>{t('characterNowLive')}</p>
            <p>{t('editCharacterTip')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Character Preview Modal */}
      <CharacterPreviewModal
        character={character}
        isOpen={isPreviewOpen}
        onClose={closePreview}
        onStartChat={async () => {
          closePreview();
          handleStartChat();
        }}
        onToggleFavorite={(id) => {
          onToggleFavorite?.(id);
        }}
        isFavorite={isFavorite}
      />
    </div>
  );
}
