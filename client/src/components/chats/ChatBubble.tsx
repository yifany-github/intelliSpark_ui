import { useRef, useState, useEffect } from 'react';
import { ChatMessage } from '../../types';
import { format } from 'date-fns';
import { Menu, RefreshCw, Copy, Palette } from 'lucide-react';
import DOMPurify from 'dompurify';
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
  stateSnapshot?: Record<string, string | { value: number; description: string }>;
}

const ChatBubble = ({ message, avatarUrl, onRegenerate, stateSnapshot }: ChatBubbleProps) => {
  const { toast } = useToast();
  const isAI = message.role === 'assistant';
  const isSystem = message.role === 'system';
  const [displayedContent, setDisplayedContent] = useState(message.content);
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const hasInitialized = useRef(false);
  const userMessageInitialized = useRef(false);

  const messageTime = message.timestamp
    ? format(new Date(message.timestamp), 'h:mm a')
    : '';

  // Send animation for user messages
  useEffect(() => {
    if (isAI || isSystem) return;

    // Check if message was already sent (exists in localStorage)
    const sentMessagesKey = 'sent_messages';
    const getSentMessages = () => {
      try {
        const stored = localStorage.getItem(sentMessagesKey);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    };

    const sentMessages: number[] = getSentMessages();
    const wasAlreadySent = sentMessages.includes(message.id);

    if (wasAlreadySent || userMessageInitialized.current) {
      return;
    }

    userMessageInitialized.current = true;

    // New user message - apply send animation
    setIsSending(true);

    const timer = setTimeout(() => {
      setIsSending(false);

      // Mark this message as sent
      try {
        const currentSent = getSentMessages();
        const updated = [...currentSent, message.id].slice(-50); // Keep last 50
        localStorage.setItem(sentMessagesKey, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save sent message', e);
      }
    }, 500); // Duration matches CSS animation

    return () => clearTimeout(timer);
  }, [message.id, isAI, isSystem]);

  // Typewriter effect for AI messages
  useEffect(() => {
    // Only apply typewriter to AI messages
    if (!isAI) {
      setDisplayedContent(message.content);
      return;
    }

    // Check if message was already typed (exists in localStorage)
    const createdAtMs = message.createdAt ? new Date(message.createdAt).getTime() : null;
    const isStaleMessage = createdAtMs ? Date.now() - createdAtMs > 15000 : false;

    const typedMessagesKey = 'typed_messages';
    const getTypedMessages = () => {
      try {
        const stored = localStorage.getItem(typedMessagesKey);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    };

    const typedMessages: number[] = getTypedMessages();
    const wasAlreadyTyped = typedMessages.includes(message.id);

    if (wasAlreadyTyped || hasInitialized.current || isStaleMessage) {
      // Already typed before or historic message, show immediately
      setDisplayedContent(message.content);
      return;
    }

    // Mark as initialized to prevent re-typing on updates
    hasInitialized.current = true;

    // New AI message - apply typewriter effect
    setIsTyping(true);
    setDisplayedContent('');

    let currentIndex = 0;
    const content = message.content;
    const typingSpeed = 15; // milliseconds per character

    const intervalId = setInterval(() => {
      if (currentIndex < content.length) {
        setDisplayedContent(content.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        setIsTyping(false);
        clearInterval(intervalId);

        // Mark this message as typed
        try {
          const currentTyped = getTypedMessages();
          const updated = [...currentTyped, message.id].slice(-50); // Keep last 50
          localStorage.setItem(typedMessagesKey, JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to save typed message', e);
        }
      }
    }, typingSpeed);

    return () => clearInterval(intervalId);
  }, [message.id, message.content, isAI]);

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

    // Sanitize HTML to prevent XSS attacks
    return DOMPurify.sanitize(content);
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
        <div className="relative mr-2 flex-shrink-0">
          {isTyping && (
            <>
              <div className="absolute -inset-2 rounded-full animate-breathing-glow pointer-events-none"
                   style={{
                     background: 'radial-gradient(circle, rgba(236, 72, 153, 0.8) 0%, rgba(168, 85, 247, 0.6) 40%, rgba(99, 102, 241, 0.3) 60%, transparent 80%)',
                     filter: 'blur(12px)',
                   }}
              />
              <div className="absolute -inset-1 rounded-full animate-breathing-glow-fast pointer-events-none"
                   style={{
                     background: 'radial-gradient(circle, rgba(236, 72, 153, 0.6) 0%, rgba(168, 85, 247, 0.4) 50%, transparent 70%)',
                     filter: 'blur(6px)',
                   }}
              />
            </>
          )}
          <ImageWithFallback
            src={avatarUrl}
            alt="Character"
            fallbackText="AI"
            size="sm"
            showSpinner={true}
            className="relative z-10"
          />
        </div>
      )}

      <div className="max-w-[80%]">
        <div className={`${isAI ? "chat-bubble-ai" : "chat-bubble-user"} ${isSending ? "message-sending" : ""}`}>
          <div
            dangerouslySetInnerHTML={{
              __html: processContent(isAI ? displayedContent : message.content)
            }}
          />
          {isAI && isTyping && (
            <span className="inline-block w-1 h-4 ml-1 bg-pink-300 animate-pulse"></span>
          )}

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
