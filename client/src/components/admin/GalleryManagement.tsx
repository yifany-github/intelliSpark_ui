import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import {
  Upload,
  Trash2,
  Star,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  Grid3X3,
  Filter,
  MoreVertical,
  Eye,
  Download,
  ImagePlus
} from 'lucide-react';

interface GalleryImage {
  id: number;
  url: string;
  thumbnail_url?: string;
  alt_text?: string;
  category: string;
  display_order: number;
  is_primary: boolean;
  file_size?: number;
  dimensions?: string;
  file_format?: string;
  created_at: string;
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

interface GalleryManagementProps {
  characterId: number;
  galleryEnabled: boolean;
  onGalleryChange?: (enabled: boolean) => void;
  authHeaders: Record<string, string>;
  className?: string;
  // For creation mode - manage local state instead of API calls
  isCreationMode?: boolean;
  pendingImages?: File[];
  onPendingImagesChange?: (images: File[]) => void;
}

const GALLERY_CATEGORIES = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'outfit', label: 'Outfit' },
  { value: 'expression', label: 'Expression' },
  { value: 'scene', label: 'Scene' },
  { value: 'general', label: 'General' }
];

export function GalleryManagement({ 
  characterId, 
  galleryEnabled,
  onGalleryChange,
  authHeaders,
  className = "",
  isCreationMode = false,
  pendingImages = [],
  onPendingImagesChange
}: GalleryManagementProps) {
  const [selectedImages, setSelectedImages] = useState<number[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [uploadCategory, setUploadCategory] = useState<string>('general');
  const [uploadAltText, setUploadAltText] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; preview: string; progress: number }[]>([]);
  const [bulkCategory, setBulkCategory] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch gallery data
  const { data: galleryData, isLoading, error } = useQuery<GalleryData>({
    queryKey: ['character-gallery', characterId],
    queryFn: async () => {
      // Use admin API endpoints in admin context
      const response = await fetch(`/api/admin/characters/${characterId}/gallery`, {
        headers: authHeaders,
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch gallery data');
      }
      
      return response.json();
    },
    enabled: !!characterId && galleryEnabled
  });

  // Upload image mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/admin/characters/${characterId}/gallery/images`, {
        method: 'POST',
        headers: authHeaders,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character-gallery', characterId] });
      toast({ title: 'Success', description: 'Image uploaded successfully' });
      setUploadAltText('');
      setUploadProgress(0);
      // Mark first in-queue uploading file as complete and remove after a delay
      setUploadingFiles((prev) => {
        if (prev.length === 0) return prev;
        const idx = prev.findIndex(f => f.progress < 100);
        if (idx === -1) return prev;
        const next = prev.slice();
        next[idx] = { ...next[idx], progress: 100 };
        const previewToRevoke = next[idx].preview;
        setTimeout(() => {
          URL.revokeObjectURL(previewToRevoke);
          setUploadingFiles((curr) => curr.filter((_, i) => i !== idx));
        }, 700);
        return next;
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Upload Failed', 
        description: error.message,
        variant: 'destructive'
      });
      setUploadProgress(0);
      setUploadingFiles((prev) => {
        if (prev.length === 0) return prev;
        URL.revokeObjectURL(prev[0].preview);
        return prev.slice(1);
      });
    }
  });

  // Set primary image mutation
  const setPrimaryMutation = useMutation({
    mutationFn: async (imageId: number) => {
      const response = await fetch(`/api/admin/characters/${characterId}/gallery/images/${imageId}/primary`, {
        method: 'PUT',
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error('Failed to set primary image');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character-gallery', characterId] });
      toast({ title: 'Success', description: 'Primary image updated' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Delete image mutation
  const deleteMutation = useMutation({
    mutationFn: async (imageId: number) => {
      const response = await fetch(`/api/admin/characters/${characterId}/gallery/images/${imageId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error('Failed to delete image');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character-gallery', characterId] });
      // Clear selection of deleted items is handled by bulk delete or item-level actions
      toast({ title: 'Success', description: 'Image deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Reorder images mutation  
  const reorderMutation = useMutation({
    mutationFn: async (imageOrder: { image_id: number; display_order: number }[]) => {
      const response = await fetch(`/api/admin/characters/${characterId}/gallery/reorder`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(imageOrder)
      });

      if (!response.ok) {
        throw new Error('Failed to reorder images');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character-gallery', characterId] });
      toast({ title: 'Success', description: 'Images reordered successfully' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleFileUpload = useCallback(async (files: FileList) => {
    if (!files.length) return;

    // If in creation mode, just add to pending images list
    if (isCreationMode && onPendingImagesChange) {
      const validFiles = Array.from(files).filter(file => {
        if (!file.type.startsWith('image/')) {
          toast({
            title: 'Invalid File',
            description: 'Please select only image files',
            variant: 'destructive'
          });
          return false;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: 'File Too Large',
            description: 'Please select images smaller than 10MB',
            variant: 'destructive'
          });
          return false;
        }
        return true;
      });
      
      onPendingImagesChange([...pendingImages, ...validFiles]);
      toast({ title: 'Images Added', description: `${validFiles.length} image(s) will be uploaded when character is saved` });
      return;
    }

    // Existing mode - upload immediately
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid File',
          description: 'Please select only image files',
          variant: 'destructive'
        });
        continue;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: 'File Too Large',
          description: 'Please select images smaller than 10MB',
          variant: 'destructive'
        });
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', uploadCategory);
      formData.append('alt_text', uploadAltText || `${galleryData?.character_name || 'Character'} gallery image`);
      formData.append('is_primary', 'false');

      // Show local preview while uploading
      const objectUrl = URL.createObjectURL(file);
      setUploadingFiles((prev) => [...prev, { name: file.name, preview: objectUrl, progress: 10 }]);
      setUploadProgress(10);
      await uploadMutation.mutateAsync(formData);
    }
  }, [uploadCategory, uploadAltText, uploadMutation, galleryData?.character_name]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileUpload(e.target.files);
    }
  }, [handleFileUpload]);

  const moveImage = useCallback((imageId: number, direction: 'up' | 'down') => {
    if (!galleryData?.images) return;

    const currentIndex = galleryData.images.findIndex(img => img.id === imageId);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= galleryData.images.length) return;

    const reorderedImages = [...galleryData.images];
    [reorderedImages[currentIndex], reorderedImages[newIndex]] = [reorderedImages[newIndex], reorderedImages[currentIndex]];
    
    const imageOrder = reorderedImages.map((img, index) => ({
      image_id: img.id,
      display_order: index
    }));

    reorderMutation.mutate(imageOrder);
  }, [galleryData?.images, reorderMutation]);

  const handleBulkDelete = useCallback(async () => {
    if (!selectedImages.length) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedImages.length} image(s)?`)) {
      return;
    }

    for (const imageId of selectedImages) {
      await deleteMutation.mutateAsync(imageId);
    }
    setSelectedImages([]);
  }, [selectedImages, deleteMutation]);

  const toggleImageSelection = useCallback((imageId: number) => {
    setSelectedImages(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  }, []);

  const selectAllImages = useCallback(() => {
    if (filteredImages.length === selectedImages.length) {
      setSelectedImages([]);
    } else {
      setSelectedImages(filteredImages.map(img => img.id));
    }
  }, [galleryData?.images, selectedImages, categoryFilter]);

  const filteredImages = galleryData?.images.filter(img => 
    categoryFilter === 'all' || img.category === categoryFilter
  ) || [];

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (!galleryEnabled) {
    return (
      <div className={`p-4 bg-slate-50 rounded-lg border border-slate-200 ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <ImageIcon className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Gallery Management</span>
        </div>
        <p className="text-sm text-slate-600">
          Gallery is currently disabled. Enable the checkbox above to manage character images.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <ImageIcon className="h-4 w-4 text-slate-600" />
        <span className="text-sm font-medium text-slate-900">Gallery Management</span>
        {isCreationMode && pendingImages.length > 0 && (
          <Badge className="text-xs bg-slate-200 text-slate-800 border border-slate-300">
            {pendingImages.length} pending
          </Badge>
        )}
        {galleryData && (
          <Badge className="text-xs bg-slate-200 text-slate-800 border border-slate-300">
            {galleryData.total_images} images
          </Badge>
        )}
      </div>
        {/* Gallery Status - Only show in editing mode */}
        {!isCreationMode && galleryData && (
          <div className="p-4 bg-slate-50 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-900">Gallery Status</span>
              <Badge className={galleryData.gallery_enabled 
                ? "bg-green-100 text-green-800 border border-green-200" 
                : "bg-slate-200 text-slate-700 border border-slate-300"
              }>
                {galleryData.gallery_enabled ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              {galleryData.total_images} images • Last updated: {
                galleryData.last_updated 
                  ? new Date(galleryData.last_updated).toLocaleDateString()
                  : "Never"
              }
            </p>
            {galleryData.categories.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {galleryData.categories.map(category => (
                  <Badge key={category} className="text-xs bg-slate-100 text-slate-800 border border-slate-200">
                    {category}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* creation-mode pending previews handled below with real image previews */}

        {/* Upload Interface */}
        <div className="space-y-4">
          <Label className="text-sm font-medium text-slate-900">
            {isCreationMode ? 'Add Gallery Images' : 'Upload New Images'}
          </Label>
          
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-slate-300 hover:border-slate-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileInputChange}
            />
            <div className="flex flex-col items-center">
              <Upload className="mx-auto h-12 w-12 text-slate-400 mb-2" />
              <p className="text-sm text-slate-600 mb-1">
                Drop images here or{' '}
                <button
                  type="button"
                  className="text-blue-600 underline hover:text-blue-700"
                  onClick={() => fileInputRef.current?.click()}
                >
                  click to upload
                </button>
              </p>
              <p className="text-xs text-slate-500">PNG, JPG, WebP up to 10MB each</p>
            </div>
          </div>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <Progress value={uploadProgress} className="w-full" />
          )}

          {/* Metadata inputs only affect immediate uploads (editing mode) */}
          {!isCreationMode && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="upload-category" className="text-sm font-medium text-slate-900">Category</Label>
                  <Select value={uploadCategory} onValueChange={setUploadCategory}>
                    <SelectTrigger className="bg-white border-slate-300 text-slate-900">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {GALLERY_CATEGORIES.map(category => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upload-alt-text" className="text-sm font-medium text-slate-900">Alt Text (Optional)</Label>
                  <Input
                    id="upload-alt-text"
                    value={uploadAltText}
                    onChange={(e) => setUploadAltText(e.target.value)}
                    placeholder="Describe the image"
                    className="bg-white border-slate-300 text-slate-900"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">Tip: Category and alt text apply to images uploaded immediately. For queued images added during creation, you can edit metadata after saving the character.</p>
            </>
          )}
        </div>

        {/* Uploading Previews */}
        {uploadingFiles.length > 0 && !isCreationMode && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium text-slate-700">Uploading...</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {uploadingFiles.map((f, idx) => (
                <div key={`${f.name}-${idx}`} className="relative">
                  <div className="aspect-square rounded-lg overflow-hidden border-2 border-slate-200">
                    <img src={f.preview} alt={f.name} className="w-full h-full object-cover opacity-90" />
                  </div>
                  <div className="absolute inset-0 flex items-end p-2">
                    <Progress value={f.progress} className="w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending images preview (creation mode) */}
        {isCreationMode && pendingImages && pendingImages.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium text-slate-700">Pending Images ({pendingImages.length})</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {pendingImages.map((file, idx) => {
                const url = URL.createObjectURL(file);
                return (
                  <div key={`${file.name}-${idx}`} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden border-2 border-slate-200">
                      <img src={url} alt={file.name} className="w-full h-full object-cover" onLoad={() => URL.revokeObjectURL(url)} />
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition" />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onPendingImagesChange && onPendingImagesChange(pendingImages.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">These images will be uploaded when you save the character.</p>
          </div>
        )}

        {/* Gallery Grid - Only show in editing mode */}
        {!isCreationMode && (isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
            <p className="text-sm text-slate-500 mt-2">Loading gallery...</p>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load gallery data. Please try refreshing the page.
            </AlertDescription>
          </Alert>
        ) : galleryData && galleryData.images.length > 0 ? (
          <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Gallery Images ({filteredImages.length})</h4>
              <div className="flex items-center space-x-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-32 bg-white border-slate-300 text-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {GALLERY_CATEGORIES.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedImages.length > 0 && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={handleBulkDelete}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete ({selectedImages.length})
                  </Button>
                )}
              </div>
            </div>

            {/* Bulk Selection */}
            {filteredImages.length > 0 && (
              <div className="flex items-center space-x-2 p-2 bg-slate-50 rounded">
                <Checkbox
                  checked={filteredImages.length > 0 && selectedImages.length === filteredImages.length}
                  onCheckedChange={selectAllImages}
                />
                <span className="text-sm text-slate-600">
                  {selectedImages.length} of {filteredImages.length} selected
                </span>
              </div>
            )}

            {/* Image Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredImages.map((image, index) => (
                <div key={image.id} className="relative group">
                  {/* Selection checkbox */}
                  <div className="absolute top-2 left-2 z-10">
                    <Checkbox
                      checked={selectedImages.includes(image.id)}
                      onCheckedChange={() => toggleImageSelection(image.id)}
                      className="bg-white shadow-sm"
                    />
                  </div>

                  <div className="aspect-square rounded-lg overflow-hidden border-2 border-slate-200 hover:border-slate-400 transition-all">
                    <img 
                      src={image.thumbnail_url || image.url} 
                      alt={image.alt_text || `Gallery image ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    
                    {image.is_primary && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-yellow-500 text-white">
                          <Star className="h-3 w-3 mr-1" />
                          Primary
                        </Badge>
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all">
                      <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-xs">
                            {image.category}
                          </Badge>
                          <div className="flex space-x-1">
                            {!image.is_primary && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-6 w-6 p-0"
                                onClick={() => setPrimaryMutation.mutate(image.id)}
                                disabled={setPrimaryMutation.isPending}
                                title="Set as primary"
                              >
                                <Star className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-6 w-6 p-0"
                              onClick={() => deleteMutation.mutate(image.id)}
                              disabled={deleteMutation.isPending}
                              title="Delete image"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Reorder controls */}
                  <div className="mt-2 flex items-center justify-center space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => moveImage(image.id, 'up')}
                      disabled={index === 0 || reorderMutation.isPending}
                      title="Move up"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <span className="text-xs text-slate-500 px-2">#{image.display_order}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => moveImage(image.id, 'down')}
                      disabled={index === filteredImages.length - 1 || reorderMutation.isPending}
                      title="Move down"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Image info */}
                  <div className="mt-2 text-center">
                    <p className="text-xs text-slate-600 truncate" title={image.alt_text}>
                      {image.alt_text || `Image ${index + 1}`}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatFileSize(image.file_size)}
                      {image.dimensions && ` • ${image.dimensions}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <ImagePlus className="mx-auto h-12 w-12 text-slate-400 mb-2" />
            <p className="text-sm text-slate-600 mb-1">No gallery images yet</p>
            <p className="text-xs text-slate-500">Upload images using the interface above</p>
          </div>
        ))}
        
        {/* Creation mode empty state */}
        {isCreationMode && pendingImages.length === 0 && (
          <div className="text-center py-8">
            <ImagePlus className="mx-auto h-12 w-12 text-slate-400 mb-2" />
            <p className="text-sm text-slate-600 mb-1">No gallery images added yet</p>
            <p className="text-xs text-slate-500">Add images using the interface above - they'll be uploaded when you save the character</p>
          </div>
        )}
    </div>
  );
}

export default GalleryManagement;
