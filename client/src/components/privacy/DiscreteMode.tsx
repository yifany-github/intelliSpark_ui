import { EyeOff, Eye, Briefcase } from "lucide-react";
import { Button } from "../ui/button";
import { useEffect, useState } from "react";

export function DiscreteMode() {
  const [discreteMode, setDiscreteMode] = useState(false);

  useEffect(() => {
    // Load discrete mode from localStorage
    const saved = localStorage.getItem('discrete-mode');
    if (saved === 'true') {
      setDiscreteMode(true);
    }
  }, []);

  useEffect(() => {
    // Update document title and favicon based on discrete mode
    if (discreteMode) {
      document.title = 'Dashboard - Analytics Platform';
      // You could also update favicon here if needed
    } else {
      document.title = 'ProductInsightAI - AI Characters';
    }
    
    // Save discrete mode state
    localStorage.setItem('discrete-mode', discreteMode.toString());
  }, [discreteMode]);

  const toggleDiscreteMode = () => {
    setDiscreteMode(!discreteMode);
  };

  return (
    <div className="bg-surface-secondary rounded-lg p-4 border border-surface-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-zinc-700 rounded-lg flex items-center justify-center">
            <EyeOff className="w-4 h-4 text-brand-secondary" />
          </div>
          <div>
            <p className="font-semibold text-content-primary text-sm">Discrete Mode</p>
            <p className="text-xs text-content-secondary">
              {discreteMode ? 'Generic titles for privacy' : 'Show platform branding'}
            </p>
          </div>
        </div>
        <Button
          variant={discreteMode ? "accent" : "discrete"}
          size="sm"
          onClick={toggleDiscreteMode}
        >
          {discreteMode ? 'On' : 'Off'}
        </Button>
      </div>
      
      {discreteMode && (
        <div className="mt-3 pt-3 border-t border-surface-border">
          <div className="flex items-center space-x-2 text-xs text-green-400">
            <Briefcase className="w-3 h-3" />
            <span>Privacy mode active - generic page titles enabled</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook for accessing discrete mode state in other components
export function useDiscreteMode() {
  const [discreteMode, setDiscreteMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('discrete-mode');
    setDiscreteMode(saved === 'true');
    
    // Listen for storage changes to sync across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'discrete-mode') {
        setDiscreteMode(e.newValue === 'true');
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return discreteMode;
}