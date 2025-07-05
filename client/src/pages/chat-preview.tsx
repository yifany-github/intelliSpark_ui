import { useState } from 'react';
import { useRolePlay } from '../context/RolePlayContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'wouter';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import { Send, ArrowLeft } from 'lucide-react';

const ChatPreviewPage = () => {
  const { 
    selectedScene, 
    selectedCharacter, 
    requestAuthForMessage,
    startChat
  } = useRolePlay();
  const { isAuthenticated } = useAuth();
  const [_, navigate] = useLocation();
  const [message, setMessage] = useState('');

  // If no scene/character selected, redirect back
  if (!selectedScene || !selectedCharacter) {
    navigate('/');
    return null;
  }

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    if (isAuthenticated) {
      // If authenticated, create real chat and send message
      try {
        const chatId = await startChat(selectedScene, selectedCharacter);
        navigate(`/chats/${chatId}`);
        // The actual message sending will be handled by the chat page
      } catch (error) {
        console.error("Failed to start chat:", error);
      }
    } else {
      // Show auth modal with pending message
      requestAuthForMessage(message.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Chat Header */}
      <div className="px-4 pt-4 pb-3 border-b border-secondary sticky top-0 bg-background z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button 
              className="mr-3 text-gray-400"
              onClick={() => navigate('/characters')}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center">
              <ImageWithFallback
                src={selectedCharacter.avatarUrl}
                alt={selectedCharacter.name}
                fallbackText={selectedCharacter.name}
                size="md"
                showSpinner={true}
                className="w-10 h-10"
              />
              <div className="ml-3">
                <h2 className="font-medium text-white">
                  {selectedCharacter.name}
                </h2>
                <div className="flex items-center text-xs text-gray-400">
                  <span>{selectedScene.name}</span>
                  <i className="fas fa-circle text-[6px] mx-2"></i>
                  <span>Tokens: 3,250</span>
                </div>
              </div>
            </div>
          </div>
          <button className="w-8 h-8 flex items-center justify-center text-gray-400">
            <i className="fas fa-ellipsis-v"></i>
          </button>
        </div>
      </div>
      
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome Message */}
        <div className="flex items-start mb-4">
          <ImageWithFallback
            src={selectedCharacter.avatarUrl}
            alt={selectedCharacter.name}
            fallbackText={selectedCharacter.name}
            size="sm"
            showSpinner={true}
            className="mr-2"
          />
          <div className="max-w-[80%]">
            <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tl-md px-4 py-3">
              <p className="text-sm text-white">
                Welcome to {selectedScene.name}! I'm {selectedCharacter.name}. How can I assist you today?
              </p>
            </div>
          </div>
        </div>

        {/* Preview Notice */}
        {!isAuthenticated && (
          <div className="flex justify-center mb-4">
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 max-w-md">
              <p className="text-sm text-blue-300 text-center">
                💬 This is a chat preview. Send a message to continue the conversation!
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Chat Input */}
      <div className="p-3 border-t border-secondary bg-background sticky bottom-0">
        <div className="flex items-center bg-secondary rounded-2xl px-3 py-2">
          <button className="text-gray-400 mr-3">
            <i className="fas fa-smile h-5 w-5"></i>
          </button>
          
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              isAuthenticated 
                ? "Type a message..." 
                : "Start typing to begin chatting..."
            }
            className="flex-grow bg-transparent border-0 focus:outline-none text-white resize-none"
          />
          
          <button className="ml-3 text-gray-400">
            <i className="fas fa-paperclip h-5 w-5"></i>
          </button>
          
          <button 
            className={`ml-3 w-8 h-8 ${!message.trim() ? 'bg-secondary' : 'bg-primary'} rounded-full flex items-center justify-center text-white ${
              !message.trim() ? 'opacity-50' : 'hover:bg-accent transition-colors'
            }`}
            onClick={handleSendMessage}
            disabled={!message.trim()}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        
        <div className="flex justify-between items-center mt-2 px-1 text-xs text-gray-400">
          <div className="flex">
            <button className="mr-3 flex items-center">
              <i className="fas fa-slash h-4 w-4 mr-1"></i> Commands
            </button>
            
            <button className="flex items-center">
              <i className="fas fa-palette h-4 w-4 mr-1"></i> Tone
            </button>
          </div>
          
          <div>Markdown supported</div>
        </div>
      </div>
    </div>
  );
};

export default ChatPreviewPage;