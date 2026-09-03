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

const PAGE_URL = "https://yychat.ai/character-ai-alternative";
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

const CharacterAiAlternativePage = () => {
  const [, navigate] = useLocation();

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
    };
  }, []);

  const comparisons = [
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
              Character.AI Alternative for Uncensored AI Roleplay
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-6 leading-relaxed">
            YY Chat (歪歪) at{" "}
            <a href="https://yychat.ai" className="text-primary hover:underline">
              yychat.ai
            </a>{" "}
            is a browser-based 18+ AI roleplay app. Talk with curated Korean manhwa-inspired
            characters without installing SillyTavern or pasting an API key.
          </p>
          <p className="text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
            Character pages are public. Starting a chat still needs a free login.
            We are not YY Live, YY.com, JOYY, or 易歪歪.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              18+ only
            </Badge>
            <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
              80+ curated characters
            </Badge>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              No SillyTavern
            </Badge>
            <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
              No API key
            </Badge>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate("/characters")}
              size="lg"
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold px-8 py-3 shadow-lg hover:shadow-xl transition-all"
            >
              Browse characters
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              onClick={() => navigate("/discover")}
              variant="outline"
              size="lg"
              className="border-primary/30 hover:bg-primary/10 px-8 py-3"
            >
              Discover
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
              中文无审查页面
            </Link>
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {[
            { label: "Catalog", value: "80+", description: "Curated, not the largest library" },
            { label: "Age", value: "18+", description: "Fictional adult characters only" },
            { label: "Setup", value: "Web", description: "No tavern, no API key" },
            { label: "UI", value: "中文", description: "Chinese-first, also English" },
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
              What YY Chat is — and is not
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <CheckCircle className="w-6 h-6" />
                  Honest facts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground leading-relaxed">
                <p>YY Chat / 歪歪 is a hosted web app for 18+ AI roleplay with Korean manhwa-inspired characters.</p>
                <p>About 80+ curated characters. Chinese-first interface, English is also available.</p>
                <p>No SillyTavern install. No API key. You open the site and browse.</p>
                <p>Public character pages do not require login. Sending messages does.</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-accent/5 to-transparent border-accent/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-accent">
                  <XCircle className="w-6 h-6" />
                  We do not claim
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground leading-relaxed">
                <p>We are not the largest character library. SpicyChat is bigger. Character.AI is bigger.</p>
                <p>We are not YY Live, YY.com, JOYY, or 易歪歪. Different product, different company.</p>
                <p>We are not a local tavern stack. If you want full local control, SillyTavern is the better fit.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <Users className="w-8 h-8 text-primary" />
              Character.AI vs SillyTavern vs YY Chat
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              Different tools. Pick the one that matches how you actually want to chat.
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
          <p className="text-sm text-muted-foreground text-center mt-6 max-w-3xl mx-auto">
            星野 and Talkie are more mainstream Chinese chat/voice products with heavier moderation.
            YY Chat is a smaller 18+ roleplay site, not a social app.
          </p>
        </div>

        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <MessageSquare className="w-8 h-8 text-primary" />
              Public character pages
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              These profiles are public — no login required to read them. Chat still needs an account.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { id: "4", label: "Character 4" },
              { id: "10", label: "Character 10" },
              { id: "11", label: "Character 11" },
              { id: "12", label: "Character 12" },
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
              See the full curated catalog
            </Link>
          </p>
        </div>

        <div className="mb-16">
          <Card className="bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl flex items-center justify-center gap-2">
                <Zap className="w-7 h-7 text-primary" />
                How it works
              </CardTitle>
            </CardHeader>
            <CardContent className="max-w-3xl mx-auto text-muted-foreground leading-relaxed space-y-3">
              <p>Open the web app. Browse public characters. Log in when you want to send a message.</p>
              <p>
                No local install, no model picker, no API key field. If you need that level of control,
                use SillyTavern instead.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  Web app
                </Badge>
                <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
                  Adult 18+
                </Badge>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  Korean manhwa-inspired
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <Shield className="w-8 h-8 text-primary" />
              FAQ
            </h2>
          </div>
          <div className="space-y-4 max-w-4xl mx-auto">
            {[
              {
                q: "Is this uncensored?",
                a: "YY Chat is built for 18+ fictional adult roleplay. It is not a kids' product and not a heavily filtered mainstream chatbot. Always follow the terms of use.",
              },
              {
                q: "How many characters?",
                a: "About 80+ curated Korean manhwa-inspired characters. We do not claim thousands, and we are not the largest library.",
              },
              {
                q: "English or Chinese?",
                a: "The UI is Chinese-first and also supports English. This page is the English comparison; there is a Chinese page for 中文无审查 queries.",
              },
              {
                q: "Where are the legal pages?",
                a: "Privacy policy and terms of use are linked below.",
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
              About
            </Link>
            {" · "}
            <Link to="/faq" className="text-primary hover:underline">
              FAQ
            </Link>
            {" · "}
            <Link to="/privacy-policy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            {" · "}
            <Link to="/terms-of-use" className="text-primary hover:underline">
              Terms of Use
            </Link>
          </p>
          <p className="text-xs text-muted-foreground mb-8">
            Not affiliated with YY Live, YY.com, JOYY, or 易歪歪.
          </p>
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="pt-8">
              <h3 className="text-2xl font-bold mb-4">Start in the browser</h3>
              <p className="text-muted-foreground mb-6">
                Browse the public catalog, then log in when you want to chat.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => navigate("/characters")}
                  size="lg"
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold px-8"
                >
                  Explore characters
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  onClick={() => navigate("/zhongwen-wu-shencha")}
                  variant="outline"
                  size="lg"
                  className="border-primary/30 hover:bg-primary/10 px-8"
                >
                  <Globe className="w-4 h-4 mr-2" />
                  中文无审查
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
