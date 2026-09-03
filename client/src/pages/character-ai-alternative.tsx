import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import GlobalLayout from "@/components/layout/GlobalLayout";
import {
  Sparkles,
  ArrowRight,
  CheckCircle,
  Shield,
  Globe,
  MessageSquare,
  XCircle,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLanguage, type Language } from "@/contexts/LanguageContext";

const PAGE_URL = "https://yychat.ai/character-ai-alternative";
const ZH_PAGE_URL = "https://yychat.ai/zhongwen-wu-shencha";
const TITLE = "Character.AI Alternative | Uncensored AI Roleplay (YY Chat)";
const DESCRIPTION =
  "YY Chat (歪歪, yychat.ai) is an 18+ Character.AI alternative for uncensored AI roleplay. Web app, no SillyTavern, no API key. 80+ curated Korean manhwa characters. Chat needs login; character pages are public.";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${PAGE_URL}#page`,
      url: PAGE_URL,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: "en",
      isPartOf: { "@id": "https://yychat.ai/#app" },
    },
    {
      "@type": "FAQPage",
      "@id": `${PAGE_URL}#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "Is YY Chat a Character.AI alternative?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, if you want 18+ uncensored AI roleplay in the browser. YY Chat (歪歪, yychat.ai) is a hosted web app with a curated catalog of Korean manhwa-inspired characters. It is not a giant library like Character.AI or SpicyChat.",
          },
        },
        {
          "@type": "Question",
          name: "Do I need SillyTavern or an API key?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. YY Chat is a web app. You do not install SillyTavern and you do not paste an API key.",
          },
        },
        {
          "@type": "Question",
          name: "Do I need to log in?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Character pages are public. Starting a chat still requires a free login.",
          },
        },
        {
          "@type": "Question",
          name: "Is YY Chat the same as YY Live or YY.com?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. YY Chat (歪歪) at yychat.ai is not YY Live, YY.com, JOYY, or 易歪歪.",
          },
        },
      ],
    },
  ],
};

const HREFLANG_ATTR = "data-yychat-hreflang";

const setHreflangLinks = () => {
  document.querySelectorAll(`link[${HREFLANG_ATTR}]`).forEach((el) => el.remove());
  const pairs = [
    { hreflang: "en", href: PAGE_URL },
    { hreflang: "zh-CN", href: ZH_PAGE_URL },
    { hreflang: "x-default", href: ZH_PAGE_URL },
  ];
  for (const pair of pairs) {
    const link = document.createElement("link");
    link.rel = "alternate";
    link.hreflang = pair.hreflang;
    link.href = pair.href;
    link.setAttribute(HREFLANG_ATTR, "1");
    document.head.appendChild(link);
  }
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

const COPY: Record<Language, {
  h1: string;
  heroP1: string;
  heroP2: string;
  badges: string[];
  browseCharacters: string;
  discover: string;
  altPageLink: string;
  stats: { label: string; value: string; description: string }[];
  whatTitle: string;
  honestTitle: string;
  honest: string[];
  notClaimTitle: string;
  notClaim: string[];
  compareTitle: string;
  compareSub: string;
  comparisons: { name: string; points: string[] }[];
  compareFoot: string;
  publicTitle: string;
  publicSub: string;
  characterLabel: string;
  fullCatalog: string;
  howTitle: string;
  howP1: string;
  howP2: string;
  howBadges: string[];
  faqTitle: string;
  faqs: { q: string; a: string }[];
  footerAbout: string;
  footerFaq: string;
  footerPrivacy: string;
  footerTerms: string;
  footerNotAffiliated: string;
  ctaTitle: string;
  ctaBody: string;
  explore: string;
  altCta: string;
}> = {
  en: {
    h1: "Character.AI Alternative for Uncensored AI Roleplay",
    heroP1: "YY Chat (歪歪) is a browser-based 18+ AI roleplay app. Talk with curated Korean manhwa-inspired characters without installing SillyTavern or pasting an API key. Official site:",
    heroP2: "Character pages are public. Starting a chat still needs a free login. We are not YY Live, YY.com, JOYY, or 易歪歪.",
    badges: ["18+ only", "80+ curated characters", "No SillyTavern", "No API key"],
    browseCharacters: "Browse characters",
    discover: "Discover",
    altPageLink: "中文无审查页面",
    stats: [
      { label: "Catalog", value: "80+", description: "Curated, not the largest library" },
      { label: "Age", value: "18+", description: "Fictional adult characters only" },
      { label: "Setup", value: "Web", description: "No tavern, no API key" },
      { label: "UI", value: "中文", description: "Chinese-first, also English" },
    ],
    whatTitle: "What YY Chat is — and is not",
    honestTitle: "Honest facts",
    honest: [
      "YY Chat / 歪歪 is a hosted web app for 18+ AI roleplay with Korean manhwa-inspired characters.",
      "About 80+ curated characters. Chinese-first interface, English is also available.",
      "No SillyTavern install. No API key. You open the site and browse.",
      "Public character pages do not require login. Sending messages does.",
    ],
    notClaimTitle: "We do not claim",
    notClaim: [
      "We are not the largest character library. SpicyChat is bigger. Character.AI is bigger.",
      "We are not YY Live, YY.com, JOYY, or 易歪歪. Different product, different company.",
      "We are not a local tavern stack. If you want full local control, SillyTavern is the better fit.",
    ],
    compareTitle: "Character.AI vs SillyTavern vs YY Chat",
    compareSub: "Different tools. Pick the one that matches how you actually want to chat.",
    comparisons: [
      {
        name: "Character.AI",
        points: [
          "Large catalog and mainstream brand",
          "Known for strict filters on adult roleplay",
          "English-first product",
        ],
      },
      {
        name: "SillyTavern",
        points: [
          "Powerful local frontend if you want to self-host",
          "You install it, pick a model, and supply an API key",
          "Not a one-click website",
        ],
      },
      {
        name: "YY Chat",
        points: [
          "Hosted web app at yychat.ai — no tavern, no API key",
          "Built for 18+ fictional roleplay",
          "80+ curated Korean manhwa-inspired characters, Chinese-first UI (English too)",
        ],
      },
    ],
    compareFoot: "星野 and Talkie are more mainstream Chinese chat/voice products with heavier moderation. YY Chat is a smaller 18+ roleplay site, not a social app.",
    publicTitle: "Public character pages",
    publicSub: "These profiles are public — no login required to read them. Chat still needs an account.",
    characterLabel: "Character",
    fullCatalog: "See the full curated catalog",
    howTitle: "How it works",
    howP1: "Open the web app. Browse public characters. Log in when you want to send a message.",
    howP2: "No local install, no model picker, no API key field. If you need that level of control, use SillyTavern instead.",
    howBadges: ["Web app", "Adult 18+", "Korean manhwa-inspired"],
    faqTitle: "FAQ",
    faqs: [
      { q: "Is this uncensored?", a: "YY Chat is built for 18+ fictional adult roleplay. It is not a kids' product and not a heavily filtered mainstream chatbot. Always follow the terms of use." },
      { q: "How many characters?", a: "About 80+ curated Korean manhwa-inspired characters. We do not claim thousands, and we are not the largest library." },
      { q: "English or Chinese?", a: "The UI is Chinese-first and also supports English. This URL is the English comparison; the Chinese page is for 中文无审查 queries. The language switcher changes the copy on this page too." },
      { q: "Where are the legal pages?", a: "Privacy policy and terms of use are linked below." },
    ],
    footerAbout: "About",
    footerFaq: "FAQ",
    footerPrivacy: "Privacy Policy",
    footerTerms: "Terms of Use",
    footerNotAffiliated: "Not affiliated with YY Live, YY.com, JOYY, or 易歪歪.",
    ctaTitle: "Start in the browser",
    ctaBody: "Browse the public catalog, then log in when you want to chat.",
    explore: "Explore characters",
    altCta: "中文无审查",
  },
  zh: {
    h1: "Character.AI 之外的无审查 AI 角色扮演",
    heroP1: "歪歪（YY Chat）是面向 18 岁及以上用户的网页版 AI 角色扮演。中文界面，精选韩国成人漫画风格角色。不用自己搭酒馆，也不用填写 API Key。官网：",
    heroP2: "角色页公开可看；开始聊天需要登录。我们不是 YY 直播、YY.com、JOYY，也不是易歪歪。",
    badges: ["仅 18+", "精选 80+ 角色", "网页版不用酒馆", "不用 API Key"],
    browseCharacters: "浏览角色",
    discover: "发现",
    altPageLink: "中文无审查页面",
    stats: [
      { label: "精选角色", value: "80+", description: "韩国 18+ 漫画灵感，不是最大库" },
      { label: "年龄限制", value: "18+", description: "仅虚构成人角色" },
      { label: "打开方式", value: "网页", description: "不用酒馆，不用 API Key" },
      { label: "界面语言", value: "中文", description: "也支持英文" },
    ],
    whatTitle: "这是什么，不是什么",
    honestTitle: "可以直接说的事实",
    honest: [
      "歪歪 / YY Chat 是网页版 18+ AI 角色扮演，角色偏韩国成人漫画风格。",
      "目前是精选约 80+ 个角色。中文界面为主，也有英文。",
      "不用安装 SillyTavern，不用自己填 API Key。",
      "角色页公开；发消息需要登录。",
    ],
    notClaimTitle: "我们不会这样写",
    notClaim: [
      "不说自己是最大角色库。SpicyChat 和 Character.AI 的库都更大。",
      "不是 YY 直播、YY.com、JOYY、易歪歪。",
      "如果你要完全本地可控的前端，酒馆更合适，那不是我们这条产品线。",
    ],
    compareTitle: "Character.AI、酒馆和歪歪怎么选",
    compareSub: "工具不一样。按你真正想怎么聊来选。",
    comparisons: [
      {
        name: "Character.AI",
        points: [
          "角色库很大，偏英文主流产品",
          "成人向角色扮演过滤更严",
          "不是中文优先的网页体验",
        ],
      },
      {
        name: "SillyTavern / 酒馆",
        points: [
          "功能强，但要自己部署、配模型",
          "需要自行准备 API Key",
          "不是打开网页就能聊",
        ],
      },
      {
        name: "YY Chat",
        points: [
          "yychat.ai 网页版——不用酒馆，不用 API Key",
          "面向 18+ 虚构成人角色扮演",
          "精选 80+ 韩漫灵感角色，中文优先（也有英文）",
        ],
      },
    ],
    compareFoot: "星野和 Talkie 更偏大众中文聊天/语音，审核更严。歪歪是小型 18+ 角色扮演站，不是社交应用。",
    publicTitle: "公开角色页（不用登录也能看）",
    publicSub: "下面是站点里的真实角色地址。看资料不用登录；开始聊天需要账号。",
    characterLabel: "角色",
    fullCatalog: "查看全部精选角色",
    howTitle: "怎么用",
    howP1: "打开网页，浏览公开角色，想发消息时再登录。",
    howP2: "没有本地安装，没有模型选择器，也没有 API Key 输入框。需要那种控制权时，请用酒馆。",
    howBadges: ["网页版", "18+ 成人向", "韩漫灵感角色"],
    faqTitle: "常见问题",
    faqs: [
      { q: "所谓无审查是什么意思？", a: "这是给 18 岁及以上用户的虚构成人角色扮演网页，不是面向未成年人的产品，也不是以严格过滤器为主的大众聊天机器人。请遵守使用条款。" },
      { q: "有多少角色？", a: "精选约 80+ 个韩国成人漫画灵感角色。我们不会写成上千，也不会说自己是最大库。" },
      { q: "只有中文吗？", a: "界面中文优先，也支持英文。这个网址是英文对比页；中文无审查说明在另一页。语言切换会改本页正文。" },
      { q: "隐私条款在哪？", a: "法律页面是 /privacy-policy 和 /terms-of-use，见下方链接。" },
    ],
    footerAbout: "关于",
    footerFaq: "常见问题",
    footerPrivacy: "隐私政策",
    footerTerms: "使用条款",
    footerNotAffiliated: "与 YY 直播、YY.com、JOYY、易歪歪无关。",
    ctaTitle: "直接在网页里开始",
    ctaBody: "先看公开角色，想聊再登录。",
    explore: "浏览角色",
    altCta: "中文无审查",
  },
};

const CharacterAiAlternativePage = () => {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const copy = COPY[language];

  useEffect(() => {
    document.title = TITLE;
    setMeta("name", "description", DESCRIPTION);
    setMeta("name", "robots", "index,follow");
    setMeta("property", "og:title", TITLE);
    setMeta("property", "og:description", DESCRIPTION);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:url", PAGE_URL);
    setMeta("property", "og:locale", "en_US");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", TITLE);
    setMeta("name", "twitter:description", DESCRIPTION);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = PAGE_URL;
    setHreflangLinks();

    const existing = document.getElementById("seo-jsonld-character-ai-alternative");
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "seo-jsonld-character-ai-alternative";
    script.text = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    return () => {
      document.title = "YY Chat";
      script.remove();
      document.querySelectorAll(`link[${HREFLANG_ATTR}]`).forEach((el) => el.remove());
    };
  }, []);

  return (
    <GlobalLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {copy.h1}
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-6 leading-relaxed">
            {copy.heroP1}{" "}
            <a href="https://yychat.ai" className="text-primary hover:underline">
              yychat.ai
            </a>
          </p>
          <p className="text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
            {copy.heroP2}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {copy.badges.map((badge) => (
              <Badge key={badge} variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                {badge}
              </Badge>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate("/characters")}
              size="lg"
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold px-8 py-3 shadow-lg hover:shadow-xl transition-all"
            >
              {copy.browseCharacters}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              onClick={() => navigate("/discover")}
              variant="outline"
              size="lg"
              className="border-primary/30 hover:bg-primary/10 px-8 py-3"
            >
              {copy.discover}
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            <Link to="/characters" className="text-primary hover:underline">
              /characters
            </Link>
            {" · "}
            <Link to="/discover" className="text-primary hover:underline">
              /discover
            </Link>
            {" · "}
            <Link to="/zhongwen-wu-shencha" className="text-primary hover:underline">
              {copy.altPageLink}
            </Link>
          </p>
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
              <CheckCircle className="w-8 h-8 text-primary" />
              {copy.whatTitle}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <CheckCircle className="w-6 h-6" />
                  {copy.honestTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground leading-relaxed">
                {copy.honest.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-accent/5 to-transparent border-accent/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-accent">
                  <XCircle className="w-6 h-6" />
                  {copy.notClaimTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground leading-relaxed">
                {copy.notClaim.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <Users className="w-8 h-8 text-primary" />
              {copy.compareTitle}
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              {copy.compareSub}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {copy.comparisons.map((item) => (
              <Card key={item.name} className="hover:border-primary/30 transition-colors">
                <CardHeader>
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-muted-foreground">
                    {item.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground text-center mt-6 max-w-3xl mx-auto">
            {copy.compareFoot}
          </p>
        </div>

        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <MessageSquare className="w-8 h-8 text-primary" />
              {copy.publicTitle}
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              {copy.publicSub}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {["4", "10", "11", "12"].map((id) => (
              <Link key={id} to={`/character/${id}`}>
                <Card className="h-full hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer">
                  <CardContent className="pt-6 text-center">
                    <div className="font-semibold mb-1">{copy.characterLabel} {id}</div>
                    <div className="text-sm text-primary">/character/{id}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <p className="text-center mt-6">
            <Link to="/characters" className="text-primary hover:underline">
              {copy.fullCatalog}
            </Link>
          </p>
        </div>

        <div className="mb-16">
          <Card className="bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl flex items-center justify-center gap-2">
                <Zap className="w-7 h-7 text-primary" />
                {copy.howTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="max-w-3xl mx-auto text-muted-foreground leading-relaxed space-y-3">
              <p>{copy.howP1}</p>
              <p>{copy.howP2}</p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {copy.howBadges.map((badge) => (
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
              <Shield className="w-8 h-8 text-primary" />
              {copy.faqTitle}
            </h2>
          </div>
          <div className="space-y-4 max-w-4xl mx-auto">
            {copy.faqs.map((item) => (
              <Card key={item.q}>
                <CardHeader>
                  <CardTitle className="text-lg">{item.q}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">{item.a}</CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="text-center mb-8">
          <Separator className="mb-8" />
          <p className="text-sm text-muted-foreground mb-4">
            YY Chat / 歪歪 ·{" "}
            <a href="https://yychat.ai" className="text-primary hover:underline">
              yychat.ai
            </a>
            {" · "}
            <Link to="/about" className="text-primary hover:underline">
              {copy.footerAbout}
            </Link>
            {" · "}
            <Link to="/faq" className="text-primary hover:underline">
              {copy.footerFaq}
            </Link>
            {" · "}
            <Link to="/privacy-policy" className="text-primary hover:underline">
              {copy.footerPrivacy}
            </Link>
            {" · "}
            <Link to="/terms-of-use" className="text-primary hover:underline">
              {copy.footerTerms}
            </Link>
          </p>
          <p className="text-xs text-muted-foreground mb-8">
            {copy.footerNotAffiliated}
          </p>
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
                  {copy.explore}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  onClick={() => navigate("/zhongwen-wu-shencha")}
                  variant="outline"
                  size="lg"
                  className="border-primary/30 hover:bg-primary/10 px-8"
                >
                  <Globe className="w-4 h-4 mr-2" />
                  {copy.altCta}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default CharacterAiAlternativePage;
