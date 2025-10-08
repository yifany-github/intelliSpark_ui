import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Calendar, Upload, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const SUPABASE_ASSETS_BASE =
  (import.meta.env.VITE_SUPABASE_ASSETS_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  `${API_BASE_URL}/assets`;

// Preset avatars from Supabase (fallback to legacy /assets path in dev)
const PRESET_AVATARS = Array.from({ length: 9 }, (_, i) => ({
  id: i + 1,
  url: `${SUPABASE_ASSETS_BASE}/user_avatar_img/avatar_${i + 1}.png`,
}));

const resolveAvatarUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http')) {
    return url;
  }
  // Allow legacy /assets paths to resolve through the same base we use for presets
  if (url.startsWith('/assets/')) {
    return `${SUPABASE_ASSETS_BASE}${url.replace('/assets', '')}`;
  }
  return `${API_BASE_URL}${url}`;
};

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileEditModal = ({ isOpen, onClose }: ProfileEditModalProps) => {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    age: (user as any)?.age || '',
  });

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [selectedPresetAvatar, setSelectedPresetAvatar] = useState<number | null>(null);
  const [avatarMode, setAvatarMode] = useState<'preset' | 'upload'>('preset');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [usernameError, setUsernameError] = useState<string>('');

  // Username validation with debounce
  useEffect(() => {
    const username = formData.username.trim();

    // Skip if username hasn't changed or is empty
    if (!username || username === user?.username) {
      setUsernameStatus('idle');
      setUsernameError('');
      return;
    }

    setUsernameStatus('checking');
    setUsernameError('');

    const timeoutId = setTimeout(async () => {
      try {
        const response = await apiRequest('GET', `/api/auth/check-username?username=${encodeURIComponent(username)}`);
        const data = await response.json();

        if (data.available) {
          setUsernameStatus('available');
          setUsernameError('');
        } else {
          setUsernameStatus('taken');
          setUsernameError('Username is already taken');
        }
      } catch (error) {
        console.error('Username check failed:', error);
        setUsernameStatus('idle');
        setUsernameError('');
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [formData.username, user?.username]);

  const { mutate: updateProfile, isPending } = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest('PUT', '/api/auth/profile', data, {
        headers: {}, // Let browser set Content-Type for FormData
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update profile');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '✨ Profile Updated',
        description: 'Your profile has been successfully updated',
      });
      refreshUser?.();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Avatar must be less than 5MB',
          variant: 'destructive',
        });
        return;
      }
      setAvatarFile(file);
      setAvatarMode('upload');
      setSelectedPresetAvatar(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePresetAvatarSelect = (avatarId: number) => {
    setSelectedPresetAvatar(avatarId);
    setAvatarMode('preset');
    setAvatarFile(null);
    setAvatarPreview('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent submission if username is taken
    if (usernameStatus === 'taken') {
      toast({
        title: 'Invalid Username',
        description: 'This username is already taken. Please choose another one.',
        variant: 'destructive',
      });
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append('username', formData.username);
    formDataToSend.append('email', formData.email);
    if (formData.age) {
      formDataToSend.append('age', formData.age.toString());
    }

    // Avatar handling
    if (avatarMode === 'preset' && selectedPresetAvatar) {
      formDataToSend.append('preset_avatar_id', selectedPresetAvatar.toString());
    } else if (avatarMode === 'upload' && avatarFile) {
      formDataToSend.append('avatar', avatarFile);
    }

    updateProfile(formDataToSend);
  };

  // Get current avatar display
  const getCurrentAvatarUrl = () => {
    if (avatarMode === 'upload' && avatarPreview) {
      return avatarPreview;
    }
    if (avatarMode === 'preset' && selectedPresetAvatar) {
      return PRESET_AVATARS.find(a => a.id === selectedPresetAvatar)?.url;
    }
    return resolveAvatarUrl((user as any)?.avatar_url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <User className="w-5 h-5 text-pink-400" />
            Edit Profile
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
          {/* Avatar Selection */}
          <div className="flex flex-col items-center gap-4">
            {/* Current Avatar Preview */}
            <div className="relative">
              <div className={cn(
                "w-24 h-24 rounded-full overflow-hidden border-2 border-pink-500/50",
                "bg-gradient-to-br from-pink-500/20 to-purple-500/20",
                "flex items-center justify-center"
              )}>
                {getCurrentAvatarUrl() ? (
                  <img src={getCurrentAvatarUrl()} alt="Avatar preview" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-gray-400" />
                )}
              </div>
              {(avatarPreview || selectedPresetAvatar) && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarFile(null);
                    setAvatarPreview('');
                    setSelectedPresetAvatar(null);
                    setAvatarMode('preset');
                  }}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              )}
            </div>

            {/* Preset Avatars Grid */}
            <div className="w-full">
              <p className="text-sm font-medium text-gray-300 mb-3 text-center">Choose a preset avatar</p>
              <div className="grid grid-cols-5 gap-2">
                {PRESET_AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => handlePresetAvatarSelect(avatar.id)}
                    className={cn(
                      "relative w-full aspect-square rounded-full overflow-hidden",
                      "border-2 transition-all duration-200",
                      "hover:scale-110 hover:border-pink-400",
                      selectedPresetAvatar === avatar.id
                        ? "border-pink-500 ring-2 ring-pink-500/50 scale-105"
                        : "border-gray-700"
                    )}
                  >
                    <img
                      src={avatar.url}
                      alt={`Avatar ${avatar.id}`}
                      className="w-full h-full object-cover"
                    />
                    {selectedPresetAvatar === avatar.id && (
                      <div className="absolute inset-0 bg-pink-500/30 flex items-center justify-center">
                        <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Custom Avatar */}
            <div className="w-full flex flex-col items-center gap-2">
              <div className="text-xs text-gray-400">or</div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <div className="flex items-center gap-2 px-4 py-2 bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/50 rounded-lg transition-colors">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">Upload Custom Avatar</span>
                </div>
              </label>
              <p className="text-xs text-gray-400">Max 5MB • JPG, PNG, GIF</p>
            </div>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4 text-pink-400" />
              Username
            </Label>
            <div className="relative">
              <Input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className={cn(
                  "bg-gray-800 border-gray-700 focus:border-pink-500 focus:ring-pink-500 pr-10",
                  usernameStatus === 'taken' && "border-red-500 focus:border-red-500 focus:ring-red-500",
                  usernameStatus === 'available' && "border-green-500 focus:border-green-500 focus:ring-green-500"
                )}
                placeholder="Enter your username"
                required
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && (
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                )}
                {usernameStatus === 'available' && (
                  <Check className="w-4 h-4 text-green-500" />
                )}
                {usernameStatus === 'taken' && (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
            </div>
            {usernameError && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {usernameError}
              </p>
            )}
            {usernameStatus === 'available' && (
              <p className="text-xs text-green-400 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Username is available
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
              <Mail className="w-4 h-4 text-pink-400" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-gray-800 border-gray-700 focus:border-pink-500 focus:ring-pink-500"
              placeholder="Enter your email"
              required
            />
          </div>

          {/* Age */}
          <div className="space-y-2">
            <Label htmlFor="age" className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-pink-400" />
              Age
            </Label>
            <Input
              id="age"
              type="number"
              min="13"
              max="120"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              className="bg-gray-800 border-gray-700 focus:border-pink-500 focus:ring-pink-500"
              placeholder="Enter your age"
            />
            <p className="text-xs text-gray-400">Must be 13 or older</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-gray-800 border-gray-700 hover:bg-gray-700"
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
              disabled={isPending || usernameStatus === 'taken' || usernameStatus === 'checking'}
            >
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileEditModal;
