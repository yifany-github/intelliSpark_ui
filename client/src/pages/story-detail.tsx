import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, BookOpen, Loader2, MapPin, Sparkles, Users } from "lucide-react";

import GlobalLayout from "@/components/layout/GlobalLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { StoryMetadata, StoryRole, StorySession } from "@/types";
import { apiRequest, queryClient } from "@/lib/queryClient";

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

const RoleCard = ({
  role,
  isSelected,
  onSelect,
  selectLabel,
  activeLabel,
}: {
  role: StoryRole;
  isSelected: boolean;
  onSelect: () => void;
  selectLabel: string;
  activeLabel: string;
}) => {
  const gradient = getGradientForId(role.id);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 ${
        isSelected
          ? "border-blue-400/80 bg-slate-900/90 ring-2 ring-blue-400/40"
          : "border-slate-800/80 bg-slate-900/70 hover:border-blue-400/40 hover:-translate-y-1"
      }`}
    >
      <div className="relative flex h-44 items-start justify-between overflow-hidden">
        <div
          className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90 transition-opacity duration-200 group-hover:opacity-100`}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.2),_rgba(15,23,42,0.85))]" />
        <span className="relative z-10 ml-4 mt-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900/40 text-xl font-semibold text-white backdrop-blur-sm">
          {role.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="relative z-10 flex h-full flex-col items-end justify-end gap-2 p-4">
          <div className="flex flex-wrap justify-end gap-1">
            {role.traits.slice(0, 3).map((trait) => (
              <span key={trait} className="rounded-full bg-white/20 px-3 py-1 text-[11px] text-white">
                {trait}
              </span>
            ))}
            {role.traits.length > 3 && (
              <span className="rounded-full bg-white/20 px-2 py-1 text-[11px] text-white">
                +{role.traits.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-2 p-4 text-left">
        <div>
          <p className="text-sm font-semibold text-white">{role.name}</p>
          <p className="text-xs uppercase tracking-wide text-slate-400">{role.id}</p>
        </div>
        {role.inventory.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {role.inventory.map((item) => (
              <span key={item} className="rounded-full bg-slate-800/80 px-2 py-1 text-[11px] text-slate-200">
                {item}
              </span>
            ))}
          </div>
        )}
        {!isSelected && (
          <span className="inline-flex items-center gap-1 text-xs text-blue-200">
            <Sparkles className="h-3 w-3" />
            {selectLabel}
          </span>
        )}
        {isSelected && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-100">
            <Sparkles className="h-3 w-3" />
            {activeLabel}
          </span>
        )}
      </div>
    </button>
  );
};

interface StoryDetailPageProps {
  storyId: string;
}

const StoryDetailPage = ({ storyId }: StoryDetailPageProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const {
    data: stories = [],
    isLoading,
    isError,
  } = useQuery<StoryMetadata[]>({
    queryKey: ["/api/stories"],
  });

  const story = useMemo(() => stories.find((item) => item.id === storyId) ?? null, [stories, storyId]);

  useEffect(() => {
    if (story && story.roles.length > 0) {
      setSelectedRoleId((prev) => prev ?? story.roles[0].id);
    }
  }, [story]);

  const { mutate: startSession, isPending: isStarting } = useMutation({
    mutationFn: async ({ userRole }: { userRole: string }) => {
      const response = await apiRequest("POST", `/api/stories/${storyId}/sessions`, {
        userRole,
      });
      const data = (await response.json()) as StorySession;
      return data;
    },
    onSuccess: (session) => {
      toast({ title: t("sessionStarted") });
      queryClient.invalidateQueries({ queryKey: [`/api/story-sessions/${session.id}`] });
      navigate(`/stories/session/${session.id}`);
    },
    onError: () => {
      toast({ title: t("failedToStartSession"), variant: "destructive" });
    },
  });

  const handleStart = () => {
    if (!story || !selectedRoleId) {
      toast({ title: t("selectRole"), variant: "destructive" });
      return;
    }
    startSession({ userRole: selectedRoleId });
  };

  const handleBack = () => {
    navigate("/stories");
  };

  if (isLoading) {
    return (
      <GlobalLayout>
        <div className="px-4 py-6">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{t("loadingStories")}</span>
          </div>
        </div>
      </GlobalLayout>
    );
  }

  if (isError || !story) {
    return (
      <GlobalLayout>
        <div className="px-4 py-6 space-y-4">
          <Button variant="ghost" className="w-fit text-slate-300" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("backToStories")}
          </Button>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-300">
            {t("noStoriesFound")}
          </div>
        </div>
      </GlobalLayout>
    );
  }

  const coverSrc = getCoverSrc(story.coverImage);
  const gradient = getGradientForId(story.id);

  return (
    <GlobalLayout>
      <div className="space-y-8 pb-10">
        <div className="relative h-64 w-full overflow-hidden">
          {coverSrc ? (
            <img src={coverSrc} alt={story.title} className="h-full w-full object-cover" />
          ) : (
            <div className={`h-full w-full bg-gradient-to-br ${gradient}`} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
          <div className="absolute left-4 right-4 top-4 flex items-center justify-between text-white">
            <Button variant="ghost" className="bg-black/30 text-white hover:bg-black/50" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("backToStories")}
            </Button>
            {story.locale && (
              <Badge variant="outline" className="border-white/60 bg-black/40 text-white backdrop-blur">
                {story.locale}
              </Badge>
            )}
          </div>
          <div className="absolute bottom-6 left-6 right-6 space-y-4 text-white">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm backdrop-blur">
              <Sparkles className="h-4 w-4" />
              {t("multiRoleStories")}
            </div>
            <h1 className="text-3xl font-bold drop-shadow-xl">{story.title}</h1>
            {story.summary && <p className="max-w-2xl text-sm text-white/80">{story.summary}</p>}
          </div>
        </div>

        <div className="px-4 space-y-8">
          <div className="grid gap-4 text-sm text-slate-200 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">{t("storyScene")}</p>
              <p className="mt-2 text-lg font-semibold text-white">{story.startScene}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">{t("multiRoleStories")}</p>
              <p className="mt-2 text-lg font-semibold text-white">{story.roles.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">ID</p>
              <p className="mt-2 text-lg font-semibold text-white">{story.id}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{t("selectRole")}</h2>
              {selectedRoleId && (
                <span className="text-xs text-slate-400">
                  {t("storyInventory")}: {story.roles.find((role) => role.id === selectedRoleId)?.inventory.length ?? 0}
                </span>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {story.roles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  isSelected={selectedRoleId === role.id}
                  onSelect={() => setSelectedRoleId(role.id)}
                  selectLabel={t("selectRole")}
                  activeLabel={t("roleSelected")}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-sm text-slate-200">
              <MapPin className="h-5 w-5 text-pink-300" />
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{t("selectRole")}</p>
                <p className="text-base font-semibold text-white">
                  {selectedRoleId
                    ? story.roles.find((role) => role.id === selectedRoleId)?.name ?? selectedRoleId
                    : t("selectRole")}
                </p>
              </div>
            </div>
            <Button onClick={handleStart} disabled={!selectedRoleId || isStarting} className="sm:min-w-[180px]">
              {isStarting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("startStory")}
                </span>
              ) : (
                t("startStory")
              )}
            </Button>
          </div>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default StoryDetailPage;
