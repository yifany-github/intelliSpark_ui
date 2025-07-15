import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Step {
  id: number;
  title: string;
  description: string;
  isComplete: boolean;
}

interface CharacterCreationWizardProps {
  currentStep: number;
  totalSteps: number;
  onNextStep: () => void;
  onPrevStep: () => void;
  onGoToStep: (step: number) => void;
  children: React.ReactNode;
  canProceed?: boolean;
}

export default function CharacterCreationWizard({
  currentStep,
  totalSteps,
  onNextStep,
  onPrevStep,
  onGoToStep,
  children,
  canProceed = true
}: CharacterCreationWizardProps) {
  const steps: Step[] = [
    {
      id: 1,
      title: 'Basic Info',
      description: 'Name, description, and avatar',
      isComplete: currentStep > 1
    },
    {
      id: 2,
      title: 'Personality',
      description: 'Traits and characteristics',
      isComplete: currentStep > 2
    },
    {
      id: 3,
      title: 'Details',
      description: 'Additional information',
      isComplete: currentStep > 3
    },
    {
      id: 4,
      title: 'Settings',
      description: 'Publishing preferences',
      isComplete: currentStep > 4
    }
  ];

  const currentStepData = steps[currentStep - 1];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Create Your Character</h2>
          <div className="text-sm text-gray-400">
            Step {currentStep} of {totalSteps}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              {/* Step Circle */}
              <div
                className={`relative flex items-center justify-center w-10 h-10 rounded-full cursor-pointer transition-colors ${
                  currentStep === step.id
                    ? 'bg-blue-600 text-white'
                    : step.isComplete
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
                onClick={() => onGoToStep(step.id)}
              >
                {step.isComplete ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-medium">{step.id}</span>
                )}
              </div>
              
              {/* Step Info */}
              <div className="ml-3 min-w-0">
                <div className="text-sm font-medium text-white">{step.title}</div>
                <div className="text-xs text-gray-400">{step.description}</div>
              </div>
              
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 bg-gray-700 mx-6" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{currentStepData?.title}</CardTitle>
          <CardDescription>{currentStepData?.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onPrevStep}
          disabled={currentStep === 1}
          className="flex items-center space-x-2"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </Button>

        <div className="flex space-x-2">
          {currentStep < totalSteps ? (
            <Button
              onClick={onNextStep}
              disabled={!canProceed}
              className="flex items-center space-x-2"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={onNextStep}
              disabled={!canProceed}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700"
            >
              <span>Create Character</span>
              <Check className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}