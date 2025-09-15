import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Image, Upload, Check, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

interface ImageAsset {
  filename: string;
  name: string;
  url: string;
  size: number;
}

interface ImageSelectorProps {
  authHeaders: Record<string, string>;
  value: string;
  onChange: (url: string) => void;
  assetType?: 'characters';
  label?: string;
  required?: boolean;
}

export function ImageSelector({ 
  authHeaders,
  value, 
  onChange, 
  assetType = 'characters', 
  label = 'Image',
  required = false 
}: ImageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<string>(value);
  const [manualUrl, setManualUrl] = useState(value);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const { data: imagesData, isLoading, error } = useQuery({
    queryKey: ['admin-images', assetType],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/admin/assets/images?asset_type=${assetType}`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }

      return response.json();
    },
    enabled: isOpen,
  });

  const images: ImageAsset[] = imagesData?.images || [];

  const filteredImages = images.filter(image => 
    image.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    image.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleImageSelect = (imageUrl: string) => {
    setSelectedImage(imageUrl);
  };

  const handleConfirm = () => {
    onChange(selectedImage);
    setIsOpen(false);
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    
    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size must be less than 10MB');
      setIsUploading(false);
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file');
      setIsUploading(false);
      return;
    }
    
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE_URL}/api/admin/assets/images/upload`, {
        method: 'POST',
        headers: authHeaders,
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Upload failed');
      }
      const data = await res.json();
      // data.url is under /assets/characters_img/...
      const absolute = data.url?.startsWith('http') ? data.url : `${API_BASE_URL}${data.url}`;
      setSelectedImage(absolute);
      setManualUrl(absolute);
      
      toast({ 
        title: '✅ Upload successful', 
        description: `Image uploaded: ${file.name}`,
        className: "bg-green-600 text-white border-green-500"
      });
      
      // Refresh list
      // @ts-ignore - useQuery is wired to key ['admin-images', assetType]
      // We rely on dialog re-open or manual refetch by closing/opening. Keep it simple.
    } catch (e: any) {
      setUploadError(e?.message || 'Upload failed');
      toast({ title: 'Upload failed', description: e?.message || 'Try a different image', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleFileUpload(imageFile);
    } else {
      setUploadError('Please drop a valid image file');
    }
  };

  const handleManualUrlChange = (url: string) => {
    setManualUrl(url);
    setSelectedImage(url);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Update selectedImage when value changes
  useEffect(() => {
    setSelectedImage(value);
    setManualUrl(value);
  }, [value]);

  return (
    <div className="space-y-2">
      <Label htmlFor="image-selector" className="text-sm font-medium text-slate-900">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      <div className="flex space-x-2">
        <Input
          id="image-selector"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${assetType} image URL or select from assets`}
          className="bg-white border-slate-300 text-slate-900 flex-1"
          required={required}
        />
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              className="border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
            >
              <Image className="w-4 h-4 mr-2" />
              Browse
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-white text-slate-900 flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-xl text-slate-900">
                Select {assetType} Image
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 flex-1 overflow-y-auto pr-2">
              {/* Manual URL Input */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-900">Manual URL</Label>
                <Input
                  value={manualUrl}
                  onChange={(e) => handleManualUrlChange(e.target.value)}
                  placeholder="Enter image URL manually"
                  className="bg-white border-slate-300 text-slate-900"
                />
              </div>
              
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search images..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white border-slate-300 text-slate-900"
                />
              </div>
              
              {/* Loading/Error States */}
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-slate-600">Loading images...</div>
                </div>
              )}
              
              {error && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-red-600">Error loading images: {error.message}</div>
                </div>
              )}
              
              {/* Image Grid */}
              {!isLoading && !error && (
                <div>
                  <ScrollArea>
                    {filteredImages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                        <Image className="w-12 h-12 mb-2 text-slate-400" />
                        <p className="text-sm">No images found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Place images in /attached_assets/{assetType}_img/ directory
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-2 pb-6">
                        {filteredImages.map((image) => (
                        <Card
                          key={image.filename}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            selectedImage === image.url 
                              ? 'ring-2 ring-blue-500 shadow-md' 
                              : 'hover:shadow-sm'
                          }`}
                          onClick={() => handleImageSelect(image.url)}
                        >
                          <CardContent className="p-3">
                            <div className="aspect-square bg-slate-100 rounded-lg mb-2 overflow-hidden relative">
                              <img
                                src={image.url.startsWith('http') ? image.url : `${API_BASE_URL}${image.url}`}
                                alt={image.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  target.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                              <div className="hidden absolute inset-0 flex items-center justify-center bg-slate-200">
                                <Image className="w-8 h-8 text-slate-400" />
                              </div>
                              {selectedImage === image.url && (
                                <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-1">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-slate-900 font-medium truncate">
                              {image.name}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {formatFileSize(image.size)}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  </ScrollArea>
                </div>
              )}
              
              {/* Upload new image (Admin) */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border-2 border-dashed border-blue-300">
                <div className="flex items-center text-sm font-medium text-blue-700 mb-3">
                  <Upload className="w-5 h-5 mr-2" />
                  <span>Upload New Character Image</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-center w-full">
                    <label 
                      className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ${
                        isDragOver 
                          ? 'border-purple-400 bg-purple-100 scale-105' 
                          : isUploading 
                            ? 'border-blue-400 bg-blue-100' 
                            : 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {isUploading ? (
                          <>
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                            <p className="text-sm text-blue-600 font-medium">Uploading...</p>
                          </>
                        ) : isDragOver ? (
                          <>
                            <Upload className="w-8 h-8 mb-2 text-purple-600 animate-bounce" />
                            <p className="text-sm text-purple-600 font-medium">Drop your image here!</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 mb-2 text-blue-500" />
                            <p className="mb-2 text-sm text-blue-600 font-medium">
                              <span className="font-semibold">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-blue-500">PNG, JPG, JPEG, GIF, WEBP (MAX. 10MB)</p>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {isUploading && (
                    <div className="flex items-center justify-center text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      <span className="text-sm">Uploading...</span>
                    </div>
                  )}
                  {uploadError && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                      ❌ {uploadError}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Preview */}
              {selectedImage && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-900">Preview</Label>
                  <div className="w-20 h-20 bg-slate-100 rounded-lg overflow-hidden">
                    <img
                      src={selectedImage?.startsWith('http') ? selectedImage : `${API_BASE_URL}${selectedImage}`}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden w-full h-full flex items-center justify-center bg-slate-200">
                      <Image className="w-6 h-6 text-slate-400" />
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {selectedImage}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-2 mt-4 pt-4 border-t border-slate-200 bg-white sticky bottom-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={!selectedImage}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              >
                Select Image
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Current Image Preview */}
      {value && (
        <div className="mt-2">
          <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden">
            <img
              src={value?.startsWith('http') ? value : `${API_BASE_URL}${value}`}
              alt="Current image"
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden w-full h-full flex items-center justify-center bg-slate-200">
              <Image className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
