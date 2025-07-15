import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Upload, 
  Eye, 
  Save, 
  X, 
  Star, 
  Tag, 
  User, 
  MessageCircle, 
  Settings,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import { Character } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CharacterFormData {
  name: string;
  description: string;
  backstory: string;
  voiceStyle: string;
  traits: string[];
  personalityTraits: {
    friendliness: number;
    intelligence: number;
    humor: number;
    confidence: number;
    empathy: number;
    creativity: number;
  };
  avatar: string | null;
  category: string;
  isPublic: boolean;
  nsfwLevel: number;
  gender: string;
  age: string;
  occupation: string;
  hobbies: string[];
  catchphrase: string;
  conversationStyle: string;
}

const predefinedTraits = [
  'Friendly', 'Mysterious', 'Intelligent', 'Funny', 'Serious', 'Caring', 'Adventurous',
  'Shy', 'Confident', 'Creative', 'Logical', 'Emotional', 'Brave', 'Cautious',
  'Optimistic', 'Pessimistic', 'Loyal', 'Independent', 'Playful', 'Wise',
  'Curious', 'Passionate', 'Calm', 'Energetic', 'Romantic', 'Practical'
];

const categories = [
  'Fantasy', 'Sci-Fi', 'Modern', 'Historical', 'Anime', 'Game', 'Movie', 'Book', 'Original'
];

const voiceStyles = [
  'Casual', 'Formal', 'Playful', 'Mysterious', 'Wise', 'Energetic', 'Calm', 'Dramatic',
  'Humorous', 'Serious', 'Friendly', 'Professional', 'Romantic', 'Sarcastic'
];

const conversationStyles = [
  'Detailed responses', 'Concise responses', 'Storytelling', 'Interactive',
  'Question-focused', 'Emotional', 'Analytical', 'Creative'
];

const CreateCharacterPage = () => {
  const [_, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  const [formData, setFormData] = useState<CharacterFormData>({
    name: '',
    description: '',
    backstory: '',
    voiceStyle: 'Casual',
    traits: [],
    personalityTraits: {
      friendliness: 50,
      intelligence: 50,
      humor: 50,
      confidence: 50,
      empathy: 50,
      creativity: 50,
    },
    avatar: null,
    category: 'Original',
    isPublic: true,
    nsfwLevel: 0,
    gender: '',
    age: '',
    occupation: '',
    hobbies: [],
    catchphrase: '',
    conversationStyle: 'Detailed responses'
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CharacterFormData, string>>>({});
  const [isUploading, setIsUploading] = useState(false);

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CharacterFormData, string>> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Character name is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Character description is required';
    }
    
    if (!formData.backstory.trim()) {
      newErrors.backstory = 'Character backstory is required';
    }
    
    if (formData.traits.length === 0) {
      newErrors.traits = 'At least one trait is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form field changes
  const handleInputChange = (field: keyof CharacterFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  // Handle personality trait changes
  const handlePersonalityChange = (trait: keyof CharacterFormData['personalityTraits'], value: number) => {
    setFormData(prev => ({
      ...prev,
      personalityTraits: {
        ...prev.personalityTraits,
        [trait]: value
      }
    }));
  };

  // Handle trait selection
  const handleTraitToggle = (trait: string) => {
    setFormData(prev => ({
      ...prev,
      traits: prev.traits.includes(trait)
        ? prev.traits.filter(t => t !== trait)
        : [...prev.traits, trait]
    }));
  };

  // Handle hobby changes
  const handleHobbyChange = (hobby: string) => {
    setFormData(prev => ({
      ...prev,
      hobbies: prev.hobbies.includes(hobby)
        ? prev.hobbies.filter(h => h !== hobby)
        : [...prev.hobbies, hobby]
    }));
  };

  // Handle avatar upload
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image smaller than 5MB',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);

    try {
      // Convert to base64 for preview (in real app, upload to server)
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setFormData(prev => ({
          ...prev,
          avatar: result
        }));
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsUploading(false);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload avatar. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Save character mutation
  const saveCharacterMutation = useMutation({
    mutationFn: async (characterData: CharacterFormData) => {
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }

      // Convert form data to API format
      const apiData = {
        name: characterData.name,
        description: characterData.description,
        avatarUrl: characterData.avatar,
        backstory: characterData.backstory,
        voiceStyle: characterData.voiceStyle,
        traits: characterData.traits,
        personalityTraits: characterData.personalityTraits,
        category: characterData.category,
        gender: characterData.gender,
        age: characterData.age,
        occupation: characterData.occupation,
        hobbies: characterData.hobbies,
        catchphrase: characterData.catchphrase,
        conversationStyle: characterData.conversationStyle,
        isPublic: characterData.isPublic,
        nsfwLevel: characterData.nsfwLevel
      };

      try {
        const response = await apiRequest('POST', '/api/characters', apiData);
        return response.json();
      } catch (error) {
        // If API is not available, create a mock character for demo
        if (error instanceof TypeError && error.message.includes('fetch')) {
          console.log('API not available, creating mock character');
          return {
            id: Date.now(),
            name: characterData.name,
            description: characterData.description,
            avatarUrl: characterData.avatar || 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop',
            backstory: characterData.backstory,
            voiceStyle: characterData.voiceStyle,
            traits: characterData.traits,
            personalityTraits: characterData.personalityTraits,
            createdAt: new Date().toISOString()
          };
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: 'Character created successfully!',
        description: `${formData.name} has been created and ${formData.isPublic ? 'published' : 'saved as draft'}.`
      });
      
      // Invalidate queries to refresh character lists
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      
      // Navigate to character page or back to characters list
      navigate('/characters');
    },
    onError: (error: Error) => {
      console.error('Character creation error:', error);
      
      // Handle authentication errors
      if (error.message.includes('403') || error.message.includes('Not authenticated')) {
        toast({
          title: 'Authentication required',
          description: 'Please log in to create characters',
          variant: 'destructive'
        });
        navigate('/login');
      } else {
        toast({
          title: 'Failed to create character',
          description: error.message,
          variant: 'destructive'
        });
      }
    }
  });

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to create a character',
        variant: 'destructive'
      });
      return;
    }

    if (!validateForm()) {
      toast({
        title: 'Please fix the errors',
        description: 'Some required fields are missing or invalid',
        variant: 'destructive'
      });
      return;
    }

    saveCharacterMutation.mutate(formData);
  };

  // Save as draft
  const handleSaveDraft = () => {
    if (!validateForm()) {
      toast({
        title: 'Please fix the errors',
        description: 'Some required fields are missing or invalid',
        variant: 'destructive'
      });
      return;
    }

    const draftData = { ...formData, isPublic: false };
    saveCharacterMutation.mutate(draftData);
  };

  // Character preview component
  const CharacterPreview = () => {
    const previewCharacter: Character = {
      id: 0,
      name: formData.name || 'New Character',
      description: formData.description,
      backstory: formData.backstory,
      voiceStyle: formData.voiceStyle,
      traits: formData.traits,
      personalityTraits: formData.personalityTraits,
      avatarUrl: formData.avatar || 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop',
      createdAt: new Date().toISOString()
    };

    return (
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="relative">
          <img
            src={previewCharacter.avatarUrl}
            alt={previewCharacter.name}
            className="w-full h-64 object-cover"
          />
          <div className="absolute bottom-2 left-2 right-2">
            <div className="flex flex-wrap gap-1">
              {previewCharacter.traits.slice(0, 3).map((trait) => (
                <span key={trait} className="bg-blue-600 text-white px-2 py-1 rounded text-xs backdrop-blur-sm">
                  {trait}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-white mb-2">{previewCharacter.name}</h3>
          <p className="text-sm text-gray-400 mb-2 line-clamp-2">{previewCharacter.description}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">⭐ New</span>
            <span className="text-xs text-gray-400">👤 {formData.gender || 'Unknown'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <GlobalLayout>
      <div className="w-full h-full overflow-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Plus className="w-6 h-6 text-green-400" />
              <h1 className="text-2xl font-bold text-white">Create Character</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
              >
                <Eye className="w-4 h-4" />
                <span>{showPreview ? 'Hide' : 'Show'} Preview</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/characters')}
              >
                Cancel
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="personality">Personality</TabsTrigger>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                  </TabsList>

                  {/* Basic Information Tab */}
                  <TabsContent value="basic" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <User className="w-5 h-5" />
                          <span>Basic Information</span>
                        </CardTitle>
                        <CardDescription>
                          Essential details about your character
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Avatar Upload */}
                        <div>
                          <Label htmlFor="avatar">Character Avatar</Label>
                          <div className="mt-2 flex items-center space-x-4">
                            <div className="relative">
                              <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                                {formData.avatar ? (
                                  <img
                                    src={formData.avatar}
                                    alt="Avatar preview"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="w-8 h-8 text-gray-400" />
                                )}
                              </div>
                              {formData.avatar && (
                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => ({ ...prev, avatar: null }))}
                                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <div>
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarUpload}
                                className="hidden"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="flex items-center space-x-2"
                              >
                                <Upload className="w-4 h-4" />
                                <span>{isUploading ? 'Uploading...' : 'Upload Avatar'}</span>
                              </Button>
                              <p className="text-sm text-gray-400 mt-1">
                                PNG, JPG up to 5MB
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Character Name */}
                        <div>
                          <Label htmlFor="name">Character Name *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            placeholder="Enter character name"
                            className={errors.name ? 'border-red-500' : ''}
                          />
                          {errors.name && (
                            <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                          )}
                        </div>

                        {/* Description */}
                        <div>
                          <Label htmlFor="description">Short Description *</Label>
                          <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            placeholder="Brief description of your character (1-2 sentences)"
                            rows={3}
                            className={errors.description ? 'border-red-500' : ''}
                          />
                          {errors.description && (
                            <p className="text-sm text-red-500 mt-1">{errors.description}</p>
                          )}
                        </div>

                        {/* Backstory */}
                        <div>
                          <Label htmlFor="backstory">Backstory *</Label>
                          <Textarea
                            id="backstory"
                            value={formData.backstory}
                            onChange={(e) => handleInputChange('backstory', e.target.value)}
                            placeholder="Detailed backstory and background information"
                            rows={4}
                            className={errors.backstory ? 'border-red-500' : ''}
                          />
                          {errors.backstory && (
                            <p className="text-sm text-red-500 mt-1">{errors.backstory}</p>
                          )}
                        </div>

                        {/* Category */}
                        <div>
                          <Label htmlFor="category">Category</Label>
                          <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map(category => (
                                <SelectItem key={category} value={category}>{category}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Voice Style */}
                        <div>
                          <Label htmlFor="voiceStyle">Voice Style</Label>
                          <Select value={formData.voiceStyle} onValueChange={(value) => handleInputChange('voiceStyle', value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {voiceStyles.map(style => (
                                <SelectItem key={style} value={style}>{style}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Personality Tab */}
                  <TabsContent value="personality" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Star className="w-5 h-5" />
                          <span>Personality Traits</span>
                        </CardTitle>
                        <CardDescription>
                          Select traits that define your character's personality
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Trait Selection */}
                        <div>
                          <Label>Character Traits *</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {predefinedTraits.map(trait => (
                              <button
                                key={trait}
                                type="button"
                                onClick={() => handleTraitToggle(trait)}
                                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                  formData.traits.includes(trait)
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                              >
                                {trait}
                              </button>
                            ))}
                          </div>
                          {errors.traits && (
                            <p className="text-sm text-red-500 mt-1">{errors.traits}</p>
                          )}
                        </div>

                        {/* Personality Sliders */}
                        <div className="space-y-4">
                          <h4 className="font-medium">Personality Dimensions</h4>
                          {Object.entries(formData.personalityTraits).map(([trait, value]) => (
                            <div key={trait}>
                              <div className="flex justify-between items-center mb-2">
                                <Label className="capitalize">{trait}</Label>
                                <span className="text-sm text-gray-400">{value}%</span>
                              </div>
                              <Slider
                                value={[value]}
                                onValueChange={(values) => handlePersonalityChange(trait as keyof CharacterFormData['personalityTraits'], values[0])}
                                max={100}
                                step={1}
                                className="w-full"
                              />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Details Tab */}
                  <TabsContent value="details" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Tag className="w-5 h-5" />
                          <span>Character Details</span>
                        </CardTitle>
                        <CardDescription>
                          Additional information about your character
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Gender */}
                          <div>
                            <Label htmlFor="gender">Gender</Label>
                            <Input
                              id="gender"
                              value={formData.gender}
                              onChange={(e) => handleInputChange('gender', e.target.value)}
                              placeholder="e.g., Male, Female, Non-binary"
                            />
                          </div>

                          {/* Age */}
                          <div>
                            <Label htmlFor="age">Age</Label>
                            <Input
                              id="age"
                              value={formData.age}
                              onChange={(e) => handleInputChange('age', e.target.value)}
                              placeholder="e.g., 25, Young Adult, Ancient"
                            />
                          </div>
                        </div>

                        {/* Occupation */}
                        <div>
                          <Label htmlFor="occupation">Occupation</Label>
                          <Input
                            id="occupation"
                            value={formData.occupation}
                            onChange={(e) => handleInputChange('occupation', e.target.value)}
                            placeholder="Character's job or role"
                          />
                        </div>

                        {/* Catchphrase */}
                        <div>
                          <Label htmlFor="catchphrase">Catchphrase</Label>
                          <Input
                            id="catchphrase"
                            value={formData.catchphrase}
                            onChange={(e) => handleInputChange('catchphrase', e.target.value)}
                            placeholder="A memorable phrase your character often says"
                          />
                        </div>

                        {/* Conversation Style */}
                        <div>
                          <Label htmlFor="conversationStyle">Conversation Style</Label>
                          <Select value={formData.conversationStyle} onValueChange={(value) => handleInputChange('conversationStyle', value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {conversationStyles.map(style => (
                                <SelectItem key={style} value={style}>{style}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Settings Tab */}
                  <TabsContent value="settings" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Settings className="w-5 h-5" />
                          <span>Publishing Settings</span>
                        </CardTitle>
                        <CardDescription>
                          Configure how your character will be shared
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Public/Private */}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="isPublic">Make Public</Label>
                            <p className="text-sm text-gray-400">
                              Allow others to discover and chat with your character
                            </p>
                          </div>
                          <Switch
                            id="isPublic"
                            checked={formData.isPublic}
                            onCheckedChange={(checked) => handleInputChange('isPublic', checked)}
                          />
                        </div>

                        {/* NSFW Level */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <Label>Content Rating</Label>
                            <span className="text-sm text-gray-400">
                              Level {formData.nsfwLevel}
                            </span>
                          </div>
                          <Slider
                            value={[formData.nsfwLevel]}
                            onValueChange={(values) => handleInputChange('nsfwLevel', values[0])}
                            max={3}
                            step={1}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>Safe</span>
                            <span>Mild</span>
                            <span>Moderate</span>
                            <span>Mature</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-700">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={saveCharacterMutation.isPending}
                    className="flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Draft</span>
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveCharacterMutation.isPending}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {saveCharacterMutation.isPending ? 'Creating...' : 'Create Character'}
                    </span>
                  </Button>
                </div>
              </form>
            </div>

            {/* Preview */}
            {showPreview && (
              <div className="lg:col-span-1">
                <div className="sticky top-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Eye className="w-5 h-5" />
                        <span>Preview</span>
                      </CardTitle>
                      <CardDescription>
                        How your character will appear to others
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <CharacterPreview />
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default CreateCharacterPage;