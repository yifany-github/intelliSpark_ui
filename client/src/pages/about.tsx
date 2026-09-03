import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import GlobalLayout from "@/components/layout/GlobalLayout";
import {
  Users,
  MessageSquare,
  Shield,
  Sparkles,
  Target,
  Heart,
  Zap,
  Mail,
  ArrowRight,
  CheckCircle,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLanguage, type Language } from "@/contexts/LanguageContext";

const FEATURE_ICONS = [MessageSquare, Users, Shield, Zap, Sparkles, Heart] as const;

const COPY: Record<Language, {
  seoTitle: string;
  seoDescription: string;
  ogTitle: string;
  ogDescription: string;
  heroTitle: string;
  heroBody: string;
  getStarted: string;
  learnMore: string;
  stats: { label: string; value: string; description: string }[];
  missionHeading: string;
  missionSub: string;
  missionTitle: string;
  missionBody: string;
  visionTitle: string;
  visionBody: string;
  featuresHeading: string;
  featuresSub: string;
  features: { title: string; description: string }[];
  techTitle: string;
  techBody: string;
  badges: string[];
  storyTitle: string;
  story: string[];
  storyClose: string;
  relatedTitle: string;
  relatedSub: string;
  relatedEnTitle: string;
  relatedEnBody: string;
  relatedEnCta: string;
  relatedZhTitle: string;
  relatedZhBody: string;
  relatedZhCta: string;
  contactTitle: string;
  contactSub: string;
  supportTitle: string;
  supportBody: string;
  contactSupport: string;
  ctaTitle: string;
  ctaBody: string;
  exploreCharacters: string;
  createCharacter: string;
}> = {
  en: {
    seoTitle: "About YY Chat 歪歪 | 18+ Korean manhwa AI roleplay (not YY Live)",
    seoDescription: "YY Chat (歪歪, yychat.ai) is 18+ web AI roleplay with curated Korean adult-manhwa characters. Chinese-first UI. Not YY Live, YY.com, or 易歪歪.",
    ogTitle: "About YY Chat 歪歪 | Not YY Live",
    ogDescription: "18+ web AI roleplay. Korean manhwa characters, Chinese-first UI, no tavern or API key. Not affiliated with YY Live.",
    heroTitle: "About YY Chat",
    heroBody: "YY Chat (歪歪) is an 18+ web AI roleplay app. Talk with curated Korean adult-manhwa characters in immersive stories. Chinese-first UI, open in the browser. We are not YY Live, YY.com, JOYY, or 易歪歪.",
    getStarted: "Get Started",
    learnMore: "Learn More",
    stats: [
      { label: "Curated characters", value: "80+", description: "Korean 18+ manhwa-inspired" },
      { label: "Age limit", value: "18+", description: "Fictional adult characters only" },
      { label: "How to open", value: "Web", description: "No tavern, no API key" },
      { label: "UI language", value: "中文", description: "Chinese-first, also English" },
    ],
    missionHeading: "Our Mission & Vision",
    missionSub: "A Chinese-first 18+ roleplay site you open in the browser — not a giant character library, and not YY Live.",
    missionTitle: "Our Mission",
    missionBody: "Give adults a straightforward way to roleplay with curated Korean manhwa-inspired characters. Chinese-first UI, hosted on the web, no SillyTavern install and no API key. Adult 18+ fiction only.",
    visionTitle: "Our Vision",
    visionBody: "Stay a focused 18+ roleplay site: honest about the 80+ curated catalog, clear that we are not YY Live or a mainstream social app, and usable in both Chinese and English.",
    featuresHeading: "What Makes Us Special",
    featuresSub: "Hosted web roleplay with a curated catalog — not the largest library, and not a local tavern stack.",
    features: [
      { title: "AI conversations", description: "Powered by Google Gemini for context-aware replies that follow the character you picked." },
      { title: "Custom character creation", description: "Design AI characters with their own personality, backstory, and conversation style." },
      { title: "Privacy & safety", description: "Accounts, encrypted transport, and terms that keep this an 18+ fictional-adult product." },
      { title: "Token-based usage", description: "Pay for what you use. Tokens do not expire." },
      { title: "Immersive roleplay", description: "18+ fictional stories with Korean manhwa-inspired characters that keep context." },
      { title: "Chinese-first, English too", description: "The product UI is Chinese-first. English is available from the language switcher." },
    ],
    techTitle: "Powered by Advanced AI",
    techBody: "The site uses Google Gemini for natural, context-aware replies, plus our character setup so conversations stay in-character. Open the web app — no local model picker.",
    badges: ["Google Gemini AI", "Context-Aware Responses", "Character enhancement", "Real-time conversations"],
    storyTitle: "Our Story",
    story: [
      "YY Chat (歪歪) started as a web AI roleplay site for adults who want Korean manhwa-inspired characters without installing SillyTavern or pasting an API key.",
      "The catalog is curated — about 80+ characters — not a claim of thousands. The interface is Chinese-first, with English available.",
      "We are a small 18+ roleplay site at yychat.ai. We are not YY Live, YY.com, JOYY, or 易歪歪.",
    ],
    storyClose: "Welcome to YY Chat.",
    relatedTitle: "Related pages",
    relatedSub: "Straight comparisons if you searched for a Character.AI alternative or 中文无审查网页版.",
    relatedEnTitle: "Character.AI alternative",
    relatedEnBody: "18+ uncensored AI roleplay in the browser. No SillyTavern, no API key.",
    relatedEnCta: "Read the English comparison →",
    relatedZhTitle: "中文无审查 AI 角色扮演",
    relatedZhBody: "Web app, no tavern. Chinese-first UI, curated 18+ Korean manhwa characters.",
    relatedZhCta: "Open the Chinese page →",
    contactTitle: "Get In Touch",
    contactSub: "Questions or feedback? We would like to hear from you.",
    supportTitle: "Support & Feedback",
    supportBody: "Need help or have suggestions? Email support.",
    contactSupport: "Contact Support",
    ctaTitle: "Ready to start?",
    ctaBody: "Browse the curated 80+ catalog, then log in when you want to chat. Adult 18+ only.",
    exploreCharacters: "Explore Characters",
    createCharacter: "Create Character",
  },
  zh: {
    seoTitle: "关于 YY Chat 歪歪｜18+ 韩漫 AI 角色扮演（非 YY 直播）",
    seoDescription: "YY Chat（歪歪，yychat.ai）是面向 18+ 的网页版 AI 角色扮演，和精选韩国成人漫画角色聊天。与 YY 直播、YY.com、易歪歪无关。",
    ogTitle: "关于 YY Chat 歪歪｜不是 YY 直播",
    ogDescription: "18+ 网页版 AI 角色扮演。韩漫角色，中文界面，不用酒馆和 API Key。与 YY 直播无关。",
    heroTitle: "关于 YY Chat",
    heroBody: "YY Chat（歪歪）是面向 18 岁及以上用户的网页版 AI 角色扮演。和精选韩国成人漫画角色聊沉浸式剧情。中文界面，网页即开。我们不是 YY 直播、YY.com、JOYY，也不是易歪歪。",
    getStarted: "开始聊天",
    learnMore: "了解更多",
    stats: [
      { label: "精选角色", value: "80+", description: "韩国 18+ 漫画灵感" },
      { label: "年龄限制", value: "18+", description: "仅虚构成人角色" },
      { label: "打开方式", value: "网页", description: "不用酒馆，不用 API Key" },
      { label: "界面语言", value: "中文", description: "也支持英文" },
    ],
    missionHeading: "使命与愿景",
    missionSub: "中文优先的 18+ 角色扮演网页，不是最大角色库，也不是 YY 直播。",
    missionTitle: "我们的使命",
    missionBody: "让成年人能在网页里和精选韩漫灵感角色进行角色扮演。中文界面，不用安装酒馆，也不用填写 API Key。仅限 18+ 虚构成人内容。",
    visionTitle: "我们的愿景",
    visionBody: "做成专注的 18+ 角色扮演站点：角色是精选约 80+，清楚说明我们不是 YY 直播、也不是大众社交产品，中文和英文都能用。",
    featuresHeading: "我们特别在哪",
    featuresSub: "托管网页版角色扮演，精选目录——不是最大库，也不是本地酒馆方案。",
    features: [
      { title: "AI 对话", description: "使用 Google Gemini，围绕你选的角色做有上下文的回复。" },
      { title: "自定义角色", description: "可以自己设定性格、背景和说话方式。" },
      { title: "隐私与安全", description: "需要账号，传输加密，条款明确这是 18+ 虚构成人产品。" },
      { title: "按用量计 token", description: "用多少付多少，token 不会过期。" },
      { title: "沉浸式角色扮演", description: "18+ 虚构剧情，韩漫灵感角色会记住上下文。" },
      { title: "中文优先，也有英文", description: "产品界面中文优先，可在语言切换里改成英文。" },
    ],
    techTitle: "由先进 AI 驱动",
    techBody: "站点使用 Google Gemini 做自然、带上下文的回复，再配合角色设定保持人设。打开网页即可，没有本地模型选择器。",
    badges: ["Google Gemini AI", "带上下文回复", "角色增强", "实时对话"],
    storyTitle: "我们的故事",
    story: [
      "YY Chat（歪歪）一开始就是给想聊韩漫灵感角色的成年人做的网页版 AI 角色扮演，不用安装 SillyTavern，也不用自己贴 API Key。",
      "角色是精选的，大约 80+ 个，不会写成上千。界面中文优先，也提供英文。",
      "我们是 yychat.ai 上的小型 18+ 角色扮演站。不是 YY 直播、YY.com、JOYY，也不是易歪歪。",
    ],
    storyClose: "欢迎来到 YY Chat。",
    relatedTitle: "相关页面",
    relatedSub: "如果你在搜 Character.AI alternative 或中文无审查网页版，可以直接看对比说明。",
    relatedEnTitle: "Character.AI alternative",
    relatedEnBody: "浏览器里的 18+ 无审查 AI 角色扮演。不用酒馆，不用 API Key。",
    relatedEnCta: "打开英文对比页 →",
    relatedZhTitle: "中文无审查 AI 角色扮演",
    relatedZhBody: "网页版不用酒馆。中文界面，精选 18+ 韩漫角色。",
    relatedZhCta: "打开中文说明页 →",
    contactTitle: "联系我们",
    contactSub: "有问题或建议，欢迎写信。",
    supportTitle: "支持与反馈",
    supportBody: "需要帮助或想提建议，可以发邮件。",
    contactSupport: "联系支持",
    ctaTitle: "准备开始？",
    ctaBody: "先浏览精选约 80+ 角色，想聊再登录。仅限 18 岁及以上。",
    exploreCharacters: "浏览角色",
    createCharacter: "创建角色",
  },
};

const setMeta = (attr: "name" | "property", key: string, content: string) => {
  const selector = attr === "property" ? `meta[property="${key}"]` : `meta[name="${key}"]`;
  const existing = document.querySelector(selector);
  if (existing) {
    existing.setAttribute("content", content);
    return;
  }
  const tag = document.createElement("meta");
  tag.setAttribute(attr, key);
  tag.setAttribute("content", content);
  document.head.appendChild(tag);
};

const AboutPage = () => {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const copy = COPY[language];

  useEffect(() => {
    document.title = copy.seoTitle;
    setMeta("name", "description", copy.seoDescription);
    setMeta("property", "og:title", copy.ogTitle);
    setMeta("property", "og:description", copy.ogDescription);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:locale", language === "zh" ? "zh_CN" : "en_US");

    return () => {
      document.title = "YY Chat";
    };
  }, [copy, language]);

  return (
    <GlobalLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {copy.heroTitle}
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
            {copy.heroBody}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate("/characters")}
              size="lg"
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold px-8 py-3 shadow-lg hover:shadow-xl transition-all"
            >
              {copy.getStarted}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              onClick={() => navigate("/faq")}
              variant="outline"
              size="lg"
              className="border-primary/30 hover:bg-primary/10 px-8 py-3"
            >
              {copy.learnMore}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {copy.stats.map((stat) => (
            <Card key={stat.label} className="text-center bg-gradient-to-br from-background/50 to-accent/5 border-accent/20">
              <CardContent className="pt-6">
                <div className="text-2xl md:text-3xl font-bold text-primary mb-1">{stat.value}</div>
                <div className="font-semibold text-foreground mb-1">{stat.label}</div>
                <div className="text-sm text-muted-foreground">{stat.description}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <Target className="w-8 h-8 text-primary" />
              {copy.missionHeading}
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              {copy.missionSub}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Heart className="w-6 h-6" />
                  {copy.missionTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {copy.missionBody}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-accent/5 to-transparent border-accent/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-accent">
                  <Sparkles className="w-6 h-6" />
                  {copy.visionTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {copy.visionBody}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <CheckCircle className="w-8 h-8 text-primary" />
              {copy.featuresHeading}
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              {copy.featuresSub}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {copy.features.map((feature, index) => {
              const Icon = FEATURE_ICONS[index];
              return (
                <Card key={feature.title} className="group hover:shadow-lg transition-all duration-200 hover:border-primary/30 hover:bg-gradient-to-br hover:from-primary/5 hover:to-transparent">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="mb-16">
          <Card className="bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl flex items-center justify-center gap-2">
                <Zap className="w-7 h-7 text-primary" />
                {copy.techTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground text-lg mb-6 max-w-4xl mx-auto leading-relaxed">
                {copy.techBody}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {copy.badges.map((badge) => (
                  <Badge key={badge} variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    {badge}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <Star className="w-8 h-8 text-primary" />
              {copy.storyTitle}
            </h2>
          </div>

          <Card className="max-w-4xl mx-auto">
            <CardContent className="pt-8">
              <div className="prose prose-lg max-w-none text-muted-foreground leading-relaxed">
                {copy.story.map((paragraph) => (
                  <p key={paragraph} className="mb-6">
                    {paragraph}
                  </p>
                ))}
                <p className="text-center font-medium text-foreground">
                  {copy.storyClose}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">{copy.relatedTitle}</h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              {copy.relatedSub}
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
              <CardHeader>
                <CardTitle>
                  <Link to="/character-ai-alternative" className="hover:underline">
                    {copy.relatedEnTitle}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-3">
                  {copy.relatedEnBody}
                </p>
                <Link to="/character-ai-alternative" className="text-primary hover:underline">
                  {copy.relatedEnCta}
                </Link>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-accent/5 to-transparent border-accent/20">
              <CardHeader>
                <CardTitle>
                  <Link to="/zhongwen-wu-shencha" className="hover:underline">
                    {copy.relatedZhTitle}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-3">
                  {copy.relatedZhBody}
                </p>
                <Link to="/zhongwen-wu-shencha" className="text-primary hover:underline">
                  {copy.relatedZhCta}
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <Mail className="w-8 h-8 text-primary" />
              {copy.contactTitle}
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              {copy.contactSub}
            </p>
          </div>

          <Card className="text-center max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <Mail className="w-6 h-6 text-primary" />
                {copy.supportTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {copy.supportBody}
              </p>
              <Button
                onClick={() => window.open("mailto:support@YY Chat.com", "_blank")}
                variant="outline"
                className="border-primary/30 hover:bg-primary/10"
              >
                <Mail className="w-4 h-4 mr-2" />
                {copy.contactSupport}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Separator className="mb-8" />
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="pt-8">
              <h3 className="text-2xl font-bold mb-4">{copy.ctaTitle}</h3>
              <p className="text-muted-foreground mb-6">
                {copy.ctaBody}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => navigate("/characters")}
                  size="lg"
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold px-8"
                >
                  {copy.exploreCharacters}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  onClick={() => navigate("/create-character")}
                  variant="outline"
                  size="lg"
                  className="border-primary/30 hover:bg-primary/10 px-8"
                >
                  {copy.createCharacter}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default AboutPage;
