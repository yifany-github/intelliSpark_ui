import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Heart, MessageCircle, Star, ArrowLeft } from "lucide-react";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { Character } from "@/types";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useRolePlay } from "@/contexts/RolePlayContext";
import { useNavigation } from "@/contexts/NavigationContext";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import TraitChips from "@/components/characters/TraitChips";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const CHROME: Record<Language, {
  back: string;
  notFound: string;
  loading: string;
  kicker: string;
  altSuffix: string;
  startChat: string;
  title: (name: string) => string;
  fallbackDescription: (name: string) => string;
}> = {
  zh: {
    back: "返回角色列表",
    notFound: "找不到这个角色。",
    loading: "加载中…",
    kicker: "18+ AI 角色扮演",
    altSuffix: "角色头像",
    startChat: "开始聊天",
    title: (name) => `${name} · 18+ AI 角色扮演 | YY Chat 歪歪`,
    fallbackDescription: (name) =>
      `在 YY Chat 与 ${name} 进行 18+ AI 角色扮演聊天。韩国漫画风格角色，网页即可开始。`,
  },
  en: {
    back: "Back to characters",
    notFound: "Character not found.",
    loading: "Loading…",
    kicker: "18+ AI roleplay",
    altSuffix: "character avatar",
    startChat: "Start Chat",
    title: (name) => `${name} · 18+ AI roleplay | YY Chat 歪歪`,
    fallbackDescription: (name) =>
      `Chat with ${name} on YY Chat — 18+ AI roleplay. Korean manhwa-inspired character, in the browser.`,
  },
};

interface CharacterPageProps {
  characterId: string;
}

export default function CharacterPage({ characterId }: CharacterPageProps) {
  const id = Number(characterId);
  const { isAuthenticated } = useAuth();
  const { setSelectedCharacter } = useRolePlay();
  const { navigateToLogin } = useNavigation();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const chrome = CHROME[language];

  const { data: character, isLoading, error } = useQuery<Character>({
    queryKey: ["/api/characters", id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/characters/${id}`);
      if (response.status === 404) throw new Error("not-found");
      if (!response.ok) throw new Error("failed");
      return response.json();
    },
    enabled: Number.isFinite(id) && id > 0,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!character) return;
    const title = chrome.title(character.name);
    document.title = title;
    const descText = (character.description || character.backstory || "")
      .replace(/\s+/g, " ")
      .slice(0, 150);
    const description = descText || chrome.fallbackDescription(character.name);

    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        if (selector.startsWith("meta[name=")) {
          el.setAttribute("name", selector.slice(11, -2));
        } else if (selector.startsWith("meta[property=")) {
          el.setAttribute("property", selector.slice(15, -2));
        }
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", `https://yychat.ai/character/${character.id}`);

    const canonical =
      document.querySelector('link[rel="canonical"]') ||
      Object.assign(document.createElement("link"), { rel: "canonical" });
    if (!canonical.parentElement) document.head.appendChild(canonical);
    canonical.setAttribute("href", `https://yychat.ai/character/${character.id}`);

    return () => {
      document.title = language === "zh"
        ? "YY Chat 歪歪｜韩国 18+ 漫画角色 AI 角色扮演聊天"
        : "YY Chat 歪歪 | 18+ Korean manhwa AI roleplay";
    };
  }, [character, chrome, language]);

  const { mutate: createChat, isPending: isCreatingChat } = useMutation({
    mutationFn: async ({ characterId }: { characterId: number }) => {
      const response = await apiRequest("POST", "/api/chats", {
        characterId,
        title: t("chatWithCharacter"),
      });
      return response.json();
    },
    onSuccess: (chat) => {
      if (!chat?.uuid) {
        toast({
          title: t("error") || "Error",
          description: "Backend error: Chat UUID missing. Please contact support.",
          variant: "destructive",
        });
        return;
      }
      setLocation(`/chat/${chat.uuid}`, { replace: true });
    },
    onError: () => {
      toast({
        title: t("error") || "Error",
        description: t("failedToStartChat") || "Unable to start chat. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartChat = () => {
    if (!character) return;
    if (!isAuthenticated) {
      navigateToLogin();
      return;
    }
    setSelectedCharacter(character);
    createChat({ characterId: character.id });
  };

  const avatarSrc = character?.avatarUrl?.startsWith("http")
    ? character.avatarUrl
    : `${API_BASE_URL}${character?.avatarUrl || ""}`;

  return (
    <GlobalLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-content-tertiary hover:text-content-secondary mb-6">
          <ArrowLeft className="w-4 h-4" />
          {chrome.back}
        </Link>

        {(!Number.isFinite(id) || id <= 0 || error) && (
          <p className="text-content-secondary">{chrome.notFound}</p>
        )}

        {isLoading && <p className="text-content-tertiary">{chrome.loading}</p>}

        {character && (
          <article className="grid gap-8 md:grid-cols-[280px_1fr]">
            <img
              src={avatarSrc}
              alt={`${character.name} ${chrome.altSuffix}`}
              className="w-full aspect-[3/4] object-cover rounded-xl border border-surface-border"
            />
            <div>
              <p className="text-xs uppercase tracking-widest text-brand-secondary mb-2">{chrome.kicker}</p>
              <h1 className="text-3xl font-bold text-content-primary mb-3">{character.name}</h1>
              {(character.nsfwLevel || 0) > 0 && (
                <span className="inline-block mb-4 text-xs font-bold bg-red-500/90 text-white px-2 py-1 rounded">18+</span>
              )}
              <p className="text-content-secondary leading-relaxed mb-4">
                {character.description || character.backstory}
              </p>
              {character.openingLine && (
                <blockquote className="border-l-2 border-brand-secondary/60 pl-4 text-content-secondary italic mb-6">
                  {character.openingLine}
                </blockquote>
              )}
              {character.traits?.length > 0 && (
                <div className="mb-6">
                  <TraitChips traits={character.traits} maxVisible={8} size="xs" />
                </div>
              )}
              <div className="flex items-center gap-4 text-sm text-content-tertiary mb-6">
                <span className="inline-flex items-center gap-1">
                  <Heart className="w-4 h-4" /> {character.likeCount || 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="w-4 h-4" /> {character.chatCount || 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Star className="w-4 h-4" /> {character.viewCount || 0}
                </span>
              </div>
              <button
                type="button"
                onClick={handleStartChat}
                disabled={isCreatingChat}
                className="px-6 py-3 bg-brand-secondary text-zinc-900 rounded-lg font-bold hover:bg-brand-secondary/90 disabled:opacity-60"
              >
                {isCreatingChat ? t("creating") : t("startChat") || chrome.startChat}
              </button>
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "Person",
                    name: character.name,
                    description: character.description || character.backstory,
                    image: avatarSrc,
                    url: `https://yychat.ai/character/${character.id}`,
                  }),
                }}
              />
            </div>
          </article>
        )}
      </div>
    </GlobalLayout>
  );
}
