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

const PAGE_URL = "https://yychat.ai/zhongwen-wu-shencha";
const TITLE = "中文无审查 AI 角色扮演｜网页版不用酒馆｜歪歪 YY Chat";
const DESCRIPTION =
  "歪歪（YY Chat，yychat.ai）是面向 18+ 的中文无审查 AI 角色扮演网页。不用酒馆、不用 API Key。精选 80+ 韩国成人漫画角色。角色页公开，聊天需登录。与 YY 直播、易歪歪无关。";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${PAGE_URL}#page`,
      url: PAGE_URL,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: "zh-CN",
      isPartOf: { "@id": "https://yychat.ai/#app" },
    },
    {
      "@type": "FAQPage",
      "@id": `${PAGE_URL}#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "歪歪是中文无审查 AI 角色扮演吗？",
          acceptedAnswer: {
            "@type": "Answer",
            text: "是。YY Chat（歪歪，yychat.ai）是面向 18 岁及以上用户的网页版 AI 角色扮演，中文界面，精选韩国成人漫画风格角色。不是体量最大的角色库。",
          },
        },
        {
          "@type": "Question",
          name: "要自己搭酒馆或填写 API Key 吗？",
          acceptedAnswer: {
            "@type": "Answer",
            text: "不用。打开网页即可浏览。不需要安装 SillyTavern，也不用自己填 API Key。",
          },
        },
        {
          "@type": "Question",
          name: "一定要登录吗？",
          acceptedAnswer: {
            "@type": "Answer",
            text: "角色页公开可看。开始聊天需要免费登录。",
          },
        },
        {
          "@type": "Question",
          name: "这是 YY 直播或易歪歪吗？",
          acceptedAnswer: {
            "@type": "Answer",
            text: "不是。歪歪（yychat.ai）与 YY 直播、YY.com、JOYY、易歪歪均无关联。",
          },
        },
      ],
    },
  ],
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

const ZhongwenWuShenchaPage = () => {
  const [, navigate] = useLocation();

  useEffect(() => {
    document.title = TITLE;
    setMeta("name", "description", DESCRIPTION);
    setMeta("name", "robots", "index,follow");
    setMeta("property", "og:title", TITLE);
    setMeta("property", "og:description", DESCRIPTION);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:url", PAGE_URL);
    setMeta("property", "og:locale", "zh_CN");
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

    const existing = document.getElementById("seo-jsonld-zhongwen-wu-shencha");
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "seo-jsonld-zhongwen-wu-shencha";
    script.text = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    return () => {
      document.title = "YY Chat";
      script.remove();
    };
  }, []);

  const comparisons = [
    {
      name: "Character.AI",
      points: [
        "角色库很大，偏英文主流产品",
        "成人向角色扮演过滤更严",
        "不是中文优先的网页体验",
      ],
    },
    {
      name: "星野 / Talkie",
      points: [
        "更偏大众社交或语音陪伴",
        "审核更严，不适合当作无审查角色扮演",
        "和韩漫向 18+ 网页站不是同一类产品",
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
  ];

  return (
    <GlobalLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              中文无审查 AI 角色扮演
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-6 leading-relaxed">
            歪歪（YY Chat）是面向 18 岁及以上用户的网页版 AI 角色扮演。中文界面，精选韩国成人漫画风格角色。
            不用自己搭酒馆，也不用填写 API Key。官网：{" "}
            <a href="https://yychat.ai" className="text-primary hover:underline">
              yychat.ai
            </a>
            。
          </p>
          <p className="text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
            角色页公开可看；开始聊天需要登录。我们不是 YY 直播、YY.com、JOYY，也不是易歪歪。
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              仅 18+
            </Badge>
            <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
              精选 80+ 角色
            </Badge>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              网页版不用酒馆
            </Badge>
            <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
              不用 API Key
            </Badge>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate("/characters")}
              size="lg"
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold px-8 py-3 shadow-lg hover:shadow-xl transition-all"
            >
              浏览角色
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              onClick={() => navigate("/discover")}
              variant="outline"
              size="lg"
              className="border-primary/30 hover:bg-primary/10 px-8 py-3"
            >
              发现
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
            <Link to="/character-ai-alternative" className="text-primary hover:underline">
              Character.AI alternative
            </Link>
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {[
            { label: "精选角色", value: "80+", description: "韩国 18+ 漫画灵感，不是最大库" },
            { label: "年龄限制", value: "18+", description: "仅虚构成人角色" },
            { label: "打开方式", value: "网页", description: "不用酒馆，不用 API Key" },
            { label: "界面语言", value: "中文", description: "也支持英文" },
          ].map((stat) => (
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
              这是什么，不是什么
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <CheckCircle className="w-6 h-6" />
                  可以直接说的事实
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground leading-relaxed">
                <p>歪歪 / YY Chat 是网页版 18+ AI 角色扮演，角色偏韩国成人漫画风格。</p>
                <p>目前是精选约 80+ 个角色。中文界面为主，也有英文。</p>
                <p>不用安装 SillyTavern，不用自己填 API Key。</p>
                <p>角色页公开；发消息需要登录。</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-accent/5 to-transparent border-accent/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-accent">
                  <XCircle className="w-6 h-6" />
                  我们不会这样写
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground leading-relaxed">
                <p>不说自己是最大角色库。SpicyChat 和 Character.AI 的库都更大。</p>
                <p>不是 YY 直播、YY.com、JOYY、易歪歪。</p>
                <p>如果你要完全本地可控的前端，酒馆更合适，那不是我们这条产品线。</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <Users className="w-8 h-8 text-primary" />
              对比 Character.AI、星野 / Talkie、酒馆
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              需求不同：要网页即开的 18+ 中文角色扮演，还是要本地酒馆，还是要大众语音社交。
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {comparisons.map((item) => (
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
          <Card className="mt-6 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">歪歪怎么放进这个对比</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground leading-relaxed space-y-2">
              <p>打开网页就能浏览。中文优先。面向 18+ 虚构成人剧情。精选韩漫向角色，体量不大。</p>
              <p>不跟 SpicyChat 比库容，也不跟星野 / Talkie 比社交语音。</p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <MessageSquare className="w-8 h-8 text-primary" />
              公开角色页（不用登录也能看）
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              下面是站点地图里的真实角色地址。看资料不用登录；开始聊天需要账号。
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { id: "4", label: "角色 4" },
              { id: "10", label: "角色 10" },
              { id: "11", label: "角色 11" },
              { id: "12", label: "角色 12" },
            ].map((item) => (
              <Link key={item.id} to={`/character/${item.id}`}>
                <Card className="h-full hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer">
                  <CardContent className="pt-6 text-center">
                    <div className="font-semibold mb-1">{item.label}</div>
                    <div className="text-sm text-primary">/character/{item.id}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <p className="text-center mt-6">
            <Link to="/characters" className="text-primary hover:underline">
              查看全部精选角色
            </Link>
          </p>
        </div>

        <div className="mb-16">
          <Card className="bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl flex items-center justify-center gap-2">
                <Zap className="w-7 h-7 text-primary" />
                怎么用
              </CardTitle>
            </CardHeader>
            <CardContent className="max-w-3xl mx-auto text-muted-foreground leading-relaxed space-y-3">
              <p>打开网页，浏览公开角色，想发消息时再登录。</p>
              <p>没有本地安装，没有模型选择器，也没有 API Key 输入框。需要那种控制权时，请用酒馆。</p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  网页版
                </Badge>
                <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
                  18+ 成人向
                </Badge>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  韩漫灵感角色
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <Shield className="w-8 h-8 text-primary" />
              常见问题
            </h2>
          </div>
          <div className="space-y-4 max-w-4xl mx-auto">
            {[
              {
                q: "所谓无审查是什么意思？",
                a: "这是给 18 岁及以上用户的虚构成人角色扮演网页，不是面向未成年人的产品，也不是以严格过滤器为主的大众聊天机器人。请遵守使用条款。",
              },
              {
                q: "有多少角色？",
                a: "精选约 80+ 个韩国成人漫画灵感角色。我们不会写成上千，也不会说自己是最大库。",
              },
              {
                q: "只有中文吗？",
                a: "界面中文优先，也支持英文。英文对比页见 Character.AI alternative。",
              },
              {
                q: "隐私条款在哪？",
                a: "法律页面是 /privacy-policy 和 /terms-of-use，见下方链接。",
              },
            ].map((item) => (
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
              关于
            </Link>
            {" · "}
            <Link to="/faq" className="text-primary hover:underline">
              常见问题
            </Link>
            {" · "}
            <Link to="/privacy-policy" className="text-primary hover:underline">
              隐私政策
            </Link>
            {" · "}
            <Link to="/terms-of-use" className="text-primary hover:underline">
              使用条款
            </Link>
          </p>
          <p className="text-xs text-muted-foreground mb-8">
            与 YY 直播、YY.com、JOYY、易歪歪无关。
          </p>
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="pt-8">
              <h3 className="text-2xl font-bold mb-4">直接在网页里开始</h3>
              <p className="text-muted-foreground mb-6">先看公开角色，想聊再登录。</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => navigate("/characters")}
                  size="lg"
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold px-8"
                >
                  浏览角色
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  onClick={() => navigate("/character-ai-alternative")}
                  variant="outline"
                  size="lg"
                  className="border-primary/30 hover:bg-primary/10 px-8"
                >
                  <Globe className="w-4 h-4 mr-2" />
                  English page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default ZhongwenWuShenchaPage;
