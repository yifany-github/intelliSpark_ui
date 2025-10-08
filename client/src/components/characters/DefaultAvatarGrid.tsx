import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { DefaultAvatar } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Loader2, Upload, Check } from 'lucide-react';
import ImageWithFallback from '@/components/ui/ImageWithFallback';

interface DefaultAvatarGridProps {
  selectedAvatarUrl: string | null;
  onAvatarSelect: (avatarUrl: string) => void;
  onUploadClick: () => void;
  filterGender?: string;
  filterNsfwLevel?: number;
}

const DefaultAvatarGrid = ({
  selectedAvatarUrl,
  onAvatarSelect,
  onUploadClick,
  filterGender,
  filterNsfwLevel = 0
}: DefaultAvatarGridProps) => {
  const { t } = useLanguage();

  // Fetch default avatars
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/characters/default-avatars'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/characters/default-avatars');
      if (!response.ok) {
        throw new Error('Failed to fetch default avatars');
      }
      const result = await response.json();
      return result.avatars as DefaultAvatar[];
    }
  });

  // Filter avatars based on gender and NSFW level
  const filteredAvatars = data?.filter((avatar) => {
    const genderMatch = !filterGender || avatar.gender === filterGender || filterGender === 'not-specified';
    const nsfwMatch = avatar.nsfw_level <= filterNsfwLevel;
    return genderMatch && nsfwMatch;
  }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-rose-500">
        {t('failedToLoadAvatars') || 'Failed to load avatars'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredAvatars.map((avatar) => (
          <button
            key={avatar.id}
            type="button"
            onClick={() => onAvatarSelect(avatar.url)}
            className={cn(
              "relative group rounded-lg overflow-hidden border-2 transition-all",
              "hover:scale-105 hover:shadow-lg",
              selectedAvatarUrl === avatar.url
                ? "border-brand-secondary ring-2 ring-brand-secondary/50"
                : "border-slate-200 hover:border-brand-secondary/50"
            )}
          >
            {/* Avatar Image */}
            <div className="aspect-square w-full">
              <ImageWithFallback
                src={avatar.thumbnail_url || avatar.url}
                alt={avatar.name}
                fallbackText={avatar.name[0]}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Selected Indicator */}
            {selectedAvatarUrl === avatar.url && (
              <div className="absolute top-2 right-2 bg-brand-secondary rounded-full p-1">
                <Check className="w-4 h-4 text-zinc-900" />
              </div>
            )}

            {/* Hover Label */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-xs text-white font-medium truncate">{avatar.style}</p>
            </div>
          </button>
        ))}

        {/* Custom Upload Option */}
        <button
          type="button"
          onClick={onUploadClick}
          className={cn(
            "relative group rounded-lg overflow-hidden border-2 border-dashed transition-all",
            "hover:scale-105 hover:shadow-lg",
            "border-slate-300 hover:border-brand-secondary/70 bg-slate-50"
          )}
        >
          <div className="aspect-square w-full flex flex-col items-center justify-center gap-2 p-4">
            <Upload className="w-8 h-8 text-slate-400 group-hover:text-brand-secondary transition-colors" />
            <p className="text-xs text-slate-600 group-hover:text-brand-secondary font-medium text-center">
              {t('uploadCustom') || 'Upload Custom'}
            </p>
          </div>
        </button>
      </div>

      {filteredAvatars.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          {t('noAvatarsAvailable') || 'No avatars available for the selected filters'}
        </p>
      )}
    </div>
  );
};

export default DefaultAvatarGrid;
