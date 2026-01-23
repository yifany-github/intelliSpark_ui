import { useMemo } from "react";
import {
  AlertTriangle,
  BarChart3,
  Crown,
  Edit,
  Eye,
  FileCode,
  Filter,
  MessageSquare,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CharacterForm } from "../components/CharacterForm";
import type { Character } from "../types";

const CharactersTab = ({
  apiBaseUrl,
  authHeaders,
  characters,
  filteredCharacters,
  searchTerm,
  onSearchTermChange,
  showDeleted,
  onShowDeletedChange,
  categoryFilter,
  onCategoryFilterChange,
  showCharacterDialog,
  onShowCharacterDialogChange,
  editingCharacter,
  onEditCharacter,
  onCreateCharacter,
  isCharacterSubmitting,
  onCharacterSubmit,
  onCharacterCancel,
  showAnalyticsDialog,
  onShowAnalyticsDialogChange,
  editingAnalytics,
  onEditingAnalyticsChange,
  onUpdateAnalytics,
  isUpdatingAnalytics,
  showPromptPreview,
  onShowPromptPreviewChange,
  promptPreviewData,
  onPromptPreview,
  onToggleFeatured,
  onDeleteCharacter,
  onRestoreCharacter,
  onHardDeleteCharacter,
}: {
  apiBaseUrl: string;
  authHeaders: Record<string, string>;
  characters: Character[];
  filteredCharacters: Character[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  showDeleted: boolean;
  onShowDeletedChange: (value: boolean) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  showCharacterDialog: boolean;
  onShowCharacterDialogChange: (open: boolean) => void;
  editingCharacter: Character | null;
  onEditCharacter: (character: Character) => void;
  onCreateCharacter: () => void;
  isCharacterSubmitting: boolean;
  onCharacterSubmit: (data: Omit<Character, "id" | "createdAt">, pendingImages?: File[]) => void;
  onCharacterCancel: () => void;
  showAnalyticsDialog: boolean;
  onShowAnalyticsDialogChange: (open: boolean) => void;
  editingAnalytics: Character | null;
  onEditingAnalyticsChange: (character: Character | null) => void;
  onUpdateAnalytics: () => void;
  isUpdatingAnalytics: boolean;
  showPromptPreview: boolean;
  onShowPromptPreviewChange: (open: boolean) => void;
  promptPreviewData: any;
  onPromptPreview: (previewData: any) => void;
  onToggleFeatured: (id: number) => void;
  onDeleteCharacter: (id: number) => void;
  onRestoreCharacter: (id: number) => void;
  onHardDeleteCharacter: (id: number) => void;
}) => {
  const categoryOptions = useMemo(() => {
    const allCategories = new Set<string>();
    characters.forEach(character => {
      if (character.categories) {
        character.categories.forEach(category => allCategories.add(category));
      }
    });
    return Array.from(allCategories).sort();
  }, [characters]);

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Character Management</h2>
          <p className="text-slate-600">Manage AI personalities and traits</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search characters..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="pl-10 w-64 bg-white border-slate-300 text-slate-900"
            />
          </div>
          <label className="flex items-center text-sm text-slate-700">
            <input
              type="checkbox"
              className="mr-2"
              checked={showDeleted}
              onChange={(e) => onShowDeletedChange(e.target.checked)}
            />
            Show Deleted
          </label>
          <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
            <SelectTrigger className="w-48 bg-white border-slate-300 text-slate-900">
              <div className="flex items-center">
                <Filter className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="筛选分类" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              <SelectItem value="uncategorized">未分类</SelectItem>
              {categoryOptions.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={showCharacterDialog} onOpenChange={onShowCharacterDialogChange}>
            <DialogTrigger asChild>
              <Button onClick={onCreateCharacter} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Add Character
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
              <DialogHeader className="bg-white">
                <DialogTitle className="text-xl text-slate-900">
                  {editingCharacter ? "Edit Character" : "Create New Character"}
                </DialogTitle>
              </DialogHeader>
              {editingCharacter && (
                <div className="text-xs text-slate-600 -mt-2 mb-2">
                  Created by: {editingCharacter.createdBy ? `User #${editingCharacter.createdBy}` : 'System'}
                </div>
              )}
              <CharacterForm
                character={editingCharacter}
                authHeaders={authHeaders}
                submitting={isCharacterSubmitting}
                onPromptPreview={onPromptPreview}
                onSubmit={onCharacterSubmit}
                onCancel={onCharacterCancel}
              />
            </DialogContent>
          </Dialog>

          {/* Analytics Edit Dialog */}
          <Dialog open={showAnalyticsDialog} onOpenChange={onShowAnalyticsDialogChange}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl text-slate-900 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-purple-600" />
                  Edit Analytics Data
                </DialogTitle>
              </DialogHeader>
              {editingAnalytics && (
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="viewCount" className="text-sm font-medium">View Count</Label>
                      <Input
                        id="viewCount"
                        type="number"
                        min="0"
                        defaultValue={editingAnalytics.viewCount || 0}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          onEditingAnalyticsChange({ ...editingAnalytics, viewCount: value });
                        }}
                        className="text-center"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chatCount" className="text-sm font-medium">Chat Count</Label>
                      <Input
                        id="chatCount"
                        type="number"
                        min="0"
                        defaultValue={editingAnalytics.chatCount || 0}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          onEditingAnalyticsChange({ ...editingAnalytics, chatCount: value });
                        }}
                        className="text-center"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="likeCount" className="text-sm font-medium">Like Count</Label>
                      <Input
                        id="likeCount"
                        type="number"
                        min="0"
                        defaultValue={editingAnalytics.likeCount || 0}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          onEditingAnalyticsChange({ ...editingAnalytics, likeCount: value });
                        }}
                        className="text-center"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="trendingScore" className="text-sm font-medium">Trending Score</Label>
                      <Input
                        id="trendingScore"
                        type="number"
                        step="0.1"
                        min="0"
                        defaultValue={editingAnalytics.trendingScore || 0}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          onEditingAnalyticsChange({ ...editingAnalytics, trendingScore: value });
                        }}
                        className="text-center"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        onShowAnalyticsDialogChange(false);
                        onEditingAnalyticsChange(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={onUpdateAnalytics}
                      disabled={isUpdatingAnalytics}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {isUpdatingAnalytics ? "Updating..." : "Update Analytics"}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Prompt Preview Dialog */}
          <Dialog open={showPromptPreview} onOpenChange={onShowPromptPreviewChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white text-slate-900">
              <DialogHeader className="bg-white">
                <DialogTitle className="text-xl text-slate-900 flex items-center">
                  <FileCode className="w-5 h-5 mr-2 text-blue-600" />
                  Prompt Preview: {promptPreviewData?.character_name || "Character"}
                </DialogTitle>
              </DialogHeader>
              {promptPreviewData && (
                <div className="space-y-6 py-4">
                  {/* Header Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-900">Persona Source</Label>
                      <Badge variant="outline" className={
                        promptPreviewData.used_fields?.persona_source === 'persona_prompt'
                          ? "bg-green-100 text-green-700 border-green-300"
                          : "bg-blue-100 text-blue-700 border-blue-300"
                      }>
                        {promptPreviewData.used_fields?.persona_source === 'persona_prompt' ? 'Persona Prompt' : 'Backstory'}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-900">Token Estimate</Label>
                      <div className="text-2xl font-bold text-slate-700">
                        ~{promptPreviewData.token_counts?.total_tokens || 0} tokens
                      </div>
                    </div>
                  </div>

                  {/* Warnings */}
                  {promptPreviewData.validation_warnings && promptPreviewData.validation_warnings.length > 0 && (
                    <Alert className="border-yellow-200 bg-yellow-50">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800">
                        <strong>Warnings:</strong>
                        <ul className="mt-2 list-disc list-inside">
                          {promptPreviewData.validation_warnings.map((warning: string, index: number) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Persona/System Preview */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-slate-900">Compiled Prompt (Persona Focus)</Label>
                    <div className="bg-slate-100 border border-slate-300 rounded-lg p-4 font-mono text-sm text-slate-800 max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-slate-900">{promptPreviewData.sections?.persona || promptPreviewData.system_text}</pre>
                    </div>
                    <p className="text-xs text-slate-600">
                      Preview prioritizes the persona section. System prompt may be applied at runtime.
                    </p>
                  </div>

                  {/* Metadata */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <Label className="text-sm font-medium text-slate-900">Metadata</Label>
                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-slate-700">Character Name:</span> {promptPreviewData.used_fields?.name}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Gender:</span> {promptPreviewData.used_fields?.gender || "Not specified"}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">System Tokens:</span> ~{promptPreviewData.token_counts?.system_tokens || 0}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Context Tokens:</span> ~{promptPreviewData.token_counts?.messages_tokens || 0}
                      </div>
                    </div>
                  </div>

                  {/* Close Button */}
                  <div className="flex justify-end pt-4 border-t">
                    <Button
                      onClick={() => onShowPromptPreviewChange(false)}
                      className="bg-slate-600 hover:bg-slate-700 text-white"
                    >
                      Close Preview
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCharacters.map((character) => (
          <Card key={character.id} className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                    {character.avatarUrl ? (
                      <img
                        key={`${character.id}-${character.avatarUrl}-${Date.now()}`}
                        src={`${character.avatarUrl.startsWith('http') ? character.avatarUrl : `${apiBaseUrl}${character.avatarUrl}`}?v=${Date.now()}`}
                        alt={character.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error('Image failed to load:', character.avatarUrl);
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                        onLoad={() => {
                          ;
                        }}
                      />
                    ) : null}
                    <div className={`${character.avatarUrl ? 'hidden' : ''} w-full h-full flex items-center justify-center bg-slate-200`}>
                      <Users className="w-6 h-6 text-slate-400" />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <CardTitle className="text-lg text-slate-900">{character.name}</CardTitle>
                    <div className="text-xs text-slate-500 mt-1">
                      Created by: {character.createdBy ? `User #${character.createdBy}` : 'System'}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {/* Featured Status Toggle */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onToggleFeatured(character.id)}
                    className={`h-8 w-8 p-0 ${character.isFeatured ? 'bg-amber-100 hover:bg-amber-200' : 'hover:bg-gray-100'}`}
                    title={character.isFeatured ? "Remove from Editor's Choice" : "Add to Editor's Choice"}
                  >
                    <Crown className={`w-4 h-4 ${character.isFeatured ? 'text-amber-600' : 'text-gray-400'}`} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEditCharacter(character)}
                    className="h-8 w-8 p-0 hover:bg-blue-100"
                    title="Edit Character"
                  >
                    <Edit className="w-4 h-4 text-blue-600" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onEditingAnalyticsChange(character);
                      onShowAnalyticsDialogChange(true);
                    }}
                    className="h-8 w-8 p-0 hover:bg-purple-100"
                    title="Edit Analytics Data"
                  >
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                  </Button>
                  {character.isDeleted ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRestoreCharacter(character.id)}
                        className="h-8 w-auto px-2 hover:bg-green-100"
                        title="Restore Character"
                      >
                        Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onHardDeleteCharacter(character.id)}
                        className="h-8 w-auto px-2 hover:bg-red-100 text-red-600"
                        title="Hard Delete (permanent)"
                      >
                        Hard Delete
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeleteCharacter(character.id)}
                      className="h-8 w-8 p-0 hover:bg-red-100"
                      title="Delete Character"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {character.isDeleted && (
                <div className="mb-2">
                  <Badge variant="destructive">Deleted (Soft)</Badge>
                  {character.deleteReason && (
                    <span className="ml-2 text-xs text-slate-500">Reason: {character.deleteReason}</span>
                  )}
                </div>
              )}
              <p className="text-sm text-slate-600 mb-4 line-clamp-3">
                {character.backstory}
              </p>
              {/* 分类标签 */}
              {character.categories && character.categories.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  <span className="text-xs font-medium text-gray-600 mr-1">分类:</span>
                  {character.categories.slice(0, 3).map((category, index) => (
                    <Badge key={index} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                      {category}
                    </Badge>
                  ))}
                  {character.categories.length > 3 && (
                    <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-300">
                      +{character.categories.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              {/* 角色特征 */}
              <div className="flex flex-wrap gap-1 mb-4">
                <span className="text-xs font-medium text-gray-600 mr-1">特征:</span>
                {character.traits.slice(0, 3).map((trait, index) => (
                  <Badge key={index} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                    {trait}
                  </Badge>
                ))}
                {character.traits.length > 3 && (
                  <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700 border-slate-300">
                    +{character.traits.length - 3} more
                  </Badge>
                )}
              </div>

              {/* Admin Analytics */}
              <div className="grid grid-cols-2 gap-2 mb-3 p-2 bg-slate-50 rounded">
                <div className="flex items-center space-x-1">
                  <Eye className="w-3 h-3 text-slate-500" />
                  <span className="text-xs text-slate-600">Views: {character.viewCount || 0}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <MessageSquare className="w-3 h-3 text-slate-500" />
                  <span className="text-xs text-slate-600">Chats: {character.chatCount || 0}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <TrendingUp className="w-3 h-3 text-slate-500" />
                  <span className="text-xs text-slate-600">Score: {character.trendingScore || 0}</span>
                </div>
                <div className="flex items-center space-x-1">
                  {character.isFeatured ? (
                    <>
                      <Crown className="w-3 h-3 text-amber-500" />
                      <span className="text-xs text-amber-600">Featured</span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">Not featured</span>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Created: {new Date(character.createdAt).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCharacters.length === 0 && (
        <Card className="shadow-sm border-slate-200">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="w-16 h-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No characters found</h3>
            <p className="text-gray-500 text-center mb-4">
              {searchTerm ? "No characters match your search criteria." : "Get started by creating your first character."}
            </p>
            {!searchTerm && (
              <Button onClick={onCreateCharacter} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Create Character
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default CharactersTab;
