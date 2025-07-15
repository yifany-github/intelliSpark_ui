import { useState } from 'react';
import GlobalLayout from "@/components/layout/GlobalLayout";
import DiscoverSection from "@/components/discover/DiscoverSection";

const DiscoverPage = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <GlobalLayout 
      searchQuery={searchQuery} 
      onSearchChange={setSearchQuery}
    >
      <DiscoverSection />
    </GlobalLayout>
  );
};

export default DiscoverPage;