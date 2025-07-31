import { Character } from "../../types";
import { useRolePlay } from "@/contexts/RolePlayContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import ImageWithFallback from "@/components/ui/ImageWithFallback";

interface CharacterDetailsProps {
  character: Character;
}

const CharacterDetails = ({ character }: CharacterDetailsProps) => {
  const { startChat, startChatPreview } = useRolePlay();
  const { isAuthenticated } = useAuth();
  const [_, navigate] = useLocation();

  const handleStartChat = async () => {
    if (isAuthenticated) {
      // If already authenticated, create chat immediately
      try {
        const chatId = await startChat(character);
        navigate(`/chats/${chatId}`);
      } catch (error) {
        console.error("Failed to start chat:", error);
      }
    } else {
      // Set up preview mode - user can see chat interface and start typing
      startChatPreview(character);
      navigate(`/chat-preview`);
    }
  };

  // Extract personality traits for display
  const personalityTraits = character.personalityTraits || {
    Warmth: 40,
    Humor: 20,
    Intelligence: 95,
    Patience: 75
  };

  return (
    <div className="p-4 overflow-y-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center mb-6">
        <ImageWithFallback
          src={character.avatarUrl}
          alt={character.name}
          fallbackText={character.name}
          size="xl"
          showSpinner={true}
          className="mb-4 sm:mb-0"
        />
        <div className="sm:ml-6">
          <h2 className="font-poppins font-bold text-2xl mb-2">{character.name}</h2>
          <div className="flex flex-wrap">
            {character.traits.map((trait, i) => (
              <span 
                key={i} 
                className="bg-primary/20 text-accent text-sm px-3 py-1 rounded-full mr-2 mb-2"
              >
                {trait}
              </span>
            ))}
          </div>
        </div>
      </div>
      
      <h3 className="font-poppins font-semibold text-lg mb-2">Backstory</h3>
      <p className="text-sm text-gray-300 mb-6 leading-relaxed">
        {character.backstory}
      </p>
      
      <h3 className="font-poppins font-semibold text-lg mb-2">Voice & Speech Pattern</h3>
      <div className="bg-secondary rounded-2xl p-4 mb-6">
        <div className="mb-4">
          <label className="block text-sm mb-2">Voice Style</label>
          <select className="w-full bg-secondary/80 border border-primary rounded-lg p-2 text-white">
            <option>{character.voiceStyle}</option>
          </select>
        </div>
        <button className="flex items-center justify-center bg-primary hover:bg-accent rounded-full px-4 py-2 text-sm font-medium transition-colors">
          <i className="fas fa-volume-up mr-2"></i> Test Voice
        </button>
      </div>
      
      <h3 className="font-poppins font-semibold text-lg mb-2">Personality Traits</h3>
      <div className="grid grid-cols-2 gap-4 mb-6">
        {Object.entries(personalityTraits).map(([trait, value]) => (
          <div key={trait} className="bg-secondary rounded-2xl p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm">{trait}</span>
              <span className="text-sm text-accent">{value}%</span>
            </div>
            <div className="w-full bg-background rounded-full h-2">
              <div 
                className="bg-accent h-2 rounded-full" 
                style={{ width: `${value}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
      
      <button 
        className="w-full bg-primary hover:bg-accent rounded-2xl px-4 py-3 text-white font-medium transition-colors"
        onClick={handleStartChat}
      >
        Start Chat with {character.name}
      </button>
    </div>
  );
};

export default CharacterDetails;
