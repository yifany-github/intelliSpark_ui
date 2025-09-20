import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BookOpen, Loader2, Sparkles, Users } from "lucide-react";

import GlobalLayout from "@/components/layout/GlobalLayout";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { StoryMetadata } from "@/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const GRADIENTS = [
  "from-blue-500/80 via-indigo-500/60 to-purple-500/70",
  "from-pink-500/80 via-rose-500/60 to-purple-500/60",
  "from-emerald-500/80 via-teal-500/60 to-blue-500/70",
  "from-amber-500/80 via-orange-500/60 to-rose-500/70",
  "from-sky-500/80 via-blue-500/60 to-indigo-500/70",
  "from-fuchsia-500/80 via-purple-500/60 to-indigo-500/70",
];

const getGradientForId = (id: string) => {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length];
};

const getCoverSrc = (cover?: string) => {
  if (!cover) return null;
  return cover.startsWith("http") ? cover : `${API_BASE_URL}${cover}`;
};

const StoryCard = ({ story, onOpen }: { story: StoryMetadata; onOpen: (id: string) => void }) => {
  const gradient = getGradientForId(story.id);
  const coverSrc = getCoverSrc(story.coverImage);
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={() => onOpen(story.id)}
      className="group relative block overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/70 transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/50 hover:shadow-xl hover:shadow-blue-500/10"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt={story.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className={`h-full w-full bg-gradient-to-br ${gradient}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
        <div className="absolute top-3 right-3 flex gap-2">
          {story.locale && (
            <Badge variant="outline" className="border-white/40 bg-slate-900/60 text-white backdrop-blur">
              {story.locale}
            </Badge>
          )}
          <Badge variant="secondary" className="bg-black/50 text-white backdrop-blur">
            <Users className="mr-1 h-3 w-3" />
            {story.roles.length}
          </Badge>
        </div>
        <div className="absolute bottom-4 left-4 right-4 space-y-3 text-left">
          <div className="flex items-center gap-2 text-xs text-slate-200">
            <BookOpen className="h-4 w-4 text-blue-200" />
            <span>
              {t("storyScene")}: {story.startScene}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-white line-clamp-2 drop-shadow-lg">{story.title}</h3>
          {story.summary && (
            <p className="text-sm text-slate-200/80 line-clamp-2">{story.summary}</p>
          )}
        </div>
      </div>
    </button>
  );
};

const StoriesPage = () => {
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  const {
    data: stories = [],
    isLoading,
    isError,
  } = useQuery<StoryMetadata[]>({
    queryKey: ["/api/stories"],
  });

  const handleOpenStory = (storyId: string) => {
    navigate(`/stories/${storyId}`);
  };

  return (
    <GlobalLayout>
      <div className="px-4 py-6 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{t("storytelling")}</p>
            <h1 className="text-2xl font-semibold text-white">{t("stories")}</h1>
          </div>
          <Badge variant="secondary" className="w-fit bg-blue-500/10 text-blue-200">
            <Sparkles className="mr-1 h-4 w-4" />
            {t("multiRoleStories")}
          </Badge>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{t("loadingStories")}</span>
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {t("failedToStartSession")}
          </div>
        )}

        {!isLoading && stories.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-center text-sm text-slate-300">
            {t("noStoriesFound")}
          </div>
        )}

        {stories.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {stories.map((story) => (
              <StoryCard key={story.id} story={story} onOpen={handleOpenStory} />
            ))}
          </div>
        )}
      </div>
    </GlobalLayout>
  );
};

export default StoriesPage;
