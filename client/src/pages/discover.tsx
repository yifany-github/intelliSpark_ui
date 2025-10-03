import { useState } from 'react';
import GlobalLayout from "@/components/layout/GlobalLayout";
import DiscoverSection from "@/components/discover/DiscoverSection";

const DiscoverPage = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <GlobalLayout
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      maxContentWidthClass="max-w-[90rem] sm:max-w-[110rem] xl:max-w-[140rem] 2xl:max-w-[160rem]"
    >
      <DiscoverSection searchQuery={searchQuery} />
    </GlobalLayout>
  );
};

export default DiscoverPage;
