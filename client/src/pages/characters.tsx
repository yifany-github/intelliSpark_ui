import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Character } from "../types";
import CharacterListItem from "@/components/characters/CharacterListItem";
import CharacterDetails from "@/components/characters/CharacterDetails";
import { Search, Filter } from "lucide-react";
import { useRolePlay } from "@/context/RolePlayContext";
import { useLanguage } from "@/context/LanguageContext";

const CharactersPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { selectedCharacter, setSelectedCharacter } = useRolePlay();
  const { t } = useLanguage();
  
  const { data: characters = [], isLoading, error } = useQuery<Character[]>({
    queryKey: ["/api/characters"],
  });
  
  const filteredCharacters = characters.filter(character => 
    character.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    character.traits.some(trait => 
      trait.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );
  
  const handleSelectCharacter = (character: Character) => {
    setSelectedCharacter(character);
  };

  return (
    <div className="h-full">
      <h1 className="font-poppins font-bold text-2xl px-4 pt-4 mb-2">{t('characters')}</h1>
      
      {/* Search and Filter */}
      <div className="px-4 mb-4 flex">
        <div className="relative flex-grow">
          <input 
            type="text" 
            placeholder={t('searchCharacters')} 
            className="w-full bg-secondary rounded-2xl px-10 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
        </div>
        <button className="ml-2 bg-secondary p-2 rounded-full">
          <Filter className="text-white h-5 w-5" />
        </button>
      </div>
      
      {/* Split View for Characters */}
      <div className="flex flex-col sm:flex-row h-[calc(100vh-180px)]">
        {/* Left panel - Character List */}
        <div className="w-full sm:w-1/3 border-r border-secondary overflow-y-auto">
          {isLoading ? (
            // Loading skeleton
            [...Array(5)].map((_, i) => (
              <div key={i} className="p-3 flex items-center border-b border-secondary animate-pulse">
                <div className="w-12 h-12 rounded-full bg-secondary/50"></div>
                <div className="ml-3 w-full">
                  <div className="h-5 bg-secondary/50 rounded w-1/2 mb-2"></div>
                  <div className="flex">
                    <div className="h-4 bg-secondary/50 rounded w-16 mr-1"></div>
                    <div className="h-4 bg-secondary/50 rounded w-16"></div>
                  </div>
                </div>
              </div>
            ))
          ) : error ? (
            <div className="p-4 text-center text-red-500">
              Error loading characters
            </div>
          ) : filteredCharacters.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              No characters found
            </div>
          ) : (
            filteredCharacters.map(character => (
              <CharacterListItem 
                key={character.id}
                character={character}
                isActive={selectedCharacter?.id === character.id}
                onClick={() => handleSelectCharacter(character)}
              />
            ))
          )}
        </div>
        
        {/* Right panel - Character Details */}
        <div className="w-full sm:w-2/3 overflow-y-auto">
          {selectedCharacter ? (
            <CharacterDetails character={selectedCharacter} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-4">
                <h3 className="font-poppins text-xl mb-2">{t('selectCharacter')}</h3>
                <p className="text-gray-400">{t('chooseCharacter')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CharactersPage;
