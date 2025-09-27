import { ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

export interface CharacterCreationStep {
  id: number;
  title: string;
  description: string;
}

interface CharacterCreationWizardProps {
  steps: CharacterCreationStep[];
  currentStep: number;
  onNextStep: () => void;
  onPrevStep: () => void;
  onGoToStep: (step: number) => void;
  children: ReactNode;
  canProceed?: boolean;
  isSubmitting?: boolean;
  nextLabel?: string;
  prevLabel?: string;
  submitLabel?: string;
  showNavigation?: boolean;
}

export default function CharacterCreationWizard({
  steps,
  currentStep,
  onNextStep,
  onPrevStep,
  onGoToStep,
  children,
  canProceed = true,
  isSubmitting = false,
  nextLabel,
  prevLabel,
  submitLabel,
  showNavigation = true,
}: CharacterCreationWizardProps) {
  const { t, interfaceLanguage } = useLanguage();
  const totalSteps = steps.length;
  const currentStepData = steps[currentStep - 1];
  const computedPrevLabel = prevLabel ?? t('stepBack');
  const computedNextLabel = nextLabel ?? t('stepNext');
  const computedSubmitLabel = submitLabel ?? t('createCharacter');
  const progressLabel = interfaceLanguage === 'zh'
    ? `第 ${currentStep} 步 / 共 ${totalSteps} 步`
    : `Step ${currentStep} of ${totalSteps}`;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-end mb-4">
          <div className="text-sm text-gray-400">
            {progressLabel}
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
                    : currentStep > step.id
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
                onClick={() => onGoToStep(step.id)}
              >
                {currentStep > step.id ? (
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

      {showNavigation && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={onPrevStep}
            disabled={currentStep === 1}
            className="flex items-center space-x-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{computedPrevLabel}</span>
          </Button>

          <div className="flex space-x-2">
            {currentStep < totalSteps ? (
              <Button
                onClick={onNextStep}
                disabled={!canProceed || isSubmitting}
                className="flex items-center space-x-2"
              >
                <span>{computedNextLabel}</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={onNextStep}
                disabled={!canProceed || isSubmitting}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{computedSubmitLabel}</span>
                <Check className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}