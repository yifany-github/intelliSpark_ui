import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AgeGate } from '../components/auth/AgeGate';

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

export function AgeVerificationProvider({ children }: AgeVerificationProviderProps) {
  const [isVerified, setIsVerified] = useState(false);
  const [showGate, setShowGate] = useState(false);

  useEffect(() => {
    // Check if user has already verified their age
    try {
      const verified = localStorage?.getItem('age-verified');
      const verificationDate = localStorage?.getItem('age-verified-date');
      
      if (verified === 'true' && verificationDate) {
        // Check if verification is still valid (within 30 days)
        const verifiedDate = new Date(verificationDate);
        
        // Validate date is not corrupted
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
          // Re-verification needed after 30 days or invalid date
          localStorage.removeItem('age-verified');
          localStorage.removeItem('age-verified-date');
          setShowGate(true);
        }
      } else {
        setShowGate(true);
      }
    } catch (error) {
      // Fallback if localStorage is not available
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
    // Redirect to a safe site
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