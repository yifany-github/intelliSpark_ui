import { X, Star, MessageCircle, Heart } from 'lucide-react';
import { Character } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface CharacterPreviewModalProps {
  character: Character | null;
  isOpen: boolean;
  onClose: () => void;
  onStartChat: (character: Character) => void;
  onToggleFavorite: (characterId: number) => void;
  isFavorite: boolean;
}

export default function CharacterPreviewModal({
  character,
  isOpen,
  onClose,
  onStartChat,
  onToggleFavorite,
  isFavorite
}: CharacterPreviewModalProps) {
  const { t } = useLanguage();
  
  if (!isOpen || !character) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">{character.name}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Character Image */}
              <div className="flex-shrink-0">
                <img
                  src={character.image || character.avatarUrl || 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop'}
                  alt={character.name}
                  className="w-64 h-80 object-cover rounded-lg"
                />
              </div>

              {/* Character Details */}
              <div className="flex-1">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white mb-2">{t('about')}</h3>
                  <p className="text-gray-300 leading-relaxed">
                    {character.description || character.backstory || t('noDescriptionAvailable')}
                  </p>
                </div>

                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white mb-2">{t('traits')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {character.traits.map((trait, index) => (
                      <span 
                        key={index}
                        className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white mb-2">{t('voiceStyle')}</h3>
                  <p className="text-gray-300">{character.voiceStyle || t('natural')}</p>
                </div>

                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4" />
                    <span>4.8</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MessageCircle className="w-4 h-4" />
                    <span>1.2K {t('chats')}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Heart className="w-4 h-4" />
                    <span>856 {t('favorites')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between p-6 border-t border-gray-700">
            <button
              onClick={() => onToggleFavorite(character.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                isFavorite 
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              <span>{isFavorite ? t('removeFromFavorites') : t('addToFavorites')}</span>
            </button>

            <button
              onClick={() => onStartChat(character)}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{t('startChat')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}