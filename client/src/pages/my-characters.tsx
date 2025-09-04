import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { 
  MoreVertical, 
  Edit, 
  Eye, 
  EyeOff, 
  MessageCircle, 
  Trash2, 
  Calendar, 
  Shield
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "wouter";

interface Character {
  id: number;
  name: string;
  description: string;
  avatarUrl?: string;
  backstory: string;
  personaPrompt?: string;
  voiceStyle: string;
  traits: string[];
  category?: string;
  gender?: string;
  age?: number;
  nsfwLevel: number;
  conversationStyle?: string;
  isPublic: boolean;
  createdBy?: number;
  createdAt: string;
  isFeatured: boolean;
  viewCount: number;
  likeCount: number;
  chatCount: number;
  trendingScore: number;
  lastActivity?: string;
}

export default function MyCharactersPage() {
  const [deleteCharacterId, setDeleteCharacterId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: characters = [], isLoading, error } = useQuery({
    queryKey: ['myCharacters'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/characters/users/me');
      return response.json();
    }
  });

  const togglePublishMutation = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await apiRequest('PUT', `/api/characters/${characterId}/publish`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCharacters'] });
      toast({
        title: "Success",
        description: "Character visibility updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update character visibility",
        variant: "destructive",
      });
    }
  });

  const deleteCharacterMutation = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await apiRequest('DELETE', `/api/characters/${characterId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCharacters'] });
      setDeleteCharacterId(null);
      toast({
        title: "Success",
        description: "Character deleted successfully",
      });
    },
    onError: (error: any) => {
      setDeleteCharacterId(null);
      toast({
        title: "Error",
        description: error.message || "Failed to delete character",
        variant: "destructive",
      });
    }
  });

  const handleTogglePublish = (characterId: number) => {
    togglePublishMutation.mutate(characterId);
  };

  const handleDeleteCharacter = (characterId: number) => {
    deleteCharacterMutation.mutate(characterId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getNSFWBadge = (nsfwLevel: number) => {
    if (nsfwLevel === 0) {
      return <Badge variant="secondary" className="text-green-600">SAFE</Badge>;
    } else {
      return <Badge variant="destructive">NSFW</Badge>;
    }
  };

  const getVisibilityBadge = (isPublic: boolean) => {
    return isPublic 
      ? <Badge variant="default" className="bg-blue-600">Public</Badge>
      : <Badge variant="outline">Private</Badge>;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Characters</h1>
        <div className="text-center">Loading your characters...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Characters</h1>
        <div className="text-center text-red-500">
          Error loading characters: {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Characters</h1>
        <Link to="/create-character">
          <Button>
            Create New Character
          </Button>
        </Link>
      </div>

      {characters.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">You haven't created any characters yet.</div>
          <Link to="/create-character">
            <Button>
              Create Your First Character
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map((character: Character) => (
            <Card key={character.id} className="hover:shadow-lg transition-shadow">
              {/* Image thumbnail similar to main Characters page */}
              <div className="relative w-full aspect-[3/4] overflow-hidden bg-surface-tertiary">
                <img
                  src={character.avatarUrl || '/assets/characters_img/Elara.jpeg'}
                  alt={`${character.name} avatar`}
                  className="w-full h-full object-cover transition-all duration-500"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/assets/characters_img/Elara.jpeg';
                    (target as any).onerror = null;
                  }}
                  loading="lazy"
                />
                {/* 18+ indicator for NSFW */}
                {character.nsfwLevel > 0 && (
                  <div className="absolute top-3 right-3 w-8 h-8 bg-red-500/90 backdrop-blur-sm rounded-full border border-red-400/50 flex items-center justify-center">
                    <span className="text-xs text-white font-bold leading-none">18+</span>
                  </div>
                )}
              </div>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{character.name}</CardTitle>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {getVisibilityBadge(character.isPublic)}
                      {getNSFWBadge(character.nsfwLevel)}
                      {character.age && <Badge variant="outline">{character.age}+</Badge>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <Link to={`/character/${character.id}/edit`}>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuItem onClick={() => handleTogglePublish(character.id)}>
                        {character.isPublic ? (
                          <>
                            <EyeOff className="h-4 w-4 mr-2" />
                            Unpublish
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            Publish
                          </>
                        )}
                      </DropdownMenuItem>
                      <Link to={`/chat-preview?characterId=${character.id}`}>
                        <DropdownMenuItem>
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Start Chat
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setDeleteCharacterId(character.id)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {character.description}
                  </p>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(character.createdAt)}
                    </div>
                    {character.chatCount > 0 && (
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {character.chatCount} chats
                      </div>
                    )}
                    {character.viewCount > 0 && (
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {character.viewCount} views
                      </div>
                    )}
                  </div>

                  {character.traits && character.traits.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {character.traits.slice(0, 3).map((trait, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {trait}
                        </Badge>
                      ))}
                      {character.traits.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{character.traits.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteCharacterId !== null} onOpenChange={(open) => !open && setDeleteCharacterId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your character and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCharacterId && handleDeleteCharacter(deleteCharacterId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
