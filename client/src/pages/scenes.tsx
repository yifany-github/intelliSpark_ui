import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Scene } from "../types";
import SceneCard from "@/components/scenes/SceneCard";
import ScenePreviewModal from "@/components/scenes/ScenePreviewModal";
import FilterChip from "@/components/ui/FilterChip";
import { Plus } from "lucide-react";
import { useRolePlay } from "@/context/RolePlayContext";
import { useLanguage } from "@/context/LanguageContext";

const FILTER_TYPES = {
  ALL: "All",
  LOCATION: "Location",
  MOOD: "Mood",
  RATING: "Rating"
};

const ScenesPage = () => {
  const [activeFilter, setActiveFilter] = useState(FILTER_TYPES.ALL);
  const [filterValue, setFilterValue] = useState<string | null>(null);
  const { previewScene } = useRolePlay();
  const { t } = useLanguage();
  
  const { data: scenes = [], isLoading, error } = useQuery<Scene[]>({
    queryKey: ["/api/scenes"],
  });

  const [filteredScenes, setFilteredScenes] = useState<Scene[]>([]);
  
  useEffect(() => {
    if (!scenes.length) return;
    
    if (activeFilter === FILTER_TYPES.ALL || !filterValue) {
      setFilteredScenes(scenes);
      return;
    }
    
    const filtered = scenes.filter(scene => {
      if (activeFilter === FILTER_TYPES.LOCATION) {
        return scene.location === filterValue;
      }
      if (activeFilter === FILTER_TYPES.MOOD) {
        return scene.mood === filterValue;
      }
      if (activeFilter === FILTER_TYPES.RATING) {
        return scene.rating === filterValue;
      }
      return true;
    });
    
    setFilteredScenes(filtered);
  }, [scenes, activeFilter, filterValue]);
  
  const handleFilterClick = (filterType: string) => {
    setActiveFilter(filterType);
    setFilterValue(null);
  };

  return (
    <div className="px-4 pt-4 pb-16">
      <h1 className="font-poppins font-bold text-2xl mb-4">{t('scenes')}</h1>
      
      {/* Filters */}
      <div className="flex overflow-x-auto py-2 mb-4 hide-scrollbar">
        <FilterChip 
          label={FILTER_TYPES.ALL} 
          active={activeFilter === FILTER_TYPES.ALL}
          onClick={() => handleFilterClick(FILTER_TYPES.ALL)}
        />
        <FilterChip 
          label={FILTER_TYPES.LOCATION} 
          active={activeFilter === FILTER_TYPES.LOCATION}
          withDropdown
          onClick={() => handleFilterClick(FILTER_TYPES.LOCATION)}
        />
        <FilterChip 
          label={FILTER_TYPES.MOOD} 
          active={activeFilter === FILTER_TYPES.MOOD}
          withDropdown
          onClick={() => handleFilterClick(FILTER_TYPES.MOOD)}
        />
        <FilterChip 
          label={FILTER_TYPES.RATING} 
          active={activeFilter === FILTER_TYPES.RATING}
          withDropdown
          onClick={() => handleFilterClick(FILTER_TYPES.RATING)}
        />
      </div>
      
      {/* Scene Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse bg-secondary rounded-2xl overflow-hidden h-56">
              <div className="w-full h-32 bg-secondary/50"></div>
              <div className="p-3">
                <div className="h-5 bg-secondary/50 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-secondary/50 rounded w-full"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-red-500">Error loading scenes. Please try again.</p>
        </div>
      ) : (
        <div className="masonry-grid">
          {filteredScenes.map((scene) => (
            <SceneCard key={scene.id} scene={scene} />
          ))}
        </div>
      )}
      
      {/* Add New Scene Button */}
      <button className="fixed bottom-20 right-4 sm:right-8 w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center text-white z-10">
        <Plus className="h-6 w-6" />
      </button>
      
      {/* Preview Modal */}
      <ScenePreviewModal />
    </div>
  );
};

export default ScenesPage;
