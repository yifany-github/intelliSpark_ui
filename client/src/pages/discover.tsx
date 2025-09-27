import GlobalLayout from "@/components/layout/GlobalLayout";
import DiscoverSection from "@/components/discover/DiscoverSection";

const DiscoverPage = () => {
  return (
    <GlobalLayout hideSearch maxContentWidthClass="max-w-[90rem] sm:max-w-[110rem] xl:max-w-[140rem] 2xl:max-w-[160rem]">
      <DiscoverSection />
    </GlobalLayout>
  );
};

export default DiscoverPage;
