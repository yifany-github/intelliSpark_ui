import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AgeGate } from '../components/auth/AgeGate';
import { isSearchCrawler } from '../lib/searchCrawler';

interface AgeVerificationContextType {
  isVerified: boolean;
}

const AgeVerificationContext = createContext<AgeVerificationContextType | undefined>(undefined);

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

function readStoredAgeVerification(): boolean {
  try {
    const verified = localStorage?.getItem('age-verified');
    const verificationDate = localStorage?.getItem('age-verified-date');

    if (verified === 'true' && verificationDate) {
      const verifiedDate = new Date(verificationDate);

      if (isNaN(verifiedDate.getTime())) {
        localStorage.removeItem('age-verified');
        localStorage.removeItem('age-verified-date');
        return false;
      }

      const now = new Date();
      const daysDiff = (now.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff < 30 && daysDiff >= 0) {
        return true;
      }

      localStorage.removeItem('age-verified');
      localStorage.removeItem('age-verified-date');
    }
  } catch {
    /* localStorage unavailable */
  }
  return false;
}

function getInitialAgeState(): { verified: boolean; showGate: boolean } {
  // Resolve synchronously so the first paint never mounts AgeGate for bots
  // or already-confirmed users (avoids SERP snapshots of age-gate copy).
  if (isSearchCrawler()) {
    return { verified: true, showGate: false };
  }
  const stored = readStoredAgeVerification();
  return { verified: stored, showGate: !stored };
}

export function AgeVerificationProvider({ children }: AgeVerificationProviderProps) {
  const [isVerified, setIsVerified] = useState(() => getInitialAgeState().verified);
  const [showGate, setShowGate] = useState(() => getInitialAgeState().showGate);

  useEffect(() => {
    // Search/AI crawlers must see the real 18+ marketing page, not the interstitial.
    if (isSearchCrawler()) {
      setIsVerified(true);
      setShowGate(false);
      return;
    }

    const stored = readStoredAgeVerification();
    if (stored) {
      setIsVerified(true);
      setShowGate(false);
    } else {
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