import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { 
  Info, 
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

const AboutPage = () => {
  const [, navigate] = useLocation();

  // Set SEO meta tags
  useEffect(() => {
    document.title = "关于 YY Chat 歪歪｜18+ 韩漫 AI 角色扮演（非 YY 直播）";
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", "YY Chat（歪歪，yychat.ai）是面向 18+ 的网页版 AI 角色扮演，和精选韩国成人漫画角色聊天。与 YY 直播、YY.com、易歪歪无关。");
    } else {
      const newMetaDescription = document.createElement("meta");
      newMetaDescription.name = "description";
      newMetaDescription.content = "YY Chat（歪歪，yychat.ai）是面向 18+ 的网页版 AI 角色扮演，和精选韩国成人漫画角色聊天。与 YY 直播、YY.com、易歪歪无关。";
      document.head.appendChild(newMetaDescription);
    }

    // Add Open Graph tags
    const addMetaTag = (property: string, content: string) => {
      const existingTag = document.querySelector(`meta[property="${property}"]`);
      if (existingTag) {
        existingTag.setAttribute("content", content);
      } else {
        const newTag = document.createElement("meta");
        newTag.setAttribute("property", property);
        newTag.content = content;
        document.head.appendChild(newTag);
      }
    };

    addMetaTag("og:title", "关于 YY Chat 歪歪｜不是 YY 直播");
    addMetaTag("og:description", "18+ 网页版 AI 角色扮演。韩漫角色，中文界面，不用酒馆和 API Key。与 YY 直播无关。");
    addMetaTag("og:type", "website");
    
    // Cleanup function to restore original title
    return () => {
      document.title = "YY Chat";
    };
  }, []);

  const handleGetStarted = () => {
    navigate("/characters");
  };

  const handleLearnMore = () => {
    navigate("/faq");
  };

  const features = [
    {
      icon: MessageSquare,
      title: "Advanced AI Conversations",
      description: "Powered by Google Gemini for natural, context-aware conversations that adapt to your communication style."
    },
    {
      icon: Users,
      title: "Custom Character Creation",
      description: "Design unique AI characters with distinct personalities, backstories, and conversation styles."
    },
    {
      icon: Shield,
      title: "Privacy & Safety First",
      description: "Industry-standard encryption, secure data transmission, and comprehensive content moderation."
    },
    {
      icon: Zap,
      title: "Token-Based System",
      description: "Fair, transparent pricing with tokens that never expire. Only pay for what you use."
    },
    {
      icon: Sparkles,
      title: "Immersive Roleplay",
      description: "Experience rich, engaging conversations with AI characters that maintain context and personality."
    },
    {
      icon: Heart,
      title: "Community-Driven",
      description: "Built by creators, for creators. Share characters and discover amazing conversations."
    }
  ];

  const stats = [
    { label: "精选角色", value: "80+", description: "韩国 18+ 漫画灵感" },
    { label: "年龄限制", value: "18+", description: "仅虚构成人角色" },
    { label: "打开方式", value: "网页", description: "不用酒馆，不用 API Key" },
    { label: "界面语言", value: "中文", description: "也支持英文" }
  ];

  return (
    <GlobalLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              About YY Chat
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
            YY Chat（歪歪）是面向 18 岁及以上用户的网页版 AI 角色扮演。
            和精选韩国成人漫画角色聊沉浸式剧情。中文界面，网页即开。
            我们不是 YY 直播、YY.com、JOYY，也不是易歪歪。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleGetStarted}
              size="lg"
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold px-8 py-3 shadow-lg hover:shadow-xl transition-all"
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              onClick={handleLearnMore}
              variant="outline"
              size="lg"
              className="border-primary/30 hover:bg-primary/10 px-8 py-3"
            >
              Learn More
            </Button>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, index) => (
            <Card key={index} className="text-center bg-gradient-to-br from-background/50 to-accent/5 border-accent/20">
              <CardContent className="pt-6">
                <div className="text-2xl md:text-3xl font-bold text-primary mb-1">{stat.value}</div>
                <div className="font-semibold text-foreground mb-1">{stat.label}</div>
                <div className="text-sm text-muted-foreground">{stat.description}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Mission & Vision Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <Target className="w-8 h-8 text-primary" />
              Our Mission & Vision
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              Empowering creativity and human connection through advanced AI technology
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Heart className="w-6 h-6" />
                  Our Mission
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  To democratize creative storytelling and meaningful AI interactions by providing 
                  an intuitive platform where anyone can create, share, and experience rich 
                  conversational relationships with AI characters that feel authentic and engaging.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-accent/5 to-transparent border-accent/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-accent">
                  <Sparkles className="w-6 h-6" />
                  Our Vision
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  To become the leading platform for AI-human creative collaboration, fostering 
                  a global community where imagination meets technology, and where every conversation 
                  opens new possibilities for storytelling, learning, and human connection.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Key Features Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <CheckCircle className="w-8 h-8 text-primary" />
              What Makes Us Special
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              Cutting-edge technology meets intuitive design to create the ultimate AI conversation experience
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-200 hover:border-primary/30 hover:bg-gradient-to-br hover:from-primary/5 hover:to-transparent">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Technology Section */}
        <div className="mb-16">
          <Card className="bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl flex items-center justify-center gap-2">
                <Zap className="w-7 h-7 text-primary" />
                Powered by Advanced AI
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground text-lg mb-6 max-w-4xl mx-auto leading-relaxed">
                Our platform leverages Google's state-of-the-art Gemini AI model to deliver 
                natural, context-aware conversations that adapt to your communication style. 
                Combined with our proprietary character enhancement system, every interaction 
                feels authentic and engaging.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  Google Gemini AI
                </Badge>
                <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
                  Context-Aware Responses
                </Badge>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  Advanced Character Enhancement
                </Badge>
                <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
                  Real-time Conversations
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Company Story Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <Star className="w-8 h-8 text-primary" />
              Our Story
            </h2>
          </div>
          
          <Card className="max-w-4xl mx-auto">
            <CardContent className="pt-8">
              <div className="prose prose-lg max-w-none text-muted-foreground leading-relaxed">
                <p className="mb-6">
                  YY Chat emerged from the vision of creating more engaging AI conversations. 
                  We noticed that most AI chat platforms offered bland, generic experiences that felt robotic 
                  and impersonal, lacking the depth and personality that makes conversations truly captivating.
                </p>
                <p className="mb-6">
                  Our mission became clear: to build a platform where every AI character has a unique personality, 
                  distinctive conversation style, and the ability to create immersive roleplay experiences. 
                  We wanted to give users the freedom to explore their creativity through meaningful AI interactions 
                  that feel authentic and engaging.
                </p>
                <p className="mb-6">
                  Today, YY Chat is home to thousands of unique characters and countless engaging conversations. 
                  Whether you're seeking companionship, creative inspiration, or simply want to explore different 
                  personalities and scenarios, our platform provides a safe, immersive space for unlimited AI interactions.
                </p>
                <p className="text-center font-medium text-foreground">
                  Welcome to the future of AI conversation. Welcome to YY Chat.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Related public landing pages */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Related pages</h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              Straight comparisons for people who searched a Character.AI alternative
              or 中文无审查网页版.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
              <CardHeader>
                <CardTitle>
                  <Link to="/character-ai-alternative" className="hover:underline">
                    Character.AI alternative
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-3">
                  18+ uncensored AI roleplay in the browser. No SillyTavern, no API key.
                </p>
                <Link to="/character-ai-alternative" className="text-primary hover:underline">
                  Read the English comparison →
                </Link>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-accent/5 to-transparent border-accent/20">
              <CardHeader>
                <CardTitle>
                  <Link to="/zhongwen-wu-shencha" className="hover:underline">
                    中文无审查 AI 角色扮演
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-3">
                  网页版不用酒馆。中文界面，精选 18+ 韩漫角色。
                </p>
                <Link to="/zhongwen-wu-shencha" className="text-primary hover:underline">
                  打开中文说明页 →
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Contact & Support Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <Mail className="w-8 h-8 text-primary" />
              Get In Touch
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              Have questions, feedback, or just want to say hello? We'd love to hear from you.
            </p>
          </div>

          <Card className="text-center max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <Mail className="w-6 h-6 text-primary" />
                Support & Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Need help or have suggestions? Our support team is here to assist you.
              </p>
              <Button 
                onClick={() => window.open('mailto:support@YY Chat.com', '_blank')}
                variant="outline"
                className="border-primary/30 hover:bg-primary/10"
              >
                <Mail className="w-4 h-4 mr-2" />
                Contact Support
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action Section */}
        <div className="text-center">
          <Separator className="mb-8" />
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="pt-8">
              <h3 className="text-2xl font-bold mb-4">Ready to Start Your AI Adventure?</h3>
              <p className="text-muted-foreground mb-6">
                Join thousands of creators and storytellers already exploring the possibilities 
                of AI-powered conversations. Your next great story is just a chat away.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  onClick={handleGetStarted}
                  size="lg"
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold px-8"
                >
                  Explore Characters
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button 
                  onClick={() => navigate("/create-character")}
                  variant="outline"
                  size="lg"
                  className="border-primary/30 hover:bg-primary/10 px-8"
                >
                  Create Character
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