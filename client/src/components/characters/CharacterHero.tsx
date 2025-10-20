import { MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigation } from "@/contexts/NavigationContext";

const CharacterHero = () => {
  const { t } = useLanguage();
  const { navigateToPath } = useNavigation();

  return (
    <section className="relative overflow-hidden rounded-3xl p-6 sm:p-10 liquid-glass-hero-dark">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-brand-secondary/20 blur-3xl" />
        <div className="absolute right-10 -bottom-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
      </div>
      <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
        <div className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center rounded-full bg-slate-800/60 px-3 py-1 text-xs font-medium uppercase tracking-wider text-blue-200">
            <MessageCircle className="mr-2 h-3 w-3" />
            {t("storytelling")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
            {t("discoverYourNextAdventure") || "探索下一段属于你的多角色故事"}
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
            {t("heroSubtitle") || "与精选的韩国 18+ 漫画角色实时聊天，体验沉浸式成人剧情。"}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              className="bg-brand-secondary text-zinc-900 hover:bg-brand-secondary/80"
              size="lg"
              onClick={() => navigateToPath("/chats")}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              {t("startStory") || "开始聊天"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800"
              onClick={() => navigateToPath("/discover")}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {t("createCharacterCTA") || "浏览精选角色"}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:max-w-xs text-sm">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-5 shadow-inner">
            <p className="text-xs uppercase tracking-wider text-slate-400">{t("liveStories") || "活跃聊天"}</p>
            <p className="mt-2 text-2xl font-semibold text-white">3k+</p>
            <p className="mt-1 text-xs text-slate-500">{t("storiesUpdating") || "每日进行中的真实对话"}</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-5 shadow-inner">
            <p className="text-xs uppercase tracking-wider text-slate-400">{t("featuredCharacters")}</p>
            <p className="mt-2 text-2xl font-semibold text-white">80+</p>
            <p className="mt-1 text-xs text-slate-500">{t("heroFeaturedHint") || "韩国 18+ 漫画灵感角色随时上线"}</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-5 shadow-inner col-span-2">
            <p className="text-xs uppercase tracking-wider text-slate-400">{t("aiNarration") || "精选韩漫"}</p>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              {t("heroNarrationHint") || "每日挑选的韩漫人气主角，带来高质量成人互动体验。"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CharacterHero;
