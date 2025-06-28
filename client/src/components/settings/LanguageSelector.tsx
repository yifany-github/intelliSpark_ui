import React from 'react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Language, LANGUAGES, useLanguage } from '@/context/LanguageContext';

interface LanguageSelectorProps {
  type: 'interface' | 'chat';
  className?: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ type, className = '' }) => {
  const { 
    interfaceLanguage, 
    chatLanguage, 
    setInterfaceLanguage, 
    setChatLanguage,
    t,
    availableLanguages
  } = useLanguage();

  const handleChange = (value: string) => {
    if (type === 'interface') {
      setInterfaceLanguage(value as Language);
    } else {
      setChatLanguage(value as Language);
    }
  };

  const currentValue = type === 'interface' ? interfaceLanguage : chatLanguage;
  const label = type === 'interface' ? t('interfaceLanguage') : t('chatLanguage');

  // Filter to only show Chinese language
  const filteredLanguages = Object.entries(availableLanguages).filter(([code]) => code === 'zh');

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={`${type}-language`}>{label}</Label>
      <Select value={currentValue} onValueChange={handleChange}>
        <SelectTrigger id={`${type}-language`} className="w-full bg-secondary/80 border border-primary">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {filteredLanguages.map(([code, lang]) => (
            <SelectItem key={code} value={code}>
              {lang.name} ({lang.englishName})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSelector;