import { Sparkles, BookOpen, Wand2 } from "lucide-react";
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
            <Sparkles className="mr-2 h-3 w-3" />
            {t("storytelling")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
            {t("discoverYourNextAdventure") || "探索下一段属于你的多角色故事"}
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
            {t("heroSubtitle") || "挑选心仪角色，进入动态剧情或开启协作冒险。Gemini 与 Grok 将提供沉浸式旁白，让每一次选择都充满惊喜。"}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              className="bg-brand-secondary text-zinc-900 hover:bg-brand-secondary/80"
              size="lg"
              onClick={() => navigateToPath("/stories")}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              {t("startStory") || "开始故事模式"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800"
              onClick={() => navigateToPath("/create-character")}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {t("createCharacterCTA") || "创建你的角色"}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:max-w-xs text-sm">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-5 shadow-inner">
            <p className="text-xs uppercase tracking-wider text-slate-400">{t("liveStories") || "实时故事"}</p>
            <p className="mt-2 text-2xl font-semibold text-white">12+</p>
            <p className="mt-1 text-xs text-slate-500">{t("storiesUpdating") || "持续更新的多角色剧本"}</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-5 shadow-inner">
            <p className="text-xs uppercase tracking-wider text-slate-400">{t("featuredCharacters")}</p>
            <p className="mt-2 text-2xl font-semibold text-white">60+</p>
            <p className="mt-1 text-xs text-slate-500">{t("heroFeaturedHint") || "精选角色正在等待与你互动"}</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-5 shadow-inner col-span-2">
            <p className="text-xs uppercase tracking-wider text-slate-400">{t("aiNarration") || "AI 叙事"}</p>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              {t("heroNarrationHint") || "Gemini 与 Grok 提供实时旁白与角色刻画，让你的决策塑造故事走向。"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CharacterHero;
