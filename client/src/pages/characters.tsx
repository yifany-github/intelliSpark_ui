import { useState } from 'react';
import GlobalLayout from "@/components/layout/GlobalLayout";
import CharacterGrid from "@/components/characters/CharacterGrid";

const CharactersPage = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <GlobalLayout 
      searchQuery={searchQuery} 
      onSearchChange={setSearchQuery}
    >
      <div className="w-full h-full overflow-auto">
        <CharacterGrid searchQuery={searchQuery} />
      </div>
    </GlobalLayout>
  );
};

export default CharactersPage;
