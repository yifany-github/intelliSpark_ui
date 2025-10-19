interface TypingIndicatorProps {
  message?: string;
}

const TypingIndicator = ({ message }: TypingIndicatorProps) => {
  return (
    <div className="flex items-center p-2">
      <div className="flex space-x-1">
        <div className="h-2 w-2 bg-white/70 rounded-full animate-bounce [animation-delay:0ms]"></div>
        <div className="h-2 w-2 bg-white/70 rounded-full animate-bounce [animation-delay:150ms]"></div>
        <div className="h-2 w-2 bg-white/70 rounded-full animate-bounce [animation-delay:300ms]"></div>
      </div>
      {message && (
        <p className="ml-3 text-xs text-white/70">{message}</p>
      )}
    </div>
  );
};

export default TypingIndicator;
