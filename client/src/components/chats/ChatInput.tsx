import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

// Constants
const MAX_MESSAGE_LENGTH = 10000; // 10KB limit to match backend
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Smile, Paperclip, Send, Slash, Palette } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const ChatInput = ({ onSendMessage, isLoading, disabled = false, placeholder, className }: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const { toast } = useToast();
  const { t } = useLanguage();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isSubmitDisabled = disabled || isLoading;

  const validateMessage = (content: string): string | null => {
    if (!content.trim()) return 'Message cannot be empty';
    if (new Blob([content]).size > MAX_MESSAGE_LENGTH) {
      return `Message too long (max ${Math.floor(MAX_MESSAGE_LENGTH / 1000)}KB)`;
    }
    return null;
  };

  const handleSend = () => {
    if (isSubmitDisabled) return;

    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;
    
    const validationError = validateMessage(trimmedMessage);
    if (validationError) {
      toast({
        title: "Message Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }
    
    onSendMessage(trimmedMessage);
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  // Tone presets
  const tonePresets = [
    { name: 'Gentle', description: t('kindSupportive') },
    { name: 'Playful', description: t('funLighthearted') },
    { name: 'Dark', description: t('seriousDramatic') },
  ];
  
  // Slash commands
  const slashCommands = [
    { command: '/think', description: t('characterThinks') },
    { command: '/whisper', description: t('characterWhispers') },
    { command: '/action', description: t('characterPerforms') },
  ];
  
  const handleToneSelect = (tone: string) => {
    setMessage(prev => `[Tone: ${tone}] ${prev}`);
    inputRef.current?.focus();
  };
  
  const handleCommandSelect = (command: string) => {
    setMessage(prev => `${command} ${prev}`);
    inputRef.current?.focus();
  };

  return (
    <div className={cn("p-3 border-t border-secondary bg-background", className)}>
      <div className="flex items-center bg-secondary rounded-2xl px-3 py-2">
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-gray-400 mr-3" disabled={isSubmitDisabled}>
              <Smile className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2">
            <div className="grid grid-cols-5 gap-2">
              {['😊', '😂', '😍', '🤔', '😮', '😢', '😡', '👍', '❤️', '🙏'].map(emoji => (
                <button 
                  key={emoji}
                  className="h-8 w-8 flex items-center justify-center hover:bg-primary/20 rounded"
                  onClick={() => setMessage(prev => prev + emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        
        <textarea
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t('typeMessage')}
          className="flex-grow bg-transparent border-0 focus:outline-none text-white resize-none max-h-24"
          rows={1}
          disabled={isSubmitDisabled}
        />
        
        <button className="ml-3 text-gray-400" disabled={isSubmitDisabled}>
          <Paperclip className="h-5 w-5" />
        </button>
        
        <button 
          className={`ml-3 w-8 h-8 ${isSubmitDisabled ? 'bg-secondary' : 'bg-primary'} rounded-full flex items-center justify-center text-white ${
            isLoading ? 'animate-pulse' : 'hover:bg-accent transition-colors'
          }`}
          onClick={handleSend}
          disabled={isSubmitDisabled || !message.trim()}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      
      <div className="flex justify-between items-center mt-2 px-1 text-xs text-gray-400">
        <div className="flex">
          <Popover>
            <PopoverTrigger asChild>
              <button className="mr-3 flex items-center" disabled={isSubmitDisabled}>
                <Slash className="h-4 w-4 mr-1" /> {t('commands')}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                {slashCommands.map(({ command, description }) => (
                  <div
                    key={command}
                    className="flex justify-between items-center hover:bg-primary/10 p-2 rounded cursor-pointer"
                    onClick={() => handleCommandSelect(command)}
                  >
                    <span className="font-mono text-primary">{command}</span>
                    <span className="text-xs text-gray-400">{description}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center" disabled={isSubmitDisabled}>
                <Palette className="h-4 w-4 mr-1" /> {t('tone')}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                {tonePresets.map(({ name, description }) => (
                  <div
                    key={name}
                    className="flex justify-between items-center hover:bg-primary/10 p-2 rounded cursor-pointer"
                    onClick={() => handleToneSelect(name)}
                  >
                    <span className="font-medium text-primary">{name}</span>
                    <span className="text-xs text-gray-400">{description}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        
        <div>{t('markdownSupported')}</div>
      </div>
    </div>
  );
};

export default ChatInput;
