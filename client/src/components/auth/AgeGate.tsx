import { Shield } from "lucide-react";
import { Button } from "../ui/button";

interface AgeGateProps {
  isOpen: boolean;
  onVerified: () => void;
  onDeclined: () => void;
}

export function AgeGate({ isOpen, onVerified, onDeclined }: AgeGateProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface-primary border border-surface-border rounded-xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-content-primary mb-2">
            18+ Adult Content
          </h2>
          <p className="text-content-secondary leading-relaxed">
            This platform contains adult content and AI-generated characters for mature audiences. 
            You must be 18 years or older to continue.
          </p>
        </div>
        
        <div className="flex space-x-3 mb-4">
          <Button 
            variant="discrete" 
            onClick={onDeclined} 
            className="flex-1"
            size="lg"
          >
            I'm Under 18
          </Button>
          <Button 
            variant="premium" 
            onClick={onVerified} 
            className="flex-1"
            size="lg"
          >
            I'm 18 or Older
          </Button>
        </div>
        
        <div className="text-center">
          <p className="text-xs text-content-tertiary mb-2">
            By entering, you agree to our Terms of Service and Privacy Policy
          </p>
          <div className="flex items-center justify-center space-x-4 text-xs text-content-tertiary">
            <span className="flex items-center space-x-1">
              <Shield className="w-3 h-3" />
              <span>SSL Secured</span>
            </span>
            <span>•</span>
            <span>Privacy Protected</span>
            <span>•</span>
            <span>18+ Only</span>
          </div>
        </div>
      </div>
    </div>
  );
}