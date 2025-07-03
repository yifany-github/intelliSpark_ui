import { useRef, useState } from 'react';
import { ChatMessage } from '@shared/schema';
import { format } from 'date-fns';
import { Menu, X, RefreshCw, Copy, Palette } from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import ImageWithFallback from '@/components/ui/ImageWithFallback';

interface ChatBubbleProps {
  message: ChatMessage;
  avatarUrl?: string;
  onRegenerate?: () => void;
}

const ChatBubble = ({ message, avatarUrl, onRegenerate }: ChatBubbleProps) => {
  const { toast } = useToast();
  const isAI = message.role === 'assistant';
  const messageTime = message.timestamp 
    ? format(new Date(message.timestamp), 'h:mm a')
    : '';
  
  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast({
      title: "Copied to clipboard",
      duration: 2000,
    });
  };
  
  // Process message content for markdown-like formatting
  const processContent = (content: string) => {
    // Handle *text* for italics
    content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Handle **text** for bold
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Handle paragraphs
    content = content.split('\n\n').map(p => `<p>${p}</p>`).join('');
    // Handle line breaks
    content = content.replace(/\n/g, '<br />');
    
    return content;
  };
  
  return (
    <div className={`flex items-end mb-4 ${!isAI && 'justify-end'}`}>
      {isAI && (
        <ImageWithFallback
          src={avatarUrl}
          alt="Character"
          fallbackText="AI"
          size="sm"
          showSpinner={true}
          className="mr-2 flex-shrink-0"
        />
      )}
      
      <div className="max-w-[80%]">
        <div className={isAI ? "chat-bubble-ai" : "chat-bubble-user"}>
          <div
            dangerouslySetInnerHTML={{ 
              __html: processContent(message.content) 
            }}
          />
          
          {isAI && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="float-right text-white/60 hover:text-white ml-2 mt-1">
                  <Menu size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCopy}>
                  <Copy className="mr-2 h-4 w-4" />
                  <span>Copy</span>
                </DropdownMenuItem>
                {onRegenerate && (
                  <DropdownMenuItem onClick={onRegenerate}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    <span>Regenerate</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>
                  <Palette className="mr-2 h-4 w-4" />
                  <span>Change Tone</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className={`text-xs text-gray-500 mt-1 ${isAI ? 'ml-2' : 'mr-2 text-right'}`}>
          {messageTime}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;
