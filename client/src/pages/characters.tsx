import { useState } from 'react';
import GlobalLayout from "@/components/layout/GlobalLayout";
import CharacterGrid from "@/components/characters/CharacterGrid";
import CharacterHero from "@/components/characters/CharacterHero";

const CharactersPage = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <GlobalLayout
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      maxContentWidthClass="max-w-[140rem] 2xl:max-w-[150rem] 3xl:max-w-[160rem]"
      contentPaddingClass="px-2 sm:px-4 lg:px-6 xl:px-8 py-6 lg:py-10"
    >
      <div className="space-y-8">
        <CharacterHero />
        <CharacterGrid searchQuery={searchQuery} />
      </div>
    </GlobalLayout>
  );
};

export default CharactersPage;
