import { X, Star, MessageCircle, Heart, Crown, Edit, User as UserIcon } from 'lucide-react';
import { Character } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'wouter';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

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
  const { user } = useAuth();
  
  if (!isOpen || !character) return null;
  
  // Check if current user is the owner of this character
  const isOwner = user && character.createdBy === user.id;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="relative rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-gray-900/40 backdrop-blur-2xl border-2 border-pink-500/50 shadow-2xl shadow-pink-500/30">
        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-pink-500/20">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{character.name}</h2>
              {(character as any).createdByUsername && (
                <div className="flex items-center gap-1.5 text-sm text-gray-300">
                  <UserIcon className="w-4 h-4 text-pink-400" />
                  <span>Created by <span className="text-pink-400 font-medium">{(character as any).createdByUsername}</span></span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-pink-500/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-300 hover:text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Character Image */}
              <div className="flex-shrink-0">
                <img
                  src={character.avatarUrl?.startsWith('http') ? character.avatarUrl : `${API_BASE_URL}${character.avatarUrl}`}
                  alt={character.name}
                  className="w-64 h-80 object-cover rounded-xl border-2 border-pink-500/20 shadow-lg"
                />
              </div>

              {/* Character Details */}
              <div className="flex-1">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white mb-2">{t('about')}</h3>
                  <p className="text-gray-300 leading-relaxed">
                    {character.description || t('noDescriptionAvailable')}
                  </p>
                </div>

                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white mb-2">{t('traits')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {character.traits.map((trait, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 rounded-full text-sm font-medium bg-pink-500/20 border border-pink-500/40 text-pink-300"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>

                {/* TODO: Re-enable voice style section when voice system is implemented (Issue #118)
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white mb-2">{t('voiceStyle')}</h3>
                  <p className="text-gray-300">{character.voiceStyle || t('natural')}</p>
                </div>
                */}

                {/* Stats with real data */}
                <div className="grid grid-cols-3 gap-3 p-4 bg-pink-500/10 rounded-xl border border-pink-500/30 backdrop-blur-sm">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center space-x-1 text-yellow-400 mb-1">
                      <Heart className="w-4 h-4 fill-current" />
                      <span className="text-lg font-bold">{character.likeCount || 0}</span>
                    </div>
                    <span className="text-xs text-gray-400">{t('favorites') || 'Likes'}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="flex items-center space-x-1 text-blue-400 mb-1">
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-lg font-bold">{character.chatCount || 0}</span>
                    </div>
                    <span className="text-xs text-gray-400">{t('chats') || 'Chats'}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="flex items-center space-x-1 text-purple-400 mb-1">
                      <Star className="w-4 h-4" />
                      <span className="text-lg font-bold">{character.viewCount || 0}</span>
                    </div>
                    <span className="text-xs text-gray-400">{t('views') || 'Views'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between p-6 border-t border-pink-500/20">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => onToggleFavorite(character.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all font-medium ${
                  isFavorite
                    ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/30'
                    : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                <span>{isFavorite ? t('removeFromFavorites') : t('addToFavorites')}</span>
              </button>

              {/* Owner-only edit button */}
              {isOwner && (
                <Link to={`/character/${character.id}/edit`}>
                  <button className="flex items-center space-x-2 px-4 py-2.5 bg-green-500/20 border border-green-500/50 text-green-300 hover:bg-green-500/30 rounded-xl transition-all font-medium">
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                </Link>
              )}
            </div>

            <button
              onClick={() => onStartChat(character)}
              className="flex items-center space-x-2 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-xl transition-all font-medium shadow-lg shadow-pink-500/30"
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
