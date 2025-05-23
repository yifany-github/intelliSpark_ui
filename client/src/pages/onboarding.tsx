import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface OnboardingPageProps {
  onComplete: () => void;
}

const OnboardingPage = ({ onComplete }: OnboardingPageProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  
  const steps = [
    {
      title: "Choose Your Scene",
      description: "Select from a variety of immersive environments for your roleplay experience",
      illustration: (
        <div className="h-64 w-full rounded-xl bg-gradient-to-r from-primary/30 to-accent/30 flex items-center justify-center">
          <div className="relative">
            <div className="w-32 h-32 rounded-xl bg-gradient-to-r from-primary to-accent absolute -left-16 -top-10 opacity-50"></div>
            <div className="w-32 h-32 rounded-xl bg-gradient-to-r from-primary to-accent absolute -right-16 top-10 opacity-50"></div>
            <div className="w-48 h-32 rounded-xl bg-secondary relative z-10 flex items-center justify-center shadow-lg">
              <i className="fas fa-map-location-dot text-4xl text-accent"></i>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Pick Your Character",
      description: "Choose from diverse AI companions with unique personalities and backstories",
      illustration: (
        <div className="h-64 w-full rounded-xl bg-gradient-to-r from-primary/30 to-accent/30 flex items-center justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-primary to-accent absolute -left-10 top-0 opacity-50"></div>
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-primary to-accent absolute right-0 -top-10 opacity-50"></div>
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-primary to-accent absolute right-0 bottom-0 opacity-50"></div>
            <div className="w-32 h-32 rounded-full bg-secondary relative z-10 flex items-center justify-center shadow-lg">
              <i className="fas fa-user text-4xl text-accent"></i>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Chat Immersively",
      description: "Engage in deep, meaningful conversations with advanced AI that stays in character",
      illustration: (
        <div className="h-64 w-full rounded-xl bg-gradient-to-r from-primary/30 to-accent/30 flex items-center justify-center">
          <div className="relative w-64">
            <div className="w-48 h-20 rounded-xl bg-accent/50 absolute -left-2 top-0 flex items-center p-3">
              <i className="fas fa-robot text-xl text-white mr-2"></i>
              <div className="w-32 h-3 bg-white/30 rounded-full"></div>
            </div>
            <div className="w-48 h-20 rounded-xl bg-secondary/80 absolute right-0 bottom-0 flex items-center justify-end p-3">
              <div className="w-32 h-3 bg-white/30 rounded-full mr-2"></div>
              <i className="fas fa-user text-xl text-white"></i>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Let's Get Started",
      description: "Choose your preferred starting mood to begin your journey",
      illustration: (
        <div className="h-64 w-full flex items-center justify-center">
          <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
            <div 
              className={`h-32 rounded-xl flex items-center justify-center flex-col cursor-pointer transition-colors ${
                selectedMood === 'Romance' 
                  ? 'bg-accent text-white' 
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
              onClick={() => setSelectedMood('Romance')}
            >
              <i className="fas fa-heart text-2xl mb-2"></i>
              <span>Romance</span>
            </div>
            <div 
              className={`h-32 rounded-xl flex items-center justify-center flex-col cursor-pointer transition-colors ${
                selectedMood === 'Comfort' 
                  ? 'bg-accent text-white' 
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
              onClick={() => setSelectedMood('Comfort')}
            >
              <i className="fas fa-mug-hot text-2xl mb-2"></i>
              <span>Comfort</span>
            </div>
            <div 
              className={`h-32 rounded-xl flex items-center justify-center flex-col cursor-pointer transition-colors ${
                selectedMood === 'Adventure' 
                  ? 'bg-accent text-white' 
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
              onClick={() => setSelectedMood('Adventure')}
            >
              <i className="fas fa-mountain text-2xl mb-2"></i>
              <span>Adventure</span>
            </div>
          </div>
        </div>
      ),
    },
  ];
  
  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Save selected mood preference if needed
      if (selectedMood) {
        localStorage.setItem("preferredMood", selectedMood);
      }
      onComplete();
    }
  };
  
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md"
          >
            {steps[currentStep].illustration}
            
            <h1 className="font-poppins font-bold text-2xl mt-8 mb-2 text-center">
              {steps[currentStep].title}
            </h1>
            
            <p className="text-center text-gray-400 mb-8">
              {steps[currentStep].description}
            </p>
          </motion.div>
        </AnimatePresence>
        
        {/* Step indicators */}
        <div className="flex justify-center space-x-2 mb-8">
          {steps.map((_, index) => (
            <div 
              key={index}
              className={`h-2 rounded-full transition-all ${
                index === currentStep 
                  ? 'w-8 bg-primary' 
                  : 'w-2 bg-gray-600'
              }`}
            ></div>
          ))}
        </div>
        
        {/* Navigation buttons */}
        <div className="flex w-full max-w-xs">
          {currentStep > 0 && (
            <button 
              className="flex-1 bg-secondary hover:bg-secondary/80 rounded-xl py-3 mr-2 transition-colors"
              onClick={prevStep}
            >
              Back
            </button>
          )}
          <button 
            className={`flex-1 bg-primary hover:bg-accent rounded-xl py-3 transition-colors ${
              currentStep === steps.length - 1 && !selectedMood ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={nextStep}
            disabled={currentStep === steps.length - 1 && !selectedMood}
          >
            {currentStep < steps.length - 1 ? 'Next' : 'Get Started'}
          </button>
        </div>
      </div>
      
      <div className="p-4 text-center">
        <h2 className="font-poppins text-2xl mb-1">RolePlay AI</h2>
        <p className="text-sm text-gray-400">Immersive character interactions</p>
      </div>
    </div>
  );
};

export default OnboardingPage;
