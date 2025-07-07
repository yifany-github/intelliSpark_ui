import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  FileText,
  MessageSquare,
  Settings,
  DollarSign,
  Lock,
  Plus,
  Edit,
  Trash2,
  Eye,
  BarChart3,
  Search,
  Filter,
  Upload,
  Download,
  RefreshCw,
  TrendingUp,
  Activity,
  Clock,
  Globe,
  Shield,
  Database,
  FileCode,
  Zap,
  Target
} from "lucide-react";

interface AdminStats {
  totals: {
    users: number;
    scenes: number;
    characters: number;
    chats: number;
    messages: number;
  };
  recent_activity: {
    chats_last_30_days: number;
  };
  popular_content: {
    scenes: { name: string; chat_count: number }[];
    characters: { name: string; chat_count: number }[];
  };
}

interface Scene {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  location: string;
  mood: string;
  rating: string;
  createdAt: string;
}

interface Character {
  id: number;
  name: string;
  avatarUrl: string;
  backstory: string;
  voiceStyle: string;
  traits: string[];
  personalityTraits: { [key: string]: number };
  createdAt: string;
}

interface User {
  id: number;
  username: string;
  nsfw_level: number;
  context_window_length: number;
  temperature: number;
  memory_enabled: boolean;
  created_at: string;
  total_chats: number;
}

const AdminPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [showSceneDialog, setShowSceneDialog] = useState(false);
  const [showCharacterDialog, setShowCharacterDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (token) {
      setAuthToken(token);
      setIsAuthenticated(true);
    }
  }, []);

  const authHeaders = {
    Authorization: `Bearer ${authToken}`,
  };

  const loginMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        throw new Error("Invalid password");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setAuthToken(data.access_token);
      setIsAuthenticated(true);
      localStorage.setItem("adminToken", data.access_token);
      toast({ 
        title: "✅ Login successful", 
        description: "Welcome to ProductInsightAI Admin Panel",
        className: "border-green-200 bg-green-50"
      });
    },
    onError: () => {
      toast({
        title: "❌ Login failed",
        description: "Invalid password. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogin = () => {
    if (loginPassword) {
      loginMutation.mutate(loginPassword);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthToken(null);
    localStorage.removeItem("adminToken");
    toast({ 
      title: "Logged out", 
      description: "You have been logged out successfully",
      className: "border-blue-200 bg-blue-50"
    });
  };

  const { data: stats, refetch: refetchStats } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stats", {
        headers: authHeaders,
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const { data: scenes = [], refetch: refetchScenes } = useQuery<Scene[]>({
    queryKey: ["admin-scenes"],
    queryFn: async () => {
      const response = await fetch("/api/admin/scenes", {
        headers: authHeaders,
      });
      if (!response.ok) throw new Error("Failed to fetch scenes");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: characters = [], refetch: refetchCharacters } = useQuery<Character[]>({
    queryKey: ["admin-characters"],
    queryFn: async () => {
      const response = await fetch("/api/admin/characters", {
        headers: authHeaders,
      });
      if (!response.ok) throw new Error("Failed to fetch characters");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: users = [], refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const response = await fetch("/api/admin/users", {
        headers: authHeaders,
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const sceneCreateMutation = useMutation({
    mutationFn: async (sceneData: Omit<Scene, "id" | "createdAt">) => {
      const response = await fetch("/api/admin/scenes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(sceneData),
      });
      if (!response.ok) throw new Error("Failed to create scene");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-scenes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({ 
        title: "✅ Scene created successfully",
        className: "border-green-200 bg-green-50"
      });
      setShowSceneDialog(false);
    },
  });

  const sceneUpdateMutation = useMutation({
    mutationFn: async ({ id, ...sceneData }: Scene) => {
      const response = await fetch(`/api/admin/scenes/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(sceneData),
      });
      if (!response.ok) throw new Error("Failed to update scene");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-scenes"] });
      toast({ 
        title: "✅ Scene updated successfully",
        className: "border-green-200 bg-green-50"
      });
      setEditingScene(null);
      setShowSceneDialog(false);
    },
  });

  const sceneDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/scenes/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!response.ok) throw new Error("Failed to delete scene");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-scenes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({ 
        title: "✅ Scene deleted successfully",
        className: "border-green-200 bg-green-50"
      });
    },
  });

  const characterCreateMutation = useMutation({
    mutationFn: async (characterData: Omit<Character, "id" | "createdAt">) => {
      const response = await fetch("/api/admin/characters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(characterData),
      });
      if (!response.ok) throw new Error("Failed to create character");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-characters"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({ 
        title: "✅ Character created successfully",
        className: "border-green-200 bg-green-50"
      });
      setShowCharacterDialog(false);
    },
  });

  const characterUpdateMutation = useMutation({
    mutationFn: async ({ id, ...characterData }: Character) => {
      const response = await fetch(`/api/admin/characters/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(characterData),
      });
      if (!response.ok) throw new Error("Failed to update character");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-characters"] });
      toast({ 
        title: "✅ Character updated successfully",
        className: "border-green-200 bg-green-50"
      });
      setEditingCharacter(null);
      setShowCharacterDialog(false);
    },
  });

  const characterDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/characters/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!response.ok) throw new Error("Failed to delete character");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-characters"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({ 
        title: "✅ Character deleted successfully",
        className: "border-green-200 bg-green-50"
      });
    },
  });

  const filteredScenes = scenes.filter(scene =>
    scene.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    scene.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCharacters = characters.filter(character =>
    character.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    character.backstory.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <Card className="w-full max-w-md shadow-2xl border border-slate-200 bg-white">
          <CardHeader className="text-center pb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              ProductInsightAI Admin
            </CardTitle>
            <p className="text-muted-foreground mt-2">Secure Administrator Access</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-900">Administrator Password</Label>
              <Input
                id="password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter your admin password"
                className="h-12 bg-white border-slate-300 text-slate-900"
              />
            </div>
            <Button 
              onClick={handleLogin}
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Access Admin Panel
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">ProductInsightAI Admin</h1>
                <p className="text-sm text-slate-600">Content Management System</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => {
                  refetchStats();
                  refetchScenes();
                  refetchCharacters();
                  refetchUsers();
                }}
                variant="outline"
                size="sm"
                className="border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={handleLogout} variant="outline" size="sm" className="border-red-300 text-red-600 bg-white hover:bg-red-50">
                <Lock className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-white p-1 rounded-lg shadow-sm border border-slate-200">
            <TabsTrigger value="overview" className="text-slate-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="scenes" className="text-slate-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white">
              <FileText className="w-4 h-4 mr-2" />
              Scenes
            </TabsTrigger>
            <TabsTrigger value="characters" className="text-slate-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" />
              Characters
            </TabsTrigger>
            <TabsTrigger value="users" className="text-slate-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white">
              <Globe className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-slate-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white">
              <Activity className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="system" className="text-slate-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white">
              <Database className="w-4 h-4 mr-2" />
              System
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-blue-100">Total Users</CardTitle>
                  <Users className="w-5 h-5 text-blue-200" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats?.totals.users || 0}</div>
                  <p className="text-xs text-blue-200 mt-1">Active community members</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-purple-100">Total Scenes</CardTitle>
                  <FileText className="w-5 h-5 text-purple-200" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats?.totals.scenes || 0}</div>
                  <p className="text-xs text-purple-200 mt-1">Available scenarios</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-green-100">Characters</CardTitle>
                  <Target className="w-5 h-5 text-green-200" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats?.totals.characters || 0}</div>
                  <p className="text-xs text-green-200 mt-1">AI personalities</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-orange-100">Total Chats</CardTitle>
                  <MessageSquare className="w-5 h-5 text-orange-200" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats?.totals.chats || 0}</div>
                  <p className="text-xs text-orange-200 mt-1">Conversations started</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-pink-500 to-pink-600 text-white border-0 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-pink-100">Messages</CardTitle>
                  <Zap className="w-5 h-5 text-pink-200" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats?.totals.messages || 0}</div>
                  <p className="text-xs text-pink-200 mt-1">Total exchanges</p>
                </CardContent>
              </Card>
            </div>

            {/* Activity and Popular Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center text-slate-900">
                    <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                    Popular Scenes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats?.popular_content.scenes.map((scene, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-sm font-bold text-purple-600">#{index + 1}</span>
                          </div>
                          <span className="font-medium text-slate-700">{scene.name}</span>
                        </div>
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                          {scene.chat_count} chats
                        </Badge>
                      </div>
                    ))}
                    {(!stats?.popular_content.scenes.length) && (
                      <p className="text-slate-500 text-center py-4">No data available yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center text-slate-900">
                    <Users className="w-5 h-5 mr-2 text-blue-600" />
                    Popular Characters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats?.popular_content.characters.map((character, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                          </div>
                          <span className="font-medium text-slate-700">{character.name}</span>
                        </div>
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                          {character.chat_count} chats
                        </Badge>
                      </div>
                    ))}
                    {(!stats?.popular_content.characters.length) && (
                      <p className="text-slate-500 text-center py-4">No data available yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity Alert */}
            <Alert className="border-blue-200 bg-blue-50">
              <Activity className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>{stats?.recent_activity.chats_last_30_days || 0}</strong> new chats created in the last 30 days
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="scenes" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Scene Management</h2>
                <p className="text-slate-600">Manage roleplay scenarios and environments</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search scenes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64 bg-white border-slate-300 text-slate-900"
                  />
                </div>
                <Dialog open={showSceneDialog} onOpenChange={setShowSceneDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingScene(null)} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Scene
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-xl text-slate-900">
                        {editingScene ? "Edit Scene" : "Create New Scene"}
                      </DialogTitle>
                    </DialogHeader>
                    <SceneForm
                      scene={editingScene}
                      onSubmit={(data) => {
                        if (editingScene) {
                          sceneUpdateMutation.mutate({ ...data, id: editingScene.id, createdAt: editingScene.createdAt });
                        } else {
                          sceneCreateMutation.mutate(data);
                        }
                      }}
                      onCancel={() => {
                        setShowSceneDialog(false);
                        setEditingScene(null);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredScenes.map((scene) => (
                <Card key={scene.id} className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg text-slate-900">{scene.name}</CardTitle>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingScene(scene);
                            setShowSceneDialog(true);
                          }}
                          className="h-8 w-8 p-0 hover:bg-blue-100"
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => sceneDeleteMutation.mutate(scene.id)}
                          className="h-8 w-8 p-0 hover:bg-red-100"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 mb-4 line-clamp-3">
                      {scene.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">{scene.location}</Badge>
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300">{scene.mood}</Badge>
                      <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">{scene.rating}</Badge>
                    </div>
                    <div className="text-xs text-slate-500">
                      Created: {new Date(scene.createdAt).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {filteredScenes.length === 0 && (
              <Card className="shadow-sm border-slate-200">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <FileText className="w-16 h-16 text-slate-300 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">No scenes found</h3>
                  <p className="text-slate-500 text-center mb-4">
                    {searchTerm ? "No scenes match your search criteria." : "Get started by creating your first scene."}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => setShowSceneDialog(true)} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Scene
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="characters" className="space-y-6">
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
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64 bg-white border-slate-300 text-slate-900"
                  />
                </div>
                <Dialog open={showCharacterDialog} onOpenChange={setShowCharacterDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingCharacter(null)} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Character
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-xl text-slate-900">
                        {editingCharacter ? "Edit Character" : "Create New Character"}
                      </DialogTitle>
                    </DialogHeader>
                    <CharacterForm
                      character={editingCharacter}
                      onSubmit={(data) => {
                        if (editingCharacter) {
                          characterUpdateMutation.mutate({ ...data, id: editingCharacter.id, createdAt: editingCharacter.createdAt });
                        } else {
                          characterCreateMutation.mutate(data);
                        }
                      }}
                      onCancel={() => {
                        setShowCharacterDialog(false);
                        setEditingCharacter(null);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCharacters.map((character) => (
                <Card key={character.id} className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg text-slate-900">{character.name}</CardTitle>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingCharacter(character);
                            setShowCharacterDialog(true);
                          }}
                          className="h-8 w-8 p-0 hover:bg-blue-100"
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => characterDeleteMutation.mutate(character.id)}
                          className="h-8 w-8 p-0 hover:bg-red-100"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 mb-4 line-clamp-3">
                      {character.backstory}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {character.traits.slice(0, 4).map((trait, index) => (
                        <Badge key={index} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                          {trait}
                        </Badge>
                      ))}
                      {character.traits.length > 4 && (
                        <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700 border-slate-300">
                          +{character.traits.length - 4} more
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
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
                  <p className="text-slate-500 text-center mb-4">
                    {searchTerm ? "No characters match your search criteria." : "Get started by creating your first character."}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => setShowCharacterDialog(true)} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Character
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
                <p className="text-slate-600">Monitor user activity and preferences</p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64 bg-white border-slate-300 text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUsers.map((user) => (
                <Card key={user.id} className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg text-slate-900">{user.username}</CardTitle>
                      <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">ID: {user.id}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Total Chats:</span>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {user.total_chats}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">NSFW Level:</span>
                        <Badge variant="outline" className="bg-orange-50 text-orange-700">
                          {user.nsfw_level}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Temperature:</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          {user.temperature}%
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Memory:</span>
                        <Badge variant="outline" className={user.memory_enabled ? "bg-green-100 text-green-700 border-green-300" : "bg-gray-100 text-gray-700 border-gray-300"}>
                          {user.memory_enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Joined:</span>
                        <span className="text-sm text-slate-700">
                          {new Date(user.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {filteredUsers.length === 0 && (
              <Card className="shadow-sm border-slate-200">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Globe className="w-16 h-16 text-slate-300 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">No users found</h3>
                  <p className="text-slate-500 text-center">
                    {searchTerm ? "No users match your search criteria." : "No users have registered yet."}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Analytics Dashboard</h2>
              <p className="text-slate-600">Advanced insights and metrics</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center text-slate-900">
                    <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                    Content Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-green-800">Average Chats per Scene</span>
                        <span className="text-lg font-bold text-green-600">
                          {stats?.totals.scenes > 0 ? Math.round((stats?.totals.chats || 0) / stats.totals.scenes) : 0}
                        </span>
                      </div>
                      <div className="w-full bg-green-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: '75%' }}></div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-blue-800">Average Messages per Chat</span>
                        <span className="text-lg font-bold text-blue-600">
                          {stats?.totals.chats > 0 ? Math.round((stats?.totals.messages || 0) / stats.totals.chats) : 0}
                        </span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '60%' }}></div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-purple-800">User Engagement Rate</span>
                        <span className="text-lg font-bold text-purple-600">
                          {stats?.totals.users > 0 ? Math.round(((stats?.totals.chats || 0) / stats.totals.users) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-purple-200 rounded-full h-2">
                        <div className="bg-purple-600 h-2 rounded-full" style={{ width: '85%' }}></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center text-slate-900">
                    <Activity className="w-5 h-5 mr-2 text-blue-600" />
                    System Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-sm font-medium text-green-800">API Status</span>
                      </div>
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Online</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                        <span className="text-sm font-medium text-blue-800">Database</span>
                      </div>
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Connected</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                        <span className="text-sm font-medium text-yellow-800">AI Service</span>
                      </div>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Simulated</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                        <span className="text-sm font-medium text-purple-800">Admin Panel</span>
                      </div>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">Active</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">System Management</h2>
              <p className="text-slate-600">System tools and utilities</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center text-slate-900">
                    <Upload className="w-5 h-5 mr-2 text-blue-600" />
                    Data Import/Export
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button variant="outline" className="w-full justify-start text-slate-700 border-slate-300 bg-white hover:bg-slate-50">
                      <Upload className="w-4 h-4 mr-2" />
                      Import Scenes from JSON
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-slate-700 border-slate-300 bg-white hover:bg-slate-50">
                      <Upload className="w-4 h-4 mr-2" />
                      Import Characters from JSON
                    </Button>
                    <Separator />
                    <Button variant="outline" className="w-full justify-start text-slate-700 border-slate-300 bg-white hover:bg-slate-50">
                      <Download className="w-4 h-4 mr-2" />
                      Export All Data
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-slate-700 border-slate-300 bg-white hover:bg-slate-50">
                      <Download className="w-4 h-4 mr-2" />
                      Export Analytics Report
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center text-slate-900">
                    <Database className="w-5 h-5 mr-2 text-green-600" />
                    Database Tools
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button variant="outline" className="w-full justify-start text-slate-700 border-slate-300 bg-white hover:bg-slate-50">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh All Data
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-slate-700 border-slate-300 bg-white hover:bg-slate-50">
                      <Database className="w-4 h-4 mr-2" />
                      Database Statistics
                    </Button>
                    <Separator />
                    <Alert className="border-yellow-200 bg-yellow-50">
                      <Clock className="w-4 h-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800">
                        Last backup: Never (Configure automatic backups)
                      </AlertDescription>
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const SceneForm = ({ scene, onSubmit, onCancel }: {
  scene: Scene | null;
  onSubmit: (data: Omit<Scene, "id" | "createdAt">) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState({
    name: scene?.name || "",
    description: scene?.description || "",
    imageUrl: scene?.imageUrl || "",
    location: scene?.location || "",
    mood: scene?.mood || "",
    rating: scene?.rating || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <ScrollArea className="max-h-[70vh]">
      <form onSubmit={handleSubmit} className="space-y-6 p-1">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-slate-900">Scene Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter scene name"
              className="bg-white border-slate-300 text-slate-900"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm font-medium text-slate-900">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Royal Palace, Modern Office"
              className="bg-white border-slate-300 text-slate-900"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-medium text-slate-900">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the scene setting, atmosphere, and context..."
            className="bg-white border-slate-300 text-slate-900"
            rows={4}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="imageUrl" className="text-sm font-medium text-slate-900">Image URL</Label>
          <Input
            id="imageUrl"
            value={formData.imageUrl}
            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
            placeholder="https://example.com/scene-image.jpg"
            className="bg-white border-slate-300 text-slate-900"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mood" className="text-sm font-medium text-slate-900">Mood</Label>
            <Select value={formData.mood} onValueChange={(value) => setFormData({ ...formData, mood: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select mood" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Romantic">Romantic</SelectItem>
                <SelectItem value="Mysterious">Mysterious</SelectItem>
                <SelectItem value="Adventure">Adventure</SelectItem>
                <SelectItem value="Dramatic">Dramatic</SelectItem>
                <SelectItem value="Comedy">Comedy</SelectItem>
                <SelectItem value="Serious">Serious</SelectItem>
                <SelectItem value="Fantasy">Fantasy</SelectItem>
                <SelectItem value="Sci-Fi">Sci-Fi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rating" className="text-sm font-medium text-slate-900">Content Rating</Label>
            <Select value={formData.rating} onValueChange={(value) => setFormData({ ...formData, rating: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PG">PG - General Audiences</SelectItem>
                <SelectItem value="PG-13">PG-13 - Teen Appropriate</SelectItem>
                <SelectItem value="R">R - Mature Content</SelectItem>
                <SelectItem value="NC-17">NC-17 - Adults Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} className="text-slate-700 border-slate-300 bg-white hover:bg-slate-50">
            Cancel
          </Button>
          <Button type="submit" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
            {scene ? "Update Scene" : "Create Scene"}
          </Button>
        </div>
      </form>
    </ScrollArea>
  );
};

const CharacterForm = ({ character, onSubmit, onCancel }: {
  character: Character | null;
  onSubmit: (data: Omit<Character, "id" | "createdAt">) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState({
    name: character?.name || "",
    avatarUrl: character?.avatarUrl || "",
    backstory: character?.backstory || "",
    voiceStyle: character?.voiceStyle || "",
    traits: character?.traits || [],
    personalityTraits: character?.personalityTraits || {},
  });

  const [newTrait, setNewTrait] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
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
    <ScrollArea className="max-h-[70vh]">
      <form onSubmit={handleSubmit} className="space-y-6 p-1">
        <div className="grid grid-cols-2 gap-4">
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
            <Label htmlFor="avatarUrl" className="text-sm font-medium text-slate-900">Avatar URL</Label>
            <Input
              id="avatarUrl"
              value={formData.avatarUrl}
              onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
              placeholder="https://example.com/avatar.jpg"
              className="bg-white border-slate-300 text-slate-900"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="backstory" className="text-sm font-medium text-slate-900">Backstory</Label>
          <Textarea
            id="backstory"
            value={formData.backstory}
            onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
            placeholder="Describe the character's background, history, and motivations..."
            className="bg-white border-slate-300 text-slate-900"
            rows={4}
            required
          />
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
              <span className="text-slate-400 text-sm">No traits added yet</span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} className="text-slate-700 border-slate-300 bg-white hover:bg-slate-50">
            Cancel
          </Button>
          <Button type="submit" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
            {character ? "Update Character" : "Create Character"}
          </Button>
        </div>
      </form>
    </ScrollArea>
  );
};

export default AdminPage;