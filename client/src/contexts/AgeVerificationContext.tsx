import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AgeGate } from '../components/auth/AgeGate';

interface AgeVerificationContextType {
  isVerified: boolean;
}

const AgeVerificationContext = createContext<AgeVerificationContextType | undefined>(undefined);

const CRAWLER_UA = /Googlebot|Google-InspectionTool|Bingbot|DuckDuckBot|GPTBot|ChatGPT-User|ClaudeBot|PerplexityBot|Applebot|Bytespider|Baiduspider|YandexBot/i;

function isSearchCrawler(): boolean {
  if (typeof navigator === 'undefined') return false;
  return CRAWLER_UA.test(navigator.userAgent || '');
}

export const useAgeVerification = () => {
  const context = useContext(AgeVerificationContext);
  if (context === undefined) {
    throw new Error('useAgeVerification must be used within an AgeVerificationProvider');
  }
  return context;
};

interface AgeVerificationProviderProps {
  children: ReactNode;
}

export function AgeVerificationProvider({ children }: AgeVerificationProviderProps) {
  const [isVerified, setIsVerified] = useState(false);
  const [showGate, setShowGate] = useState(false);

  useEffect(() => {
    // Search/AI crawlers must see the real 18+ marketing page, not the interstitial.
    if (isSearchCrawler()) {
      setIsVerified(true);
      setShowGate(false);
      return;
    }

    try {
      const verified = localStorage?.getItem('age-verified');
      const verificationDate = localStorage?.getItem('age-verified-date');
      
      if (verified === 'true' && verificationDate) {
        const verifiedDate = new Date(verificationDate);
        
        if (isNaN(verifiedDate.getTime())) {
          localStorage.removeItem('age-verified');
          localStorage.removeItem('age-verified-date');
          setShowGate(true);
          return;
        }
        
        const now = new Date();
        const daysDiff = (now.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff < 30 && daysDiff >= 0) {
          setIsVerified(true);
        } else {
          localStorage.removeItem('age-verified');
          localStorage.removeItem('age-verified-date');
          setShowGate(true);
        }
      } else {
        setShowGate(true);
      }
    } catch (error) {
      console.warn('localStorage not available, showing age gate');
      setShowGate(true);
    }
  }, []);

  const handleVerified = () => {
    try {
      localStorage?.setItem('age-verified', 'true');
      localStorage?.setItem('age-verified-date', new Date().toISOString());
    } catch (error) {
      console.warn('Could not save age verification to localStorage');
    }
    setIsVerified(true);
    setShowGate(false);
  };

  const handleDeclined = () => {
    window.location.href = 'https://google.com';
  };

  return (
    <AgeVerificationContext.Provider value={{ isVerified }}>
      {children}
      <AgeGate 
        isOpen={showGate}
        onVerified={handleVerified}
        onDeclined={handleDeclined}
      />
    </AgeVerificationContext.Provider>
  );
}
