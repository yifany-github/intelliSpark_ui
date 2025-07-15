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

interface ImageAsset {
  filename: string;
  name: string;
  url: string;
  size: number;
}

interface ImageSelectorProps {
  value: string;
  onChange: (url: string) => void;
  assetType?: 'characters' | 'scenes';
  label?: string;
  required?: boolean;
}

export function ImageSelector({ 
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

  const { data: imagesData, isLoading, error } = useQuery({
    queryKey: ['admin-images', assetType],
    queryFn: async () => {
      const token = localStorage.getItem('adminToken');
      if (!token) throw new Error('No admin token');

      const response = await fetch(`/api/admin/assets/images?asset_type=${assetType}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
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
          
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-xl text-slate-900">
                Select {assetType} Image
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 flex-1 overflow-hidden">
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
                <div className="flex-1 min-h-0">
                  <ScrollArea className="h-full">
                    {filteredImages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                        <Image className="w-12 h-12 mb-2 text-slate-400" />
                        <p className="text-sm">No images found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Place images in /attached_assets/{assetType}_img/ directory
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-2">
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
                                src={image.url}
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
              
              {/* Upload Info */}
              <div className="bg-slate-50 p-3 rounded-lg">
                <div className="flex items-center text-sm text-slate-600">
                  <Upload className="w-4 h-4 mr-2" />
                  <span>
                    To add new images, place them in the <code className="bg-slate-200 px-1 rounded">
                      /attached_assets/{assetType}_img/
                    </code> directory
                  </span>
                </div>
              </div>
              
              {/* Preview */}
              {selectedImage && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-900">Preview</Label>
                  <div className="w-20 h-20 bg-slate-100 rounded-lg overflow-hidden">
                    <img
                      src={selectedImage}
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
            
            <div className="flex justify-end space-x-2 mt-4 pt-4 border-t border-slate-200 bg-white">
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
              src={value}
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