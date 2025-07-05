import { useState } from "react";
import { Scene } from "../../types";
import { useRolePlay } from "@/context/RolePlayContext";
import ImageWithFallback from "@/components/ui/ImageWithFallback";

interface SceneCardProps {
  scene: Scene;
}

const SceneCard = ({ scene }: SceneCardProps) => {
  const { setPreviewScene, setIsPreviewModalOpen } = useRolePlay();
  
  const handleLongPress = () => {
    setPreviewScene(scene);
    setIsPreviewModalOpen(true);
  };

  return (
    <div 
      className="scene-card bg-card rounded-2xl overflow-hidden shadow-soft cursor-pointer hover:translate-y-[-4px] transition-transform duration-200 ease-spring"
      onClick={handleLongPress}
    >
      <div className="w-full h-32 bg-gradient-to-b from-primary/20 to-accent/20 relative overflow-hidden">
        {scene.imageUrl ? (
          <img 
            src={scene.imageUrl.startsWith('http') ? scene.imageUrl : `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}${scene.imageUrl}`}
            alt={scene.name} 
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-accent/20 flex items-center justify-center text-white font-medium text-lg" style={{ display: scene.imageUrl ? 'none' : 'flex' }}>
          {scene.name.split(' ').map(word => word.charAt(0)).join('').toUpperCase().substring(0, 2)}
        </div>
      </div>
      <div className="p-3">
        <div className="flex justify-between items-start">
          <h3 className="font-medium text-white">{scene.name}</h3>
          <span className="bg-accent px-2 py-0.5 rounded-full text-xs">{scene.rating}</span>
        </div>
        <p className="text-sm text-gray-300 mt-1">{scene.description}</p>
      </div>
    </div>
  );
};

export default SceneCard;
