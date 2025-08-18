import { Shield, Heart, Sparkles } from "lucide-react";
import { useState } from "react";

interface AgeGateProps {
  isOpen: boolean;
  onVerified: () => void;
  onDeclined: () => void;
}

export function AgeGate({ isOpen, onVerified, onDeclined }: AgeGateProps) {
  const [isHovering, setIsHovering] = useState(false);

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
            Age Verification Required
          </h2>
          <p className="text-content-secondary text-sm">
            You must be 18+ to access this platform
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-content-secondary text-sm leading-relaxed mb-6 text-center">
            This platform contains AI-generated characters and conversations that may include mature themes. 
            <span className="text-content-primary font-medium"> You must be 18 years or older to continue.</span>
          </p>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* I'm 18+ Button - Enhanced */}
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
                <span>Yes, I'm 18 or Older</span>
                <Sparkles className="w-4 h-4" />
              </div>
            </button>

            {/* Under 18 Button - Subtle */}
            <button
              onClick={onDeclined}
              className="w-full py-3 px-4 rounded-lg border border-surface-border text-content-secondary font-medium hover:bg-surface-secondary hover:text-content-primary transition-all duration-200"
            >
              I'm Under 18
            </button>
          </div>

          {/* Legal Footer */}
          <div className="mt-6 pt-4 border-t border-surface-border">
            <p className="text-xs text-content-tertiary text-center mb-2">
              By entering, you agree to our Terms of Service and Privacy Policy
            </p>
            <div className="flex items-center justify-center space-x-4 text-xs text-content-tertiary">
              <div className="flex items-center space-x-1">
                <Shield className="w-3 h-3" />
                <span>SSL Secured</span>
              </div>
              <span>•</span>
              <span>Privacy Protected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}