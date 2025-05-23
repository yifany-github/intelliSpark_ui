import { useState } from "react";
import { Scene } from "@shared/schema";
import { useRolePlay } from "@/context/RolePlayContext";

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
      <div className="w-full h-32 bg-gradient-to-b from-primary/20 to-accent/20">
        {scene.imageUrl && (
          <img 
            src={scene.imageUrl} 
            alt={scene.name} 
            className="w-full h-full object-cover"
          />
        )}
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
