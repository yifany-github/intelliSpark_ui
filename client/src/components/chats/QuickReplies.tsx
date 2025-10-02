import { Sparkles } from 'lucide-react';

interface QuickRepliesProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  isLoading?: boolean;
}

const QuickReplies = ({ suggestions, onSelect, isLoading }: QuickRepliesProps) => {
  if (!suggestions.length || isLoading) return null;

  return (
    <div className="px-3 pb-2 overflow-x-auto hide-scrollbar">
      <div className="flex gap-2 pb-1">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelect(suggestion)}
            className="quick-reply-chip flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap group"
          >
            <Sparkles className="w-3 h-3 inline-block mr-1.5 opacity-60 group-hover:opacity-100 transition-opacity" />
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickReplies;
