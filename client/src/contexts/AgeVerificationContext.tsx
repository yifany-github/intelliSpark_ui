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
    const verified = localStorage.getItem('age-verified');
    const verificationDate = localStorage.getItem('age-verified-date');
    
    if (verified === 'true' && verificationDate) {
      // Check if verification is still valid (within 30 days)
      const verifiedDate = new Date(verificationDate);
      const now = new Date();
      const daysDiff = (now.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 30) {
        setIsVerified(true);
      } else {
        // Re-verification needed after 30 days
        localStorage.removeItem('age-verified');
        localStorage.removeItem('age-verified-date');
        setShowGate(true);
      }
    } else {
      setShowGate(true);
    }
  }, []);

  const handleVerified = () => {
    localStorage.setItem('age-verified', 'true');
    localStorage.setItem('age-verified-date', new Date().toISOString());
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