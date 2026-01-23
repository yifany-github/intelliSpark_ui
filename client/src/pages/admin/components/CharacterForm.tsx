import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Loader2, Plus, Shield } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ImageSelector } from "@/components/admin/ImageSelector";
import { GalleryManagement } from "@/components/admin/GalleryManagement";
import CategorySelector from "@/components/characters/CategorySelector";
import type { Character } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Validation functions
const validateAge = (age: number): boolean => age >= 1 && age <= 200;
// NSFW is binary (SAFE=0, NSFW=1)
const validateNSFWLevel = (level: number): boolean => level === 0 || level === 1;

export const CharacterForm = ({
  character,
  onSubmit,
  onCancel,
  authHeaders,
  onPromptPreview,
  submitting = false,
}: {
  character: Character | null;
  onSubmit: (data: Omit<Character, "id" | "createdAt">, pendingImages?: File[]) => void;
  onCancel: () => void;
  authHeaders: Record<string, string>;
  onPromptPreview: (previewData: any) => void;
  submitting?: boolean;
}) => {
  const [formData, setFormData] = useState({
    name: character?.name || "",
    description: character?.description || "",
    avatarUrl: character?.avatarUrl || "",
    backstory: character?.backstory || "",
    personaPrompt: character?.personaPrompt || character?.backstory || "",
    voiceStyle: character?.voiceStyle || "",
    traits: character?.traits || [],
    personalityTraits: character?.personalityTraits || {},
    category: character?.category || "original",
    categories: character?.categories || [],
    gender: character?.gender || "",
    nsfwLevel: character?.nsfwLevel || 0,
    age: character?.age || undefined,
    conversationStyle: character?.conversationStyle || "",
    isPublic: character?.isPublic ?? true,
    galleryEnabled: character?.galleryEnabled || false,
  });

  const [pendingGalleryImages, setPendingGalleryImages] = useState<File[]>([]);
  const [newTrait, setNewTrait] = useState("");

  // Reset form data when character changes
  useEffect(() => {
    setFormData({
      name: character?.name || "",
      description: character?.description || "",
      avatarUrl: character?.avatarUrl || "",
      backstory: character?.backstory || "",
      personaPrompt: character?.personaPrompt || character?.backstory || "",
      voiceStyle: character?.voiceStyle || "",
      traits: character?.traits || [],
      personalityTraits: character?.personalityTraits || {},
      category: character?.category || "original",
      categories: character?.categories || [],
      gender: character?.gender || "",
      nsfwLevel: character?.nsfwLevel || 0,
      age: character?.age || undefined,
      conversationStyle: character?.conversationStyle || "",
      isPublic: character?.isPublic ?? true,
      galleryEnabled: character?.galleryEnabled || false,
    });
    // Clear pending images when switching characters
    setPendingGalleryImages([]);
  }, [character]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (formData.age && !validateAge(formData.age)) {
      toast({
        title: "❌ Validation Error",
        description: "Age must be between 1 and 200",
        variant: "destructive",
      });
      return;
    }

    // NSFW is a binary toggle; enforce 0 or 1 if necessary (defensive)
    if (formData.nsfwLevel !== undefined && !validateNSFWLevel(formData.nsfwLevel)) {
      toast({
        title: "❌ Validation Error",
        description: "Invalid NSFW value. Choose SAFE or NSFW.",
        variant: "destructive",
      });
      return;
    }
    if ((formData.nsfwLevel || 0) > 0) {
      if (!formData.age || formData.age < 18) {
        toast({
          title: "❌ Validation Error",
          description: "NSFW characters must have age 18 or above",
          variant: "destructive",
        });
        return;
      }
    }
    // Mirror personaPrompt to backstory to satisfy backend expectations
    const submitData = {
      ...formData,
      backstory: formData.personaPrompt || formData.backstory || "",
    };

    onSubmit(submitData as any, pendingGalleryImages);
  };

  const addTrait = () => {
    if (newTrait.trim()) {
      setFormData({
        ...formData,
        traits: [...formData.traits, newTrait.trim()],
      });
      setNewTrait("");
    }
  };

  const removeTrait = (index: number) => {
    setFormData({
      ...formData,
      traits: formData.traits.filter((_, i) => i !== index),
    });
  };

  return (
    <ScrollArea className="max-h-[70vh] bg-white">
      <form onSubmit={handleSubmit} className="space-y-6 p-1 bg-white text-slate-900">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-slate-900">Character Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter character name"
              className="bg-white border-slate-300 text-slate-900"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-slate-900">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the character (minimum 10 characters)"
              className="bg-white border-slate-300 text-slate-900"
              required
            />
          </div>

          <ImageSelector
            authHeaders={authHeaders}
            value={formData.avatarUrl}
            onChange={(url) => setFormData({ ...formData, avatarUrl: url })}
            assetType="characters"
            label="Character Avatar"
            required
          />
        </div>

        {/* Gallery Settings - Right after avatar since they're both image-related */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <Checkbox
              id="galleryEnabled"
              checked={formData.galleryEnabled || false}
              onCheckedChange={(checked) => setFormData({ ...formData, galleryEnabled: checked as boolean })}
              className="border-slate-300"
            />
            <Label htmlFor="galleryEnabled" className="text-sm font-medium text-slate-700">
              Enable Gallery (character can have multiple images)
            </Label>
          </div>

          <GalleryManagement
            characterId={character?.id || 0}
            galleryEnabled={formData.galleryEnabled || false}
            onGalleryChange={(enabled) => setFormData({ ...formData, galleryEnabled: enabled })}
            authHeaders={authHeaders}
            isCreationMode={!character?.id}
            pendingImages={pendingGalleryImages}
            onPendingImagesChange={setPendingGalleryImages}
          />
        </div>

        {/* Backstory removed for MVP: persona prompt is the single authoring field. */}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="personaPrompt" className="text-sm font-medium text-slate-900">Persona Prompt (LLM)</Label>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${formData.personaPrompt.length > 2000 ? 'text-yellow-600' : 'text-slate-500'}`}>
                {formData.personaPrompt.length} / 5000 chars
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs px-2 py-1 h-auto border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
                onClick={async () => {
                  // Prefer live form content so edits are previewed without saving
                  const localPersona = (formData.personaPrompt || "").trim();
                  if (localPersona.length > 0 || !character?.id) {
                    const localText = localPersona || "No persona prompt provided";
                    const mockPreview = {
                      system_text: localText,
                      token_counts: {
                        system_tokens: Math.ceil(localText.length / 4),
                        total_tokens: Math.ceil(localText.length / 4)
                      },
                      used_fields: {
                        persona_source: localPersona.length > 0 ? "persona_prompt" : "backstory",
                        name: formData.name,
                        gender: formData.gender
                      },
                      sections: { persona: localText },
                      validation_warnings: [],
                      character_name: formData.name
                    };
                    onPromptPreview(mockPreview);
                    return;
                  }

                  // If no unsaved changes and character exists, fetch server-compiled preview
                  try {
                    const response = await fetch(`${API_BASE_URL}/api/admin/characters/${character.id}/prompt?preview=true`, {
                      headers: authHeaders,
                    });
                    if (response.ok) {
                      const previewData = await response.json();
                      onPromptPreview(previewData);
                    } else {
                      const localText = localPersona || "No persona prompt provided";
                      const mockPreview = {
                        system_text: localText,
                        token_counts: {
                          system_tokens: Math.ceil(localText.length / 4),
                          total_tokens: Math.ceil(localText.length / 4)
                        },
                        used_fields: {
                          persona_source: localPersona.length > 0 ? "persona_prompt" : "backstory",
                          name: formData.name,
                          gender: formData.gender
                        },
                        sections: { persona: localText },
                        validation_warnings: [],
                        character_name: formData.name
                      };
                      onPromptPreview(mockPreview);
                    }
                  } catch (error) {
                    console.error('Failed to generate preview:', error);
                    const localText = localPersona || "No persona prompt provided";
                    const mockPreview = {
                      system_text: localText,
                      token_counts: {
                        system_tokens: Math.ceil(localText.length / 4),
                        total_tokens: Math.ceil(localText.length / 4)
                      },
                      used_fields: {
                        persona_source: localPersona.length > 0 ? "persona_prompt" : "backstory",
                        name: formData.name,
                        gender: formData.gender
                      },
                      sections: { persona: localText },
                      validation_warnings: [],
                      character_name: formData.name
                    };
                    onPromptPreview(mockPreview);
                  }
                }}
                disabled={submitting}
              >
                Preview
              </Button>
            </div>
          </div>
          <Textarea
            id="personaPrompt"
            value={formData.personaPrompt}
            onChange={(e) => setFormData({ ...formData, personaPrompt: e.target.value })}
            placeholder="Optional: Define how the AI should behave as this character. If empty, backstory will be used for the LLM..."
            className={`bg-white border-slate-300 text-slate-900 ${formData.personaPrompt.length > 2000 ? 'border-yellow-400' : ''}`}
            rows={6}
          />
          <div className="text-xs text-slate-600">
            <p><strong>When to use:</strong> Provide explicit instructions for the AI's personality and behavior.</p>
            <p><strong>When empty:</strong> The backstory above will be used as the persona prompt.</p>
            {formData.personaPrompt.length > 2000 && (
              <p className="text-yellow-600 font-medium">⚠ Warning: Long prompts may affect performance. Consider keeping under 2000 characters.</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="voiceStyle" className="text-sm font-medium text-slate-900">Voice Style</Label>
          <Textarea
            id="voiceStyle"
            value={formData.voiceStyle}
            onChange={(e) => setFormData({ ...formData, voiceStyle: e.target.value })}
            placeholder="Describe how the character speaks and their communication style..."
            className="bg-white border-slate-300 text-slate-900"
            rows={3}
            required
          />
        </div>

        {/* 分类标签选择 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-slate-900">角色分类</Label>
          <CategorySelector
            selectedCategories={formData.categories}
            onCategoriesChange={(categories) => {
              setFormData({
                ...formData,
                categories,
                // 同时更新单个category字段以保持向后兼容
                category: categories.length > 0 ? categories[0] : 'original'
              });
            }}
            maxSelections={5}
            className="bg-white border border-slate-300 rounded-lg p-4"
          />
        </div>

        {/* Gender Selection */}
        <div className="space-y-2">
          <Label htmlFor="gender" className="text-sm font-medium text-slate-900">Gender</Label>
          <Select value={formData.gender || ""} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
            <SelectTrigger className="bg-white border-slate-300 text-slate-900">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="non-binary">Non-binary</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="unspecified">Unspecified</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* NSFW Toggle (Binary, Vertical, Colored) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-900">NSFW Content</Label>
          <div className="grid grid-cols-1 gap-2">
            <Toggle
              pressed={(formData.nsfwLevel || 0) === 0}
              onPressedChange={() => setFormData({ ...formData, nsfwLevel: 0 })}
              className={`w-full rounded-md px-4 py-2 text-sm border transition-all flex items-center
                ${(formData.nsfwLevel || 0) === 0
                  ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300 shadow-md shadow-emerald-200'
                  : 'bg-white text-slate-900 border-slate-300 hover:bg-emerald-50'}
              `}
            >
              <Shield className="w-4 h-4 mr-2" />
              SAFE — Family-friendly prompt
            </Toggle>
            <Toggle
              pressed={(formData.nsfwLevel || 0) > 0}
              onPressedChange={() => setFormData({ ...formData, nsfwLevel: 1 })}
              className={`w-full rounded-md px-4 py-2 text-sm border transition-all flex items-center
                ${(formData.nsfwLevel || 0) > 0
                  ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white border-rose-700 ring-2 ring-rose-300 shadow-md shadow-rose-200'
                  : 'bg-white text-slate-900 border-slate-300 hover:bg-rose-50'}
              `}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              NSFW — Adult-oriented prompt
            </Toggle>
          </div>
          <p className="text-xs text-slate-600">Choose SAFE (blue) or NSFW (red). Only one can be active.</p>
        </div>

        {/* Age Field */}
        <div className="space-y-2">
          <Label htmlFor="age" className="text-sm font-medium text-slate-900">Age (Optional)</Label>
          <Input
            id="age"
            type="number"
            min="1"
            max="200"
            value={formData.age || ""}
            onChange={(e) => setFormData({ ...formData, age: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Enter character age"
            className="bg-white border-slate-300 text-slate-900"
          />
        </div>

        {/* Conversation Style */}
        <div className="space-y-2">
          <Label htmlFor="conversationStyle" className="text-sm font-medium text-slate-900">Conversation Style</Label>
          <Input
            id="conversationStyle"
            value={formData.conversationStyle || ""}
            onChange={(e) => setFormData({ ...formData, conversationStyle: e.target.value })}
            placeholder="Describe conversation style (e.g., formal, casual, playful)"
            className="bg-white border-slate-300 text-slate-900"
          />
        </div>

        {/* Character Settings Toggles */}
        <div className="space-y-4">
          <Label className="text-sm font-medium text-slate-900">Character Settings</Label>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isPublic"
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked as boolean })}
              />
              <Label htmlFor="isPublic" className="text-sm text-slate-700">Public Character (visible to all users)</Label>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium text-slate-900">Character Traits</Label>
          <div className="flex gap-2">
            <Input
              value={newTrait}
              onChange={(e) => setNewTrait(e.target.value)}
              placeholder="Add a trait (e.g., Brave, Witty, Mysterious)"
              className="bg-white border-slate-300 text-slate-900"
              onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTrait())}
            />
            <Button type="button" onClick={addTrait} variant="outline" className="text-slate-700 border-slate-300 bg-white hover:bg-slate-50">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 min-h-[40px] p-3 border rounded-lg bg-slate-50">
            {formData.traits.map((trait, index) => (
              <Badge
                key={index}
                variant="outline"
                className="cursor-pointer hover:bg-red-100 hover:text-red-700 transition-colors bg-blue-50 text-blue-700 border-blue-300"
                onClick={() => removeTrait(index)}
              >
                {trait} ×
              </Badge>
            ))}
            {formData.traits.length === 0 && (
              <span className="text-gray-400 text-sm">No traits added yet</span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} className="text-slate-700 border-slate-300 bg-white hover:bg-slate-50" disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {character ? (submitting ? "Updating..." : "Update Character") : (submitting ? "Creating..." : "Create Character")}
          </Button>
        </div>
      </form>
    </ScrollArea>
  );
};
