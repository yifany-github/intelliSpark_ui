import { type ReactNode } from 'react';
import { ChatMessage } from '../../types';
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
  const isSystem = message.role === 'system';
  
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
  
  const renderInlineFormatting = (text: string) => {
    const nodes: ReactNode[] = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(text.slice(lastIndex, match.index));
      }

      const token = match[0];
      const isStrong = token.startsWith('**');
      const innerText = token.slice(isStrong ? 2 : 1, token.length - (isStrong ? 2 : 1));

      nodes.push(
        isStrong ? (
          <strong key={`strong-${key++}`}>{innerText}</strong>
        ) : (
          <em key={`em-${key++}`}>{innerText}</em>
        )
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex));
    }

    // Convert newline characters inside plain strings to <br />
    return nodes.flatMap((node, outerIndex) => {
      if (typeof node !== 'string') {
        return [node];
      }

      const segments = node.split('\n');
      return segments.flatMap((segment, innerIndex) => {
        const parts: ReactNode[] = [segment];
        if (innerIndex < segments.length - 1) {
          parts.push(<br key={`br-${outerIndex}-${innerIndex}`} />);
        }
        return parts;
      });
    });
  };

  const renderMessageContent = (content: string) => {
    const paragraphs = content.split(/\n{2,}/).filter(Boolean);

    if (paragraphs.length === 0) {
      return null;
    }

    return paragraphs.map((paragraph, index) => (
      <p key={`paragraph-${index}`}>
        {renderInlineFormatting(paragraph)}
      </p>
    ));
  };
  
  // Handle system messages (errors) differently
  if (isSystem) {
    return (
      <div className="flex justify-center mb-4">
        <div className="max-w-[80%] bg-red-600/20 border border-red-500/50 rounded-lg p-3 text-center">
          <div className="text-red-300 text-sm">
            {message.content}
          </div>
        </div>
      </div>
    );
  }
  
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
          <div>
            {renderMessageContent(message.content)}
          </div>
          
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
