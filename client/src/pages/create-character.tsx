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
import { useLanguage } from '@/context/LanguageContext';

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

const getPredefinedTraits = (t: (key: string) => string) => [
  { key: 'friendly', label: t('friendly') },
  { key: 'mysterious', label: t('mysterious') },
  { key: 'intelligent', label: t('intelligent') },
  { key: 'funny', label: t('funny') },
  { key: 'serious', label: t('serious') },
  { key: 'caring', label: t('caring') },
  { key: 'adventurous', label: t('adventurous') },
  { key: 'shy', label: t('shy') },
  { key: 'confident', label: t('confident') },
  { key: 'creative', label: t('creative') },
  { key: 'logical', label: t('logical') },
  { key: 'emotional', label: t('emotional') },
  { key: 'brave', label: t('brave') },
  { key: 'cautious', label: t('cautious') },
  { key: 'optimistic', label: t('optimistic') },
  { key: 'pessimistic', label: t('pessimistic') },
  { key: 'loyal', label: t('loyal') },
  { key: 'independent', label: t('independent') },
  { key: 'playful', label: t('playful') },
  { key: 'wise', label: t('wise') },
  { key: 'curious', label: t('curious') },
  { key: 'passionate', label: t('passionate') },
  { key: 'calm', label: t('calm') },
  { key: 'energetic', label: t('energetic') },
  { key: 'romantic', label: t('romantic') },
  { key: 'practical', label: t('practical') }
];

const getCategories = (t: (key: string) => string) => [
  { key: 'Fantasy', label: t('fantasy') },
  { key: 'Sci-Fi', label: t('sciFi') },
  { key: 'Modern', label: t('modern') },
  { key: 'Historical', label: t('historical') },
  { key: 'Anime', label: t('anime') },
  { key: 'Game', label: t('game') },
  { key: 'Movie', label: t('movie') },
  { key: 'Book', label: t('book') },
  { key: 'Original', label: t('original') }
];

const getVoiceStyles = (t: (key: string) => string) => [
  { key: 'Casual', label: t('casual') },
  { key: 'Formal', label: t('formal') },
  { key: 'Playful', label: t('playful') },
  { key: 'Mysterious', label: t('mystical') },
  { key: 'Wise', label: t('wise') },
  { key: 'Energetic', label: t('energetic') },
  { key: 'Calm', label: t('calm') },
  { key: 'Dramatic', label: t('dramatic') },
  { key: 'Humorous', label: t('humorous') },
  { key: 'Serious', label: t('serious') },
  { key: 'Friendly', label: t('friendly') },
  { key: 'Professional', label: t('professional') },
  { key: 'Romantic', label: t('romantic') },
  { key: 'Sarcastic', label: t('sarcastic') }
];

const getConversationStyles = (t: (key: string) => string) => [
  { key: 'Detailed responses', label: t('detailedResponses') },
  { key: 'Concise responses', label: t('conciseResponses') },
  { key: 'Storytelling', label: t('storytelling') },
  { key: 'Interactive', label: t('interactive') },
  { key: 'Question-focused', label: t('questionFocused') },
  { key: 'Emotional', label: t('emotional') },
  { key: 'Analytical', label: t('analytical') },
  { key: 'Creative', label: t('creative') }
];

const CreateCharacterPage = () => {
  const [_, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // Get localized options
  const predefinedTraits = getPredefinedTraits(t);
  const voiceStyles = getVoiceStyles(t);
  const conversationStyles = getConversationStyles(t);
  const categories = getCategories(t);

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
      newErrors.name = t('characterNameRequired');
    }
    
    if (!formData.description.trim()) {
      newErrors.description = t('characterDescriptionRequired');
    }
    
    if (!formData.backstory.trim()) {
      newErrors.backstory = t('characterBackstoryRequired');
    }
    
    if (formData.traits.length === 0) {
      newErrors.traits = t('atLeastOneTrait');
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
  const handleTraitToggle = (traitKey: string, traitLabel: string) => {
    setFormData(prev => ({
      ...prev,
      traits: prev.traits.includes(traitLabel)
        ? prev.traits.filter(t => t !== traitLabel)
        : [...prev.traits, traitLabel]
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
        title: t('invalidFileType'),
        description: t('selectImageFile'),
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t('fileTooLarge'),
        description: t('selectSmallerImage'),
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
        title: t('uploadFailed'),
        description: t('failedToUploadAvatar'),
        variant: 'destructive'
      });
    }
  };

  // Save character mutation
  const saveCharacterMutation = useMutation({
    mutationFn: async (characterData: CharacterFormData) => {
      if (!isAuthenticated) {
        throw new Error(t('authenticationRequired'));
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
        title: t('characterCreatedSuccessfully'),
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
          title: t('authenticationRequired'),
          description: t('pleaseLoginToCreate'),
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
        title: t('authenticationRequired'),
        description: t('pleaseLoginToCreate'),
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
              <h1 className="text-2xl font-bold text-white">{t('createCharacter')}</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
              >
                <Eye className="w-4 h-4" />
                <span>{showPreview ? t('hide') : t('show')} {t('preview')}</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/characters')}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="basic">{t('basicInfo')}</TabsTrigger>
                    <TabsTrigger value="personality">{t('personality')}</TabsTrigger>
                    <TabsTrigger value="details">{t('details')}</TabsTrigger>
                    <TabsTrigger value="settings">{t('settings')}</TabsTrigger>
                  </TabsList>

                  {/* Basic Information Tab */}
                  <TabsContent value="basic" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <User className="w-5 h-5" />
                          <span>{t('basicInfo')}</span>
                        </CardTitle>
                        <CardDescription>
                          {t('essentialDetails')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Avatar Upload */}
                        <div>
                          <Label htmlFor="avatar">{t('characterAvatar')}</Label>
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
                                <span>{isUploading ? t('uploading') : t('uploadAvatar')}</span>
                              </Button>
                              <p className="text-sm text-gray-400 mt-1">
                                {t('pngJpgUpTo5MB')}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Character Name */}
                        <div>
                          <Label htmlFor="name">{t('characterName')} *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            placeholder={t('enterCharacterName')}
                            className={errors.name ? 'border-red-500' : ''}
                          />
                          {errors.name && (
                            <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                          )}
                        </div>

                        {/* Description */}
                        <div>
                          <Label htmlFor="description">{t('shortDescription')} *</Label>
                          <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            placeholder={t('briefDescription')}
                            rows={3}
                            className={errors.description ? 'border-red-500' : ''}
                          />
                          {errors.description && (
                            <p className="text-sm text-red-500 mt-1">{errors.description}</p>
                          )}
                        </div>

                        {/* Backstory */}
                        <div>
                          <Label htmlFor="backstory">{t('detailedBackstory')} *</Label>
                          <Textarea
                            id="backstory"
                            value={formData.backstory}
                            onChange={(e) => handleInputChange('backstory', e.target.value)}
                            placeholder={t('detailedBackstory')}
                            rows={4}
                            className={errors.backstory ? 'border-red-500' : ''}
                          />
                          {errors.backstory && (
                            <p className="text-sm text-red-500 mt-1">{errors.backstory}</p>
                          )}
                        </div>

                        {/* Category */}
                        <div>
                          <Label htmlFor="category">{t('category')}</Label>
                          <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map(category => (
                                <SelectItem key={category.key} value={category.key}>{category.label}</SelectItem>
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
                                <SelectItem key={style.key} value={style.key}>{style.label}</SelectItem>
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
                          <span>{t('personalityTraits')}</span>
                        </CardTitle>
                        <CardDescription>
                          {t('selectTraits')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Trait Selection */}
                        <div>
                          <Label>{t('characterTraits')} *</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {predefinedTraits.map(trait => (
                              <button
                                key={trait.key}
                                type="button"
                                onClick={() => handleTraitToggle(trait.key, trait.label)}
                                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                  formData.traits.includes(trait.label)
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                              >
                                {trait.label}
                              </button>
                            ))}
                          </div>
                          {errors.traits && (
                            <p className="text-sm text-red-500 mt-1">{errors.traits}</p>
                          )}
                        </div>

                        {/* Personality Sliders */}
                        <div className="space-y-4">
                          <h4 className="font-medium">{t('personalityDimensions')}</h4>
                          {Object.entries(formData.personalityTraits).map(([trait, value]) => (
                            <div key={trait}>
                              <div className="flex justify-between items-center mb-2">
                                <Label className="capitalize">{t(trait as keyof typeof formData.personalityTraits)}</Label>
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
                          <span>{t('characterDetails')}</span>
                        </CardTitle>
                        <CardDescription>
                          {t('additionalInformation')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Gender */}
                          <div>
                            <Label htmlFor="gender">{t('gender')}</Label>
                            <Input
                              id="gender"
                              value={formData.gender}
                              onChange={(e) => handleInputChange('gender', e.target.value)}
                              placeholder={t('genderExample')}
                            />
                          </div>

                          {/* Age */}
                          <div>
                            <Label htmlFor="age">{t('age')}</Label>
                            <Input
                              id="age"
                              value={formData.age}
                              onChange={(e) => handleInputChange('age', e.target.value)}
                              placeholder={t('ageExample')}
                            />
                          </div>
                        </div>

                        {/* Occupation */}
                        <div>
                          <Label htmlFor="occupation">{t('occupation')}</Label>
                          <Input
                            id="occupation"
                            value={formData.occupation}
                            onChange={(e) => handleInputChange('occupation', e.target.value)}
                            placeholder={t('charactersJob')}
                          />
                        </div>

                        {/* Catchphrase */}
                        <div>
                          <Label htmlFor="catchphrase">{t('catchphrase')}</Label>
                          <Input
                            id="catchphrase"
                            value={formData.catchphrase}
                            onChange={(e) => handleInputChange('catchphrase', e.target.value)}
                            placeholder={t('memorablePhrase')}
                          />
                        </div>

                        {/* Conversation Style */}
                        <div>
                          <Label htmlFor="conversationStyle">{t('conversationStyle')}</Label>
                          <Select value={formData.conversationStyle} onValueChange={(value) => handleInputChange('conversationStyle', value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {conversationStyles.map(style => (
                                <SelectItem key={style.key} value={style.key}>{style.label}</SelectItem>
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
                          <span>{t('publishingSettings')}</span>
                        </CardTitle>
                        <CardDescription>
                          {t('configureSharing')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Public/Private */}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="isPublic">{t('makePublic')}</Label>
                            <p className="text-sm text-gray-400">
                              {t('allowOthersDiscover')}
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
                            <Label>{t('contentRating')}</Label>
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
                            <span>{t('safe')}</span>
                            <span>{t('mild')}</span>
                            <span>{t('moderate')}</span>
                            <span>{t('mature')}</span>
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
                    <span>{t('saveDraft')}</span>
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveCharacterMutation.isPending}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {saveCharacterMutation.isPending ? t('creating') : t('createCharacter')}
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
                        <span>{t('preview')}</span>
                      </CardTitle>
                      <CardDescription>
                        {t('howCharacterAppears')}
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