import React from 'react';

type Msg = { role: 'user'|'assistant'|'system'; content: string };

interface StoryChatProps {
  history: Msg[];
  scene?: { speaker?: string; text?: string } | null;
}

const bubbleBase = 'max-w-[80%] rounded-2xl px-4 py-2 leading-relaxed shadow';

export const StoryChat: React.FC<StoryChatProps> = ({ history, scene }) => {
  return (
    <div className="space-y-3">
      {history?.map((m, idx) => {
        const isUser = m.role === 'user';
        const isSystem = m.role === 'system';
        return (
          <div key={idx} className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`${bubbleBase} ${isSystem ? 'bg-gray-800 border border-gray-700 text-gray-200' : isUser ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'}`}>
              {m.content}
            </div>
          </div>
        );
      })}

      {scene?.text && (
        <div className="w-full flex justify-start">
          <div className={`${bubbleBase} bg-gray-800 border border-gray-700 text-gray-200`}>
            {scene.speaker ? (<div className="text-xs text-gray-400 mb-1">{scene.speaker}</div>) : null}
            <div>{scene.text}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryChat;

