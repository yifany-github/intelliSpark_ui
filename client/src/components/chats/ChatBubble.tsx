import { useRef, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChatMessage } from '../../types';
import { format } from 'date-fns';
import { Copy, Loader2, Menu, Palette, Pause, Play, RefreshCw, Volume2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import TypingIndicator from '@/components/ui/TypingIndicator';
import { useToast } from '@/hooks/use-toast';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import { requestMessageTts } from '@/lib/chatApi';
import { invalidateTokenBalance } from '@/services/tokenService';

interface ChatBubbleProps {
  message: ChatMessage;
  avatarUrl?: string;
  onRegenerate?: () => void;
  stateSnapshot?: Record<string, string | { value: number; description: string }>;
}

const ChatBubble = ({ message, avatarUrl, onRegenerate, stateSnapshot }: ChatBubbleProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAI = message.role === 'assistant';
  const isSystem = message.role === 'system';
  const [displayedContent, setDisplayedContent] = useState(message.content);
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlFromMessage = message.audio_url || message.audioUrl;
  const audioStatusFromMessage = message.audio_status || message.audioStatus;
  const audioErrorFromMessage = message.audio_error || message.audioError;
  const [audioUrl, setAudioUrl] = useState<string | undefined>(audioUrlFromMessage);
  const [audioStatus, setAudioStatus] = useState<string | undefined>(audioStatusFromMessage);
  const [audioError, setAudioError] = useState<string | undefined>(audioErrorFromMessage);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
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

  useEffect(() => {
    setAudioUrl(audioUrlFromMessage);
    setAudioStatus(audioStatusFromMessage);
    setAudioError(audioErrorFromMessage);
  }, [audioUrlFromMessage, audioStatusFromMessage, audioErrorFromMessage]);

  useEffect(() => {
    setAudioDuration(null);
    setAudioCurrentTime(0);
  }, [audioUrl]);

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

  const formatAudioTime = (seconds: number | null) => {
    if (!seconds || Number.isNaN(seconds) || !Number.isFinite(seconds)) {
      return "0:00";
    }
    const clamped = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(clamped / 60);
    const remaining = clamped % 60;
    return `${minutes}:${remaining.toString().padStart(2, "0")}`;
  };

  const audioProgress = audioDuration
    ? Math.min(100, (audioCurrentTime / audioDuration) * 100)
    : 0;

  const waveformBars = [6, 12, 9, 16, 10, 14, 8, 12];

  const updateCachedAudioMeta = (updates: {
    audioUrl?: string;
    audioStatus?: string | null;
    audioError?: string | null;
  }) => {
    queryClient.setQueriesData<ChatMessage[]>(
      {
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/chats/') && key.includes('/messages');
        },
      },
      (oldMessages) => {
        if (!oldMessages) {
          return oldMessages;
        }
        let updated = false;
        const nextMessages = oldMessages.map((msg) => {
          if (msg.id !== message.id) {
            return msg;
          }
          updated = true;
          const hasAudioUrl = Object.prototype.hasOwnProperty.call(updates, "audioUrl");
          const hasAudioStatus = Object.prototype.hasOwnProperty.call(updates, "audioStatus");
          const hasAudioError = Object.prototype.hasOwnProperty.call(updates, "audioError");
          const nextAudioUrl = hasAudioUrl
            ? updates.audioUrl ?? undefined
            : msg.audioUrl ?? msg.audio_url;
          const nextAudioStatus = hasAudioStatus
            ? updates.audioStatus ?? undefined
            : msg.audioStatus ?? msg.audio_status;
          const nextAudioError = hasAudioError
            ? updates.audioError ?? undefined
            : msg.audioError ?? msg.audio_error;
          return {
            ...msg,
            audioUrl: nextAudioUrl,
            audio_url: nextAudioUrl,
            audioStatus: nextAudioStatus ?? undefined,
            audio_status: nextAudioStatus ?? undefined,
            audioError: nextAudioError ?? undefined,
            audio_error: nextAudioError ?? undefined,
          };
        });
        return updated ? nextMessages : oldMessages;
      }
    );
  };

  const parseTtsError = (error: unknown) => {
    if (!(error instanceof Error)) {
      return { status: null, detail: null };
    }
    const match = error.message.match(/^(\d+):\s*(.*)$/s);
    if (!match) {
      return { status: null, detail: error.message };
    }
    const status = Number(match[1]);
    let detail = match[2];
    try {
      const parsed = JSON.parse(match[2]);
      if (parsed?.detail) {
        detail = parsed.detail;
      }
    } catch {
      // ignore parse errors
    }
    return { status, detail };
  };

  const getTtsErrorMessage = (error: unknown) => {
    const { status, detail } = parseTtsError(error);
    if (status === 402) {
      return "Not enough tokens to generate audio.";
    }
    if (status === 422) {
      return "Audio unavailable for this response.";
    }
    return detail || "TTS request failed";
  };

  const isPlayInterruptedError = (error: unknown) => {
    if (!(error instanceof Error)) {
      return false;
    }
    if (error.name === "AbortError") {
      return true;
    }
    return error.message.includes("interrupted by a new load request");
  };

  const handleAudioToggle = async () => {
    if (isAudioLoading) {
      return;
    }
    if (audioStatus === "blocked") {
      return;
    }

    const audio = audioRef.current;
    if (audioUrl) {
      if (!audio) {
        return;
      }
      if (audio.paused) {
        try {
          await audio.play();
        } catch (error) {
          if (!isPlayInterruptedError(error)) {
            toast({
              title: "Unable to play audio",
              description: getTtsErrorMessage(error),
              duration: 3000,
            });
          }
        }
      } else {
        audio.pause();
      }
      return;
    }

    setIsAudioLoading(true);
    try {
      const response = await requestMessageTts(message.id);
      setAudioUrl(response.audioUrl);
      setAudioStatus("ready");
      setAudioError(undefined);
      updateCachedAudioMeta({
        audioUrl: response.audioUrl,
        audioStatus: "ready",
        audioError: null,
      });
      invalidateTokenBalance();
    } catch (error) {
      const parsed = parseTtsError(error);
      if (parsed.status === 422) {
        const nextError = parsed.detail || "TTS blocked for this response";
        setAudioStatus("blocked");
        setAudioError(nextError);
        updateCachedAudioMeta({ audioStatus: "blocked", audioError: nextError });
        toast({
          title: "Audio unavailable",
          description: "This response cannot be generated as audio.",
          duration: 3000,
        });
        return;
      }
      toast({
        title: "TTS failed",
        description: getTtsErrorMessage(error),
        duration: 3000,
      });
    } finally {
      setIsAudioLoading(false);
    }
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
  
  const showAudioBubble = isAI && audioStatus !== "blocked" && (isAudioLoading || audioUrl);
  const audioButtonTitle = audioStatus === "blocked"
    ? "Audio unavailable for this response"
    : audioUrl
      ? "Play audio"
      : "Generate audio (20 tokens)";

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
            <div className="flex items-center justify-end gap-2 mt-2 text-white/60">
              <button
                className="flex h-6 w-6 items-center justify-center rounded-full text-white/60 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                onClick={handleAudioToggle}
                title={audioButtonTitle}
                aria-label={audioButtonTitle}
                disabled={isAudioLoading || audioStatus === "blocked"}
              >
                {isAudioLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-6 w-6 items-center justify-center rounded-full text-white/60 transition hover:text-white">
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
              <audio
                ref={audioRef}
                className="hidden"
                preload="metadata"
                src={audioUrl}
                onLoadedMetadata={() => {
                  const audio = audioRef.current;
                  if (audio && Number.isFinite(audio.duration)) {
                    setAudioDuration(audio.duration);
                  }
                }}
                onTimeUpdate={() => {
                  const audio = audioRef.current;
                  if (audio) {
                    setAudioCurrentTime(audio.currentTime);
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                  setIsPlaying(false);
                  setAudioCurrentTime(0);
                }}
              />
            </div>
          )}
        </div>
        {showAudioBubble && (
          <div className="mt-1.5">
            <div className={`chat-audio-bubble ${isPlaying ? "chat-audio-bubble--playing" : ""}`}>
              {isAudioLoading ? (
                <TypingIndicator />
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    className="audio-play-button"
                    onClick={handleAudioToggle}
                    aria-label={isPlaying ? "Pause audio" : "Play audio"}
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  <div className="flex-1">
                    <div className="audio-wave">
                      {waveformBars.map((height, index) => (
                        <div
                          key={`wave-${message.id}-${index}`}
                          className={`audio-wave-bar ${isPlaying ? "audio-wave-bar--playing" : ""}`}
                          style={{
                            height: `${height}px`,
                            animationDelay: `${index * 0.12}s`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="audio-progress">
                      <div
                        className="audio-progress__fill"
                        style={{ width: `${audioProgress}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-[11px] text-white/60 tabular-nums">
                    {formatAudioTime(audioDuration)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        <div className={`text-xs text-gray-500 mt-1 ${isAI ? 'ml-2' : 'mr-2 text-right'}`}>
          {messageTime}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;
