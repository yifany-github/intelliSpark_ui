import { Shield, Heart, Sparkles } from "lucide-react";
import { useState } from "react";

interface AgeGateProps {
  isOpen: boolean;
  onVerified: () => void;
  onDeclined: () => void;
}

type AgeGateLang = "en" | "zh";

const COPY: Record<AgeGateLang, {
  title: string;
  subtitle: string;
  body: string;
  highlight: string;
  yes: string;
  no: string;
  legalBefore: string;
  terms: string;
  legalAnd: string;
  privacy: string;
  ssl: string;
  privacyProtected: string;
}> = {
  zh: {
    title: "需要年龄验证",
    subtitle: "必须年满 18 岁才能进入本站",
    body: "本站包含 AI 角色与对话，可能含有成人内容。",
    highlight: "你必须年满 18 岁才能继续。",
    yes: "是的，我已年满 18 岁",
    no: "我未满 18 岁",
    legalBefore: "进入即表示你同意我们的",
    terms: "使用条款",
    legalAnd: "和",
    privacy: "隐私政策",
    ssl: "SSL 加密",
    privacyProtected: "隐私保护",
  },
  en: {
    title: "Age Verification Required",
    subtitle: "You must be 18+ to access this platform",
    body: "This platform contains AI-generated characters and conversations that may include mature themes.",
    highlight: "You must be 18 years or older to continue.",
    yes: "Yes, I'm 18 or Older",
    no: "I'm Under 18",
    legalBefore: "By entering, you agree to our",
    terms: "Terms of Service",
    legalAnd: "and",
    privacy: "Privacy Policy",
    ssl: "SSL Secured",
    privacyProtected: "Privacy Protected",
  },
};

function readAgeGateLang(): AgeGateLang {
  if (typeof window === "undefined") return "zh";
  const q = new URLSearchParams(window.location.search).get("lang");
  if (q === "en" || q === "zh") return q;
  try {
    const saved = localStorage.getItem("interfaceLanguage");
    if (saved === "en" || saved === "zh") return saved;
  } catch {
    /* ignore */
  }
  return "zh";
}

export function AgeGate({ isOpen, onVerified, onDeclined }: AgeGateProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [lang] = useState<AgeGateLang>(readAgeGateLang);
  const copy = COPY[lang];

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
    >
      <div className="w-full max-w-md bg-surface-primary border border-surface-border rounded-xl shadow-2xl">
        
        {/* Header */}
        <div className="p-6 text-center border-b border-surface-border">
          <div className="w-16 h-16 bg-brand-secondary/20 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Shield className="w-8 h-8 text-brand-secondary" />
          </div>
          <h2 id="age-gate-title" className="text-xl font-bold text-content-primary mb-2">
            {copy.title}
          </h2>
          <p className="text-content-secondary text-sm">
            {copy.subtitle}
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-content-secondary text-sm leading-relaxed mb-6 text-center">
            {copy.body}{" "}
            <span className="text-content-primary font-medium">{copy.highlight}</span>
          </p>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={onVerified}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-300 transform ${
                isHovering 
                  ? 'bg-brand-secondary text-white scale-105 shadow-lg shadow-brand-secondary/25' 
                  : 'bg-brand-secondary text-white hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Heart className="w-4 h-4" />
                <span>{copy.yes}</span>
                <Sparkles className="w-4 h-4" />
              </div>
            </button>

            <button
              onClick={onDeclined}
              className="w-full py-3 px-4 rounded-lg border border-surface-border text-content-secondary font-medium hover:bg-surface-secondary hover:text-content-primary transition-all duration-200"
            >
              {copy.no}
            </button>
          </div>

          {/* Legal Footer */}
          <div className="mt-6 pt-4 border-t border-surface-border">
            <p className="text-xs text-content-tertiary text-center mb-2">
              {copy.legalBefore}{" "}
              <a href="/terms-of-use" className="underline hover:text-content-secondary">{copy.terms}</a>
              {" "}{copy.legalAnd}{" "}
              <a href="/privacy-policy" className="underline hover:text-content-secondary">{copy.privacy}</a>
            </p>
            <div className="flex items-center justify-center space-x-4 text-xs text-content-tertiary">
              <div className="flex items-center space-x-1">
                <Shield className="w-3 h-3" />
                <span>{copy.ssl}</span>
              </div>
              <span>•</span>
              <span>{copy.privacyProtected}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
