import { useRolePlay } from "@/context/RolePlayContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

// Utility function to convert relative URLs to absolute URLs
const getAbsoluteUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  return `${API_BASE_URL}${url}`;
};

const ScenePreviewModal = () => {
  const { 
    isPreviewModalOpen, 
    setIsPreviewModalOpen, 
    previewScene,
    startChat,
    startChatPreview,
    selectedCharacter,
  } = useRolePlay();
  
  const { isAuthenticated } = useAuth();
  const [_, navigate] = useLocation();

  const handleClose = () => {
    setIsPreviewModalOpen(false);
  };

  const handleStartChat = async () => {
    if (!previewScene || !selectedCharacter) {
      // If no character is selected, redirect to characters page
      if (!selectedCharacter) {
        navigate("/characters");
        handleClose();
        return;
      }
      return;
    }

    if (isAuthenticated) {
      // If already authenticated, create chat immediately
      try {
        const chatId = await startChat(previewScene, selectedCharacter);
        handleClose();
        navigate(`/chats/${chatId}`);
      } catch (error) {
        console.error("Failed to start chat:", error);
      }
    } else {
      // Set up preview mode - user can see chat interface and start typing
      startChatPreview(previewScene, selectedCharacter);
      handleClose(); // Close the scene modal
      navigate(`/chat-preview`);
    }
  };

  if (!isPreviewModalOpen || !previewScene) return null;

  const absoluteImageUrl = getAbsoluteUrl(previewScene.imageUrl);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl w-full max-w-md overflow-hidden">
        <div 
          className="h-40 bg-cover bg-center bg-gradient-to-b from-primary/20 to-accent/20" 
          style={{ 
            backgroundImage: absoluteImageUrl ? `url(${absoluteImageUrl})` : undefined
          }}
        >
          {!absoluteImageUrl && (
            <div className="h-full flex items-center justify-center text-white font-medium text-lg">
              {previewScene.name.split(' ').map(word => word.charAt(0)).join('').toUpperCase().substring(0, 2)}
            </div>
          )}
        </div>
        
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-poppins font-bold text-xl">{previewScene.name}</h3>
            <span className="bg-accent px-2 py-0.5 rounded-full text-xs">{previewScene.rating}</span>
          </div>
          
          <p className="text-sm text-gray-300 mb-4">
            {previewScene.description}
          </p>
          
          <div className="bg-secondary rounded-xl p-3 mb-4">
            <p className="italic text-sm text-gray-300">
              "Welcome to {previewScene.name}. The perfect place for your roleplay adventure."
            </p>
            <p className="italic text-sm text-gray-300 mt-2">
              "What would you like to explore in this {previewScene.mood} environment?"
            </p>
          </div>
          
          <div className="flex space-x-3">
            <button 
              className="flex-1 bg-secondary rounded-xl px-4 py-2 text-white"
              onClick={handleClose}
            >
              Close
            </button>
            <button 
              className="flex-1 bg-primary rounded-xl px-4 py-2 text-white"
              onClick={handleStartChat}
            >
              Start Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScenePreviewModal;
