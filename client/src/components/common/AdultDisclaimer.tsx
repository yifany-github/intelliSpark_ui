import { AlertTriangle, Shield, Info } from "lucide-react";

interface AdultDisclaimerProps {
  variant?: 'warning' | 'info' | 'legal';
  className?: string;
}

export function AdultDisclaimer({ variant = 'warning', className = '' }: AdultDisclaimerProps) {
  const variants = {
    warning: {
      bgColor: 'bg-amber-950/20 border-amber-500/30',
      iconColor: 'text-amber-400',
      titleColor: 'text-amber-200',
      textColor: 'text-amber-300/80',
      icon: AlertTriangle,
      title: 'Adult Content Warning',
      text: 'This platform contains AI-generated adult content for users 18+. All characters are fictional and AI-created.'
    },
    info: {
      bgColor: 'bg-blue-950/20 border-blue-500/30',
      iconColor: 'text-blue-400',
      titleColor: 'text-blue-200',
      textColor: 'text-blue-300/80',
      icon: Info,
      title: 'Content Information',
      text: 'All interactions are with AI characters. Content is generated in real-time and may vary in intensity based on your preferences.'
    },
    legal: {
      bgColor: 'bg-red-950/20 border-red-500/30',
      iconColor: 'text-red-400',
      titleColor: 'text-red-200',
      textColor: 'text-red-300/80',
      icon: Shield,
      title: 'Legal Notice',
      text: 'By using this platform, you confirm you are 18+ and consent to adult AI content. All characters and scenarios are fictional.'
    }
  };

  const config = variants[variant];
  const Icon = config.icon;

  return (
    <div className={`${config.bgColor} border rounded-lg p-3 mb-4 ${className}`}>
      <div className="flex items-start space-x-3">
        <Icon className={`w-4 h-4 ${config.iconColor} mt-0.5 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className={`${config.titleColor} font-medium mb-1 text-sm`}>
            {config.title}
          </p>
          <p className={`${config.textColor} text-sm leading-relaxed`}>
            {config.text}
          </p>
        </div>
      </div>
    </div>
  );
}

// Specific disclaimer for character selection
export function CharacterAdultDisclaimer() {
  return (
    <div className="bg-gradient-to-r from-red-950/30 to-pink-950/30 border border-red-500/30 rounded-xl p-4 mb-6">
      <div className="flex items-start space-x-3">
        <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-red-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-red-200 font-semibold mb-2">Adult AI Characters Platform</h3>
          <p className="text-red-300/90 text-sm leading-relaxed mb-3">
            Welcome to our 18+ AI character platform. All characters are AI-generated and designed for adult audiences. 
            Interactions may include mature themes, romantic content, and adult conversations based on your preferences.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-500/20 text-red-300 text-xs">
              <Shield className="w-3 h-3 mr-1" />
              18+ Only
            </span>
            <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-500/20 text-red-300 text-xs">
              AI Generated
            </span>
            <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-500/20 text-red-300 text-xs">
              Fictional Characters
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}