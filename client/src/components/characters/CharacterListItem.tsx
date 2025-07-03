import { Character } from "@shared/schema";
import ImageWithFallback from "@/components/ui/ImageWithFallback";

interface CharacterListItemProps {
  character: Character;
  isActive: boolean;
  onClick: () => void;
}

const CharacterListItem = ({ character, isActive, onClick }: CharacterListItemProps) => {
  return (
    <div 
      className={`character-list-item p-3 flex items-center border-b border-secondary cursor-pointer ${
        isActive ? 'active' : ''
      }`}
      onClick={onClick}
    >
      <ImageWithFallback
        src={character.avatarUrl}
        alt={character.name}
        fallbackText={character.name}
        size="md"
        showSpinner={true}
      />
      <div className="ml-3">
        <h3 className="font-medium">{character.name}</h3>
        <div className="flex mt-1 flex-wrap">
          {character.traits.slice(0, 2).map((trait, i) => (
            <span 
              key={i} 
              className="bg-primary/20 text-accent text-xs px-2 py-0.5 rounded-full mr-1 mb-1"
            >
              {trait}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CharacterListItem;
