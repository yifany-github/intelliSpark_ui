import React from 'react';

type Msg = { role: 'user'|'assistant'|'system'; content: string; speakerId?: string };

interface StoryChatProps {
  history: Msg[];
  scene?: { speaker?: string; text?: string } | null;
  npcMap?: Record<string, { name?: string; avatarUrl?: string }>;
}

const bubbleBase = 'max-w-[80%] rounded-2xl px-4 py-2 leading-relaxed shadow';

export const StoryChat: React.FC<StoryChatProps> = ({ history, scene, npcMap }) => {
  return (
    <div className="space-y-3">
      {history?.map((m, idx) => {
        const isUser = m.role === 'user';
        const isSystem = m.role === 'system';
        const speaker = m.speakerId && npcMap ? npcMap[m.speakerId] : undefined;
        return (
          <div key={idx} className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2`}>
            {!isUser && (
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                {speaker?.avatarUrl ? (
                  <img src={speaker.avatarUrl} alt={speaker.name || 'NPC'} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-white">{speaker?.name?.[0] || (isSystem ? '旁' : 'N')}</span>
                )}
              </div>
            )}
            <div className={`${bubbleBase} ${isSystem ? 'bg-gray-800 border border-gray-700 text-gray-200' : isUser ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'}`}>
              {m.content}
            </div>
          </div>
        );
      })}

      {scene?.text && (
        <div className="w-full flex justify-start items-end gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
            {scene.speaker && npcMap && npcMap[scene.speaker]?.avatarUrl ? (
              <img src={npcMap[scene.speaker].avatarUrl!} alt={npcMap[scene.speaker].name || 'NPC'} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-white">{(scene.speaker && npcMap && npcMap[scene.speaker]?.name?.[0]) || 'N'}</span>
            )}
          </div>
          <div className={`${bubbleBase} bg-gray-800 border border-gray-700 text-gray-200`}>
            {scene.speaker && npcMap?.[scene.speaker]?.name ? (<div className="text-xs text-gray-400 mb-1">{npcMap[scene.speaker].name}</div>) : null}
            <div>{scene.text}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryChat;
