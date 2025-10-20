import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { 
  HelpCircle, 
  Search, 
  ChevronDown, 
  ThumbsUp, 
  ThumbsDown,
  Hash,
  MessageSquare,
  Shield,
  CreditCard,
  Users,
  Settings,
  Wrench
} from "lucide-react";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// FAQ Data Structure
interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  helpful?: number;
  notHelpful?: number;
}

interface FAQCategory {
  id: string;
  title: string;
  description: string;
  icon: any;
  items: FAQItem[];
}

// FAQ Content Data
const faqData: FAQCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Basic information about using our AI roleplay chat application",
    icon: MessageSquare,
    items: [
      {
        id: "what-is-app",
        question: "What is YY Chat?",
        answer: "YY Chat is an AI-powered roleplay chat application where you can engage in immersive conversations with various AI characters. Each character has unique personalities, backstories, and conversation styles to provide engaging and personalized chat experiences.",
        category: "getting-started",
        tags: ["basics", "overview", "introduction"]
      },
      {
        id: "how-to-start",
        question: "How do I start chatting with a character?",
        answer: "To start chatting: 1) Browse the Characters page to find a character you like, 2) Click on their card to view details, 3) Click 'Start Chat' to begin a conversation. You can also create your own custom characters in the Character Creation section.",
        category: "getting-started",
        tags: ["chat", "start", "characters"]
      },
      {
        id: "account-required",
        question: "Do I need an account to use the app?",
        answer: "You can browse characters without an account, but you'll need to create a free account to start chatting, create custom characters, and access your chat history. You can sign up with email or use Google sign-in.",
        category: "getting-started",
        tags: ["account", "registration", "authentication"]
      }
    ]
  },
  {
    id: "account-management",
    title: "Account Management",
    description: "Managing your account, profile, and authentication",
    icon: Users,
    items: [
      {
        id: "reset-password",
        question: "How do I reset my password?",
        answer: "To reset your password: 1) Go to the login page, 2) Click 'Forgot Password?', 3) Enter your email address, 4) Check your email for a reset link, 5) Follow the link to create a new password.",
        category: "account-management",
        tags: ["password", "reset", "email"]
      },
      {
        id: "change-email",
        question: "How can I change my email address?",
        answer: "Currently, email changes must be requested through our support team. Please contact us with your current email and the new email you'd like to use. We're working on adding self-service email changes in a future update.",
        category: "account-management",
        tags: ["email", "change", "support"]
      },
      {
        id: "delete-account",
        question: "How do I delete my account?",
        answer: "To delete your account, go to Settings > Account Settings and click 'Delete Account'. This will permanently remove all your data including chats, custom characters, and token balance. This action cannot be undone.",
        category: "account-management",
        tags: ["delete", "account", "data"]
      }
    ]
  },
  {
    id: "tokens-billing",
    title: "Tokens & Billing",
    description: "Understanding our token system and payment options",
    icon: CreditCard,
    items: [
      {
        id: "what-are-tokens",
        question: "What are tokens and how do they work?",
        answer: "Tokens are our virtual currency used to power AI conversations. Each AI message response costs 1 token. You can purchase tokens in packages: Starter (100 tokens/$5), Standard (500 tokens/$20), or Premium (1500 tokens/$50). Tokens never expire.",
        category: "tokens-billing",
        tags: ["tokens", "currency", "pricing"]
      },
      {
        id: "purchase-tokens",
        question: "How do I purchase tokens?",
        answer: "To buy tokens: 1) Go to the Payment page in your account, 2) Choose a token package, 3) Complete payment with Stripe (we accept major credit cards), 4) Tokens are added to your account immediately after successful payment.",
        category: "tokens-billing",
        tags: ["purchase", "payment", "stripe"]
      },
      {
        id: "refund-policy",
        question: "What's your refund policy for tokens?",
        answer: "We offer refunds for unused tokens within 30 days of purchase. Refund requests can be made through our support team. Partially used token packages are eligible for prorated refunds. Refunds are processed back to the original payment method.",
        category: "tokens-billing",
        tags: ["refund", "policy", "unused"]
      }
    ]
  },
  {
    id: "character-creation",
    title: "Character Creation",
    description: "Creating and customizing your own AI characters",
    icon: Users,
    items: [
      {
        id: "create-character",
        question: "How do I create a custom character?",
        answer: "To create a character: 1) Go to 'Create Character' page, 2) Fill in the character's name, personality traits, and backstory, 3) Upload a character image (optional), 4) Set personality settings like friendliness and conversation style, 5) Save your character. It will be available in your character list.",
        category: "character-creation",
        tags: ["create", "custom", "personality"]
      },
      {
        id: "image-requirements",
        question: "What are the requirements for character images?",
        answer: "Character images should be: JPG, PNG, or WebP format, maximum 5MB file size, recommended resolution 512x512 pixels, and appropriate for the platform (no explicit content). Images are automatically resized and optimized for display.",
        category: "character-creation",
        tags: ["image", "requirements", "upload"]
      },
      {
        id: "character-personality",
        question: "How do personality settings affect conversations?",
        answer: "Personality settings influence how your character responds: Friendliness affects warmth and approachability, Creativity influences imagination in responses, and NSFW level controls content appropriateness. These settings help create unique conversation experiences.",
        category: "character-creation",
        tags: ["personality", "settings", "behavior"]
      }
    ]
  },
  {
    id: "chat-features",
    title: "Chat Features",
    description: "Understanding conversation features and AI behavior",
    icon: MessageSquare,
    items: [
      {
        id: "ai-conversation",
        question: "How does the AI conversation work?",
        answer: "Our AI uses Google's Gemini model to generate responses based on the character's personality and conversation history. The AI maintains context throughout the conversation and adapts to your communication style while staying in character.",
        category: "chat-features",
        tags: ["ai", "conversation", "gemini"]
      },
      {
        id: "conversation-memory",
        question: "Does the AI remember previous conversations?",
        answer: "Yes, the AI maintains conversation history within each chat session. However, each new chat starts fresh. We're working on enhanced memory features that will allow characters to remember across different chat sessions.",
        category: "chat-features",
        tags: ["memory", "history", "context"]
      },
      {
        id: "nsfw-settings",
        question: "What are NSFW content settings?",
        answer: "NSFW (Not Safe For Work) settings control the level of mature content in conversations. You can set your preference from Conservative (no mature content) to Liberal (adult themes allowed). This helps ensure conversations match your comfort level.",
        category: "chat-features",
        tags: ["nsfw", "content", "mature"]
      }
    ]
  },
  {
    id: "privacy-safety",
    title: "Privacy & Safety",
    description: "Data protection, content moderation, and safety measures",
    icon: Shield,
    items: [
      {
        id: "data-privacy",
        question: "How is my data protected?",
        answer: "We protect your data with industry-standard encryption, secure data transmission (HTTPS), and limited data retention policies. We don't share personal information with third parties except as required by law. Your conversations are stored securely and accessible only to you.",
        category: "privacy-safety",
        tags: ["privacy", "data", "encryption"]
      },
      {
        id: "content-moderation",
        question: "How do you moderate content?",
        answer: "We use automated content filtering and community reporting to maintain a safe environment. Inappropriate content is flagged and reviewed. Users who violate our guidelines may have their accounts suspended or terminated.",
        category: "privacy-safety",
        tags: ["moderation", "content", "safety"]
      },
      {
        id: "report-content",
        question: "How do I report inappropriate content?",
        answer: "To report inappropriate content: 1) Click the report button (flag icon) in the chat or character card, 2) Select the reason for reporting, 3) Provide additional details if needed, 4) Submit the report. Our team reviews all reports within 24 hours.",
        category: "privacy-safety",
        tags: ["report", "inappropriate", "flag"]
      }
    ]
  },
  {
    id: "technical-support",
    title: "Technical Support",
    description: "Troubleshooting and technical assistance",
    icon: Wrench,
    items: [
      {
        id: "browser-compatibility",
        question: "Which browsers are supported?",
        answer: "Our app works best on modern browsers: Chrome 90+, Firefox 88+, Safari 14+, and Edge 90+. For the best experience, we recommend using the latest version of Chrome or Firefox with JavaScript enabled.",
        category: "technical-support",
        tags: ["browser", "compatibility", "requirements"]
      },
      {
        id: "performance-issues",
        question: "The app is running slowly, what can I do?",
        answer: "To improve performance: 1) Clear your browser cache and cookies, 2) Disable unnecessary browser extensions, 3) Close other tabs or applications, 4) Check your internet connection, 5) Try refreshing the page. If issues persist, contact support.",
        category: "technical-support",
        tags: ["performance", "slow", "optimization"]
      },
      {
        id: "contact-support",
        question: "How do I contact technical support?",
        answer: "For technical support: 1) Check this FAQ first, 2) Visit our GitHub issues page for known problems, 3) Email us at support@YY Chat.com with details about your issue, 4) Include your browser version, operating system, and steps to reproduce the problem.",
        category: "technical-support",
        tags: ["support", "contact", "help"]
      }
    ]
  }
];

const FAQPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filteredData, setFilteredData] = useState(faqData);
  const [, navigate] = useLocation();

  // Filter FAQ data based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredData(faqData);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = faqData.map(category => ({
      ...category,
      items: category.items.filter(item => 
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.toLowerCase().includes(query))
      )
    })).filter(category => category.items.length > 0);

    setFilteredData(filtered);
  }, [searchQuery]);

  // Handle URL anchors
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const element = document.getElementById(hash.substring(1));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId === selectedCategory ? null : categoryId);
    const element = document.getElementById(categoryId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleFeedback = (itemId: string, helpful: boolean) => {
    // TODO: Implement feedback tracking
    console.log(`Feedback for ${itemId}: ${helpful ? 'helpful' : 'not helpful'}`);
  };

  const copyLinkToClipboard = (itemId: string) => {
    const url = `${window.location.origin}/faq#${itemId}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <GlobalLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <HelpCircle className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Frequently Asked Questions</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Find answers to common questions about our AI roleplay chat application. 
            Can't find what you're looking for? Contact our support team.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search FAQ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {searchQuery && (
            <p className="text-center text-sm text-muted-foreground mt-2">
              Found {filteredData.reduce((acc, cat) => acc + cat.items.length, 0)} results
            </p>
          )}
        </div>

        {/* Category Navigation */}
        {!searchQuery && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-center">Browse by Category</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {faqData.map((category) => {
                const Icon = category.icon;
                return (
                  <Button
                    key={category.id}
                    variant="outline"
                    className="h-auto p-3 flex flex-col items-center gap-2 hover:bg-primary/10 hover:border-primary/30 transition-colors"
                    onClick={() => handleCategoryClick(category.id)}
                  >
                    <Icon className="w-5 h-5 text-primary" />
                    <span className="text-xs font-medium text-center">{category.title}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* FAQ Content */}
        <div className="space-y-6">
          {filteredData.map((category) => (
            <Card key={category.id} id={category.id} className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 border-b border-border">
                <CardTitle className="flex items-center gap-2">
                  <category.icon className="w-5 h-5 text-primary" />
                  {category.title}
                  <Badge variant="secondary">{category.items.length}</Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{category.description}</p>
              </CardHeader>
              <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                  {category.items.map((item) => (
                    <AccordionItem key={item.id} value={item.id} className="border-b last:border-b-0">
                      <AccordionTrigger className="px-6 py-4 text-left hover:bg-accent/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.question}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-4">
                        <div className="prose prose-sm max-w-none text-muted-foreground">
                          <p>{item.answer}</p>
                        </div>
                        
                        {/* Feedback Section */}
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Was this helpful?</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 hover:bg-green-500/20 hover:text-green-400"
                              onClick={() => handleFeedback(item.id, true)}
                            >
                              <ThumbsUp className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 hover:bg-red-500/20 hover:text-red-400"
                              onClick={() => handleFeedback(item.id, false)}
                            >
                              <ThumbsDown className="w-4 h-4" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 hover:bg-primary/20 hover:text-primary"
                            onClick={() => copyLinkToClipboard(item.id)}
                          >
                            <Hash className="w-4 h-4" />
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* No Results */}
        {filteredData.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <HelpCircle className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No results found</h3>
            <p className="text-muted-foreground mb-4">
              We couldn't find any FAQ items matching "{searchQuery}"
            </p>
            <Button 
              variant="outline" 
              onClick={() => setSearchQuery("")}
            >
              Clear Search
            </Button>
          </div>
        )}

        {/* Contact Support */}
        <div className="mt-12 text-center">
          <Separator className="mb-6" />
          <h3 className="text-lg font-semibold mb-2">Still need help?</h3>
          <p className="text-muted-foreground mb-4">
            Can't find the answer you're looking for? Our support team is here to help.
          </p>
          <Button 
            onClick={() => window.open('mailto:support@YY Chat.com', '_blank')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 shadow-md hover:shadow-lg transition-all"
          >
            Contact Support
          </Button>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default FAQPage;