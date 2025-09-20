/**
 * Character Gallery Component for IntelliSpark AI Chat Application
 * 
 * This component provides an interactive image gallery for characters in the chat interface.
 * Features include:
 * - Image navigation with arrows and dots
 * - Touch/swipe gestures for mobile
 * - Full-screen viewing mode
 * - Keyboard navigation support
 * - Loading states and error handling
 * - Responsive design
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Types
interface GalleryImage {
  id: number;
  url: string;
  thumbnail_url?: string;
  alt_text: string;
  category: string;
  display_order: number;
  is_primary: boolean;
  is_gallery_image: boolean;
}

interface GalleryData {
  character_id: number;
  character_name: string;
  total_images: number;
  gallery_enabled: boolean;
  primary_image: GalleryImage;
  images: GalleryImage[];
  categories: string[];
  last_updated?: string;
  fallback_avatar?: string;
}

interface CharacterGalleryProps {
  characterId: number;
  className?: string;
}

export const CharacterGallery: React.FC<CharacterGalleryProps> = ({ 
  characterId, 
  className = "" 
}) => {
  // State
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<number>>(new Set());

  // Touch handling for swipe gestures
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Fetch gallery data
  const { 
    data: galleryData, 
    isLoading, 
    error,
    refetch 
  } = useQuery<GalleryData>({
    queryKey: ['character-gallery', characterId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/characters/${characterId}/gallery`);
      if (!response.ok) throw new Error(`Failed to fetch gallery: ${response.status}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });

  // Navigation functions
  const goToPrevious = useCallback(() => {
    if (!galleryData?.images.length) return;
    setCurrentImageIndex((prev) => 
      prev === 0 ? galleryData.images.length - 1 : prev - 1
    );
  }, [galleryData?.images.length]);

  const goToNext = useCallback(() => {
    if (!galleryData?.images.length) return;
    setCurrentImageIndex((prev) => 
      prev === galleryData.images.length - 1 ? 0 : prev + 1
    );
  }, [galleryData?.images.length]);

  const goToImage = useCallback((index: number) => {
    if (galleryData?.images && index >= 0 && index < galleryData.images.length) {
      setCurrentImageIndex(index);
    }
  }, [galleryData?.images]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isFullScreen) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
        case 'Escape':
          e.preventDefault();
          setIsFullScreen(false);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFullScreen, goToPrevious, goToNext]);

  // Touch/swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) goToNext();
    if (isRightSwipe) goToPrevious();
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Image error handling
  const handleImageError = (imageId: number) => {
    setImageLoadErrors(prev => {
      const next = new Set(prev);
      next.add(imageId);
      return next;
    });
  };

  const handleImageLoad = (imageId: number) => {
    setImageLoadErrors(prev => {
      const next = new Set(prev);
      next.delete(imageId);
      return next;
    });
  };

  // Reset state when character changes
  useEffect(() => {
    setCurrentImageIndex(0);
    setImageLoadErrors(new Set());
    setIsFullScreen(false);
  }, [characterId]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`character-gallery-loading ${className}`}>
        <div className="relative w-full aspect-[9/16] bg-gray-200 rounded-lg animate-pulse overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
        </div>
        <div className="flex justify-center mt-3 space-x-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" />
          ))}
        </div>
        <div className="text-center mt-2">
          <div className="h-4 bg-gray-300 rounded animate-pulse mx-auto w-24" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !galleryData) {
    return (
      <div className={`character-gallery-error ${className}`}>
        <div className="w-full aspect-[9/16] bg-gray-100 rounded-lg flex flex-col items-center justify-center space-y-3">
          <div className="text-2xl">🖼️</div>
          <span className="text-gray-500 text-sm">无法加载画廊</span>
          <button 
            onClick={() => refetch()}
            className="text-blue-500 hover:text-blue-600 text-sm underline"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // Get current image with fallback
  const currentImage = galleryData.images[currentImageIndex] || galleryData.primary_image;
  const showNavigation = galleryData.gallery_enabled && galleryData.images.length > 1;
  
  if (!currentImage) {
    return (
      <div className={`character-gallery-empty ${className}`}>
        <div className="w-full aspect-[9/16] bg-gray-100 rounded-lg flex items-center justify-center">
          <span className="text-gray-500">暂无图片</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`character-gallery ${className}`}>
      {/* Main Gallery Container */}
      <div 
        className="relative group cursor-pointer"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Main Image */}
        <div className="relative w-full aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden shadow-sm">
          <img
            src={currentImage.url.startsWith('http') ? currentImage.url : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}${currentImage.url}`}
            alt={currentImage.alt_text}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoadErrors.has(currentImage.id) ? 'opacity-0' : 'opacity-100'
            }`}
            loading="lazy"
            onLoad={() => currentImage.id && handleImageLoad(currentImage.id)}
            onError={() => currentImage.id && handleImageError(currentImage.id)}
          />
          
          {/* Image Load Error Fallback */}
          {imageLoadErrors.has(currentImage.id) && (
            <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl mb-2">🖼️</div>
                <span className="text-gray-500 text-sm">图片加载失败</span>
              </div>
            </div>
          )}

          {/* Navigation Arrows */}
          {showNavigation && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 
                          bg-black/50 hover:bg-black/70 text-white rounded-full p-2
                          opacity-0 group-hover:opacity-100 transition-opacity duration-200
                          focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="上一张图片"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <button
                onClick={(e) => { e.stopPropagation(); goToNext(); }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 
                          bg-black/50 hover:bg-black/70 text-white rounded-full p-2
                          opacity-0 group-hover:opacity-100 transition-opacity duration-200
                          focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="下一张图片"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Full Screen Button */}
          <button
            onClick={(e) => { e.stopPropagation(); setIsFullScreen(true); }}
            className="absolute top-2 right-2 
                      bg-black/50 hover:bg-black/70 text-white rounded-full p-2
                      opacity-0 group-hover:opacity-100 transition-opacity duration-200
                      focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="全屏查看"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Primary Image Badge */}
          {currentImage.is_primary && (
            <div className="absolute top-2 left-2">
              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">
                主图
              </span>
            </div>
          )}
        </div>

        {/* Image Indicators */}
        {showNavigation && (
          <div className="flex justify-center mt-3 space-x-2">
            {galleryData.images.map((_, index) => (
              <button
                key={index}
                onClick={() => goToImage(index)}
                className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                  index === currentImageIndex 
                    ? 'bg-blue-500' 
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`查看第 ${index + 1} 张图片`}
              />
            ))}
          </div>
        )}

        {/* Gallery Info */}
        <div className="text-center mt-2 space-y-1">
          {showNavigation && (
            <span className="text-sm text-gray-600">
              📷 {currentImageIndex + 1} / {galleryData.images.length}
            </span>
          )}
          {currentImage.category && currentImage.category !== 'general' && (
            <div className="text-xs text-gray-500">
              {currentImage.category}
            </div>
          )}
        </div>
      </div>

      {/* Full Screen Modal */}
      {isFullScreen && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setIsFullScreen(false)}
        >
          {/* Close Button */}
          <button
            onClick={() => setIsFullScreen(false)}
            className="absolute top-4 right-4 z-10 bg-white/20 hover:bg-white/30 
                      text-white rounded-full p-2 transition-colors"
            aria-label="关闭全屏"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Full Screen Image Container */}
          <div className="relative max-w-5xl max-h-full w-full">
            <img
              src={currentImage.url.startsWith('http') ? currentImage.url : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}${currentImage.url}`}
              alt={currentImage.alt_text}
              className="max-w-full max-h-full object-contain mx-auto block"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* Full Screen Navigation */}
            {showNavigation && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 
                            bg-white/20 hover:bg-white/30 text-white rounded-full p-3
                            transition-colors"
                  aria-label="上一张图片"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                
                <button
                  onClick={(e) => { e.stopPropagation(); goToNext(); }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 
                            bg-white/20 hover:bg-white/30 text-white rounded-full p-3
                            transition-colors"
                  aria-label="下一张图片"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Full Screen Info */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 
                           bg-black/50 text-white px-4 py-2 rounded-lg">
              <div className="text-center text-sm">
                {galleryData.character_name}
                {showNavigation && (
                  <span className="ml-2">
                    ({currentImageIndex + 1} / {galleryData.images.length})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
