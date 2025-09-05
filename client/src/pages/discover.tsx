import GlobalLayout from "@/components/layout/GlobalLayout";
import DiscoverSection from "@/components/discover/DiscoverSection";

const DiscoverPage = () => {
  return (
    <GlobalLayout hideSearch>
      <DiscoverSection />
    </GlobalLayout>
  );
};

export default DiscoverPage;
