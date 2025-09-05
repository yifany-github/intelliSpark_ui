import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Toggle } from '@/components/ui/toggle';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { useNavigation } from '@/contexts/NavigationContext';
import type { Character } from '@/types';

interface EditCharacterPageProps {
  characterId: string;
}

export default function EditCharacterPage({ characterId }: EditCharacterPageProps) {
  const { toast } = useToast();
  const { navigateToPath } = useNavigation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: character, isLoading, error } = useQuery<Character>({
    queryKey: ["character", characterId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/characters/${characterId}`);
      return res.json();
    }
  });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    personaPrompt: '',
    traits: [] as string[],
    category: 'original',
    categories: [] as string[],
    gender: '',
    isPublic: true,
    isNsfw: false,
    avatarUrl: '' as string | null,
  });

  useEffect(() => {
    if (character) {
      setFormData({
        name: character.name || '',
        description: character.description || '',
        personaPrompt: character.personaPrompt || character.backstory || '',
        traits: character.traits || [],
        category: character.category || 'original',
        categories: character.categories || [],
        gender: character.gender || '',
        isPublic: character.isPublic ?? true,
        isNsfw: (character.nsfwLevel || 0) > 0,
        avatarUrl: character.avatarUrl || '/assets/characters_img/Elara.jpeg',
      });
    }
  }, [character]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: formData.name,
        description: formData.description,
        personaPrompt: formData.personaPrompt || undefined,
        backstory: formData.personaPrompt || formData.description || '',
        traits: formData.traits,
        category: formData.category,
        categories: formData.categories,
        gender: formData.gender || undefined,
        isPublic: formData.isPublic,
        nsfwLevel: formData.isNsfw ? 1 : 0,
        avatarUrl: formData.avatarUrl || undefined,
      };
      const res = await apiRequest('PUT', `/api/characters/${characterId}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["character", characterId] });
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      queryClient.invalidateQueries({ queryKey: ["myCharacters"] });
      toast({ title: '✅ Character updated' });
      navigateToPath('/my-characters');
    },
    onError: (err: any) => {
      toast({ title: 'Update failed', description: err?.message || 'Please try again', variant: 'destructive' });
    }
  });

  const handleAvatarUpload = async (file: File) => {
    if (!file) return;
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: 'File too large', description: 'Max size is 5MB', variant: 'destructive' });
      return;
    }
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await apiRequest('POST', '/api/characters/upload-avatar', form);
      const data = await res.json();
      const url = data.avatarUrl || data.url;
      if (url) {
        setFormData(prev => ({ ...prev, avatarUrl: url }));
        toast({ title: 'Avatar uploaded' });
      }
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e?.message || 'Try a different image', variant: 'destructive' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }
  if (error || !character) {
    return <div className="p-6 text-red-600">Failed to load character.</div>;
  }

  return (
    <GlobalLayout>
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-bold mb-4 text-white">Edit Character</h1>

        <div className="space-y-6 bg-card/50 rounded-lg p-6">
          <h3 className="text-xl font-semibold border-b border-border pb-3 text-white">Basic Information</h3>
          <div className="flex items-center gap-6">
            <img src={formData.avatarUrl || '/assets/characters_img/Elara.jpeg'} alt="avatar" className="w-20 h-20 rounded object-cover" />
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && handleAvatarUpload(e.target.files[0])}
              />
              <Button variant="outline" className="border-slate-300 text-slate-900 bg-white hover:bg-slate-50" onClick={() => fileInputRef.current?.click()}>Change Avatar</Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" className="bg-white border-slate-300 text-slate-900" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={4} className="bg-white border-slate-300 text-slate-900" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="persona">Persona Prompt (LLM)</Label>
            <Textarea id="persona" rows={6} className="bg-white border-slate-300 text-slate-900" value={formData.personaPrompt} onChange={(e) => setFormData({ ...formData, personaPrompt: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <Label>Visibility</Label>
              <div className="grid grid-cols-1 gap-2">
                <Toggle
                  pressed={!formData.isPublic}
                  onPressedChange={() => setFormData({ ...formData, isPublic: false })}
                  className={`w-full rounded-md px-4 py-2 text-sm border transition-all ${!formData.isPublic ? 'bg-slate-700 text-white border-slate-700 ring-2 ring-slate-300' : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50'}`}
                >
                  Private (Unpublished)
                </Toggle>
                <Toggle
                  pressed={formData.isPublic}
                  onPressedChange={() => setFormData({ ...formData, isPublic: true })}
                  className={`w-full rounded-md px-4 py-2 text-sm border transition-all ${formData.isPublic ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-300' : 'bg-white text-slate-900 border-slate-300 hover:bg-blue-50'}`}
                >
                  Public
                </Toggle>
              </div>
            </div>
            <div className="space-y-1">
              <Label>NSFW</Label>
              <div className="grid grid-cols-1 gap-2">
                <Toggle
                  pressed={!formData.isNsfw}
                  onPressedChange={() => setFormData({ ...formData, isNsfw: false })}
                  className={`w-full rounded-md px-4 py-2 text-sm border transition-all ${!formData.isNsfw ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300' : 'bg-white text-slate-900 border-slate-300 hover:bg-emerald-50'}`}
                >
                  SAFE — Family-friendly
                </Toggle>
                <Toggle
                  pressed={formData.isNsfw}
                  onPressedChange={() => setFormData({ ...formData, isNsfw: true })}
                  className={`w-full rounded-md px-4 py-2 text-sm border transition-all ${formData.isNsfw ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white border-rose-700 ring-2 ring-rose-300' : 'bg-white text-slate-900 border-slate-300 hover:bg-rose-50'}`}
                >
                  NSFW — Adult-oriented
                </Toggle>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              className="bg-white text-slate-900 border border-slate-300 hover:bg-slate-50"
              onClick={() => navigateToPath('/my-characters')}
            >
              Cancel
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Save Changes</Button>
          </div>
        </div>
      </div>
    </GlobalLayout>
  );
}
