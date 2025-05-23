import { Character } from "@shared/schema";

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
      <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-r from-primary/40 to-accent/40">
        {character.avatarUrl && (
          <img 
            src={character.avatarUrl} 
            alt={character.name} 
            className="w-full h-full object-cover"
          />
        )}
      </div>
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
