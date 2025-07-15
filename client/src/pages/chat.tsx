import { useState, useEffect, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Image, Settings, MoreVertical, ArrowLeft, Heart, Star, Share, Bookmark, Menu, X } from 'lucide-react';
import { Character, ChatMessage } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRolePlay } from '@/context/RolePlayContext';
import GlobalLayout from '@/components/layout/GlobalLayout';

interface ChatPageProps {
  chatId?: string;
}

const ChatPage = ({ chatId }: ChatPageProps) => {
  const [_, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { selectedCharacter } = useRolePlay();
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showChatList, setShowChatList] = useState(false);
  const [showCharacterInfo, setShowCharacterInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Mock messages for demonstration
  const [messages] = useState<ChatMessage[]>([
    {
      id: 1,
      chatId: 1,
      role: 'assistant',
      content: 'NOT IN COSPLAY DURING INTRO! You arrived home from college late last night. No one was home save for you so you crashed for a solid mandatory sleepy time.',
      timestamp: new Date('2024-01-01T11:31:00Z').toISOString()
    },
    {
      id: 2,
      chatId: 1,
      role: 'assistant',
      content: `Now initially, feeling the freesia in your shoulders, as you walk down the hallway. Then just as you are passing your brother's room, his door swings open. He stands in the doorway, and you stride all your presence to the hall down by his phone. He's not even shut yet and if you could consider distracted, all his pink rangá and front below a very oversized shirt.

His eyes flick away from his phone just enough to notice you staring, and a huge smile spread across his face.

Kris: "Omg! Good morning lil bro~ You slept ok? Welcome home! Apologies for the...`,
      timestamp: new Date('2024-01-01T11:35:00Z').toISOString()
    }
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !isAuthenticated) return;

    const newMessage = message;
    setMessage('');
    setIsTyping(true);

    // Here you would typically call the API to send the message
    // For now, just simulate a response
    setTimeout(() => {
      setIsTyping(false);
    }, 2000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Query for character data if we have a chat ID
  const { data: character } = useQuery({
    queryKey: ['chat-character', chatId],
    queryFn: async () => {
      if (selectedCharacter) {
        return selectedCharacter;
      }
      
      // If no selected character, use default character
      return {
        id: 1,
        name: "艾莉丝",
        avatarUrl: '/assets/characters_img/Elara.jpeg',
        backstory: 'Elara is the last of an ancient line of arcane practitioners who once advised kings and queens throughout the realm. After centuries of extending her life through magical means, she has accumulated vast knowledge but has grown somewhat detached from humanity.',
        voiceStyle: 'Mystical and wise',
        traits: ['Mage', 'Wise', 'Ancient', 'Mysterious'],
        personalityTraits: {},
        createdAt: new Date().toISOString()
      };
    },
    enabled: true
  });

  // Use selected character or default character
  const currentCharacter = character || selectedCharacter || {
    id: 1,
    name: "艾莉丝",
    avatarUrl: '/assets/characters_img/Elara.jpeg',
    backstory: 'Elara is the last of an ancient line of arcane practitioners who once advised kings and queens throughout the realm.',
    voiceStyle: 'Mystical and wise',
    traits: ['Mage', 'Wise', 'Ancient', 'Mysterious'],
    personalityTraits: {},
    createdAt: new Date().toISOString()
  };

  return (
    <GlobalLayout showSidebar={false}>
      <div className="h-full bg-gray-900 text-white flex relative">
        {/* Mobile overlay */}
        {showChatList && (
          <div 
            className="fixed inset-0 bg-black/50 z-5 lg:hidden" 
            onClick={() => setShowChatList(false)}
          />
        )}
        
        {/* Left Sidebar - Recent Chats */}
        <div className={`${showChatList ? 'flex' : 'hidden'} lg:flex w-full lg:w-64 bg-gray-800 border-r border-gray-700 flex-shrink-0 flex-col absolute lg:relative z-10 h-full lg:h-auto`}>
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Chats</h2>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => navigate('/')}
                  className="hidden lg:block p-1 hover:bg-gray-700 rounded transition-colors"
                  title="Back to Characters"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setShowChatList(false)}
                  className="lg:hidden p-1 hover:bg-gray-700 rounded transition-colors"
                  title="Close chat list"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
                All
              </button>
              <button className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full hover:bg-gray-600">
                Favorites
              </button>
              <button className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full hover:bg-gray-600">
                Archived
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {/* Current Active Chat */}
            <div className="p-3 bg-blue-600/20 border-l-4 border-blue-500">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <img 
                    src={currentCharacter.avatarUrl} 
                    alt={currentCharacter.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-blue-200 truncate">{currentCharacter.name}</p>
                  <p className="text-sm text-blue-300 truncate">Currently chatting</p>
                </div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              </div>
            </div>
            
            {/* Divider */}
            <div className="px-4 py-2">
              <div className="border-t border-gray-600"></div>
            </div>
            
            {/* Other recent chats would go here */}
          </div>
          
          {/* Recent Chats List */}
          <div className="p-4 border-t border-gray-700">
            <h3 className="text-sm text-gray-400 mb-3">Recent Conversations</h3>
            <div className="space-y-2">
              {/* Mock recent chats - in real app this would come from API */}
              {[
                { id: 1, name: "Elara", lastMessage: "Tell me about your magic...", time: "2m ago", avatar: "/assets/characters_img/Elara.jpeg" },
                { id: 2, name: "Marcus", lastMessage: "Ready for training?", time: "1h ago", avatar: "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg" },
                { id: 3, name: "Luna", lastMessage: "The stars are beautiful...", time: "3h ago", avatar: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg" }
              ].map((chat, index) => (
                <div key={chat.id} className="flex items-center space-x-3 p-2 rounded hover:bg-gray-700 cursor-pointer transition-colors">
                  <img 
                    src={chat.avatar} 
                    alt={chat.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{chat.name}</p>
                    <p className="text-xs text-gray-400 truncate">{chat.lastMessage}</p>
                  </div>
                  <span className="text-xs text-gray-500">{chat.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-2 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              {/* Mobile menu button */}
              <button 
                onClick={() => setShowChatList(!showChatList)}
                className="lg:hidden p-1 hover:bg-gray-700 rounded transition-colors"
              >
                {showChatList ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              
              <img 
                src={currentCharacter.avatarUrl} 
                alt={currentCharacter.name}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <h1 className="font-semibold truncate">{currentCharacter.name}</h1>
                <p className="text-xs sm:text-sm text-gray-400">Online now</p>
              </div>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <button 
                onClick={() => setShowCharacterInfo(!showCharacterInfo)}
                className="xl:hidden p-2 hover:bg-gray-700 rounded transition-colors"
                title="Character Info"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button className="p-2 hover:bg-gray-700 rounded transition-colors">
                <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 sm:space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="flex space-x-2 sm:space-x-3">
              <img 
                src={currentCharacter.avatarUrl} 
                alt={currentCharacter.name}
                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-medium text-sm">{currentCharacter.name}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(msg.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
                <div className="max-w-2xl">
                  {msg.content.includes('[Image:') ? (
                    <div className="space-y-2">
                      <div className="bg-gray-800 rounded-lg p-3">
                        <p className="text-gray-100 leading-relaxed">
                          {msg.content.replace(/\[Image:.*?\]/g, '').trim()}
                        </p>
                      </div>
                      <div className="relative">
                        <img
                          src={currentCharacter.avatarUrl}
                          alt={currentCharacter.name}
                          className="w-64 h-96 object-cover rounded-lg border-2 border-blue-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-gray-100 leading-relaxed whitespace-pre-line">{msg.content}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex space-x-3">
              <img 
                src={currentCharacter.avatarUrl} 
                alt={currentCharacter.name}
                className="w-8 h-8 rounded-full object-cover mt-1"
              />
              <div className="flex-1">
                <div className="bg-gray-800 rounded-lg p-3 max-w-xs">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="bg-gray-800 border-t border-gray-700 p-2 sm:p-4">
          <div className="flex items-end space-x-2 sm:space-x-3">
            <button className="p-2 hover:bg-gray-700 rounded transition-colors">
              <Image className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            </button>
            <div className="flex-1">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-gray-400 resize-none focus:outline-none focus:border-blue-500 text-sm sm:text-base"
                rows={1}
                style={{ minHeight: '40px', maxHeight: '120px' }}
              />
            </div>
            <button 
              onClick={handleSendMessage}
              disabled={!message.trim() || !isAuthenticated}
              className="p-2 sm:p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Character Info Modal for mobile/tablet */}
      {showCharacterInfo && (
        <div className="fixed inset-0 bg-black/50 z-20 xl:hidden flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Character Info</h3>
              <button 
                onClick={() => setShowCharacterInfo(false)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="text-center mb-4">
                <img 
                  src={currentCharacter.avatarUrl}
                  alt={currentCharacter.name}
                  className="w-32 h-48 object-cover rounded-lg mx-auto mb-3"
                />
                <h4 className="font-semibold text-lg mb-2">{currentCharacter.name}</h4>
                <div className="flex items-center justify-center space-x-4 mb-4 text-sm text-gray-400">
                  <div className="flex items-center space-x-1">
                    <Heart className="w-4 h-4" />
                    <span>167</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4" />
                    <span>438</span>
                  </div>
                </div>
                <p className="text-sm text-gray-300 mb-4">{currentCharacter.backstory}</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {currentCharacter.traits.map((trait, index) => (
                    <span 
                      key={index}
                      className="px-2 py-1 rounded-full text-xs font-medium bg-gray-600 text-white"
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right Sidebar - Character Info */}
      <div className="w-full lg:w-80 bg-gray-800 border-l border-gray-700 flex-shrink-0 hidden xl:flex xl:flex-col">
        {/* Character Image */}
        <div className="relative">
          <img 
            src={currentCharacter.avatarUrl}
            alt={currentCharacter.name}
            className="w-full h-96 object-cover"
          />
          <div className="absolute top-4 right-4 flex space-x-2">
            <button className="p-2 bg-black/50 hover:bg-black/70 rounded-full">
              <Heart className="w-4 h-4" />
            </button>
            <button className="p-2 bg-black/50 hover:bg-black/70 rounded-full">
              <Bookmark className="w-4 h-4" />
            </button>
            <button className="p-2 bg-black/50 hover:bg-black/70 rounded-full">
              <Share className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Character Info */}
        <div className="flex-1 p-4">
          <h3 className="font-semibold text-lg mb-2">{currentCharacter.name}</h3>
          
          {/* Stats */}
          <div className="flex items-center space-x-4 mb-4 text-sm text-gray-400">
            <div className="flex items-center space-x-1">
              <Heart className="w-4 h-4" />
              <span>167</span>
            </div>
            <div className="flex items-center space-x-1">
              <Star className="w-4 h-4" />
              <span>438</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>👁</span>
              <span>1</span>
            </div>
            <button className="ml-auto text-blue-400 hover:text-blue-300">
              Donate
            </button>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-300 mb-4 leading-relaxed">
            {currentCharacter.backstory}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            {currentCharacter.traits.map((trait, index) => (
              <span 
                key={index}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  trait === 'NSFW' ? 'bg-red-600 text-white' :
                  trait === 'Alternative' ? 'bg-blue-600 text-white' :
                  trait === 'Fantasy' ? 'bg-blue-600 text-white' :
                  trait === 'Gay' ? 'bg-pink-600 text-white' :
                  'bg-gray-600 text-white'
                }`}
              >
                {trait}
              </span>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors">
              Start New Chat
            </button>
            <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors">
              Save Memories
            </button>
            <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors">
              View Memories
            </button>
            <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors">
              Chat Settings
            </button>
            <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors">
              Character Detail
            </button>
          </div>
        </div>
      </div>
      </div>
    </GlobalLayout>
  );
};

export default ChatPage;