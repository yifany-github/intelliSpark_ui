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
import { ImageSelector } from "@/components/admin/ImageSelector";
import CategorySelector from "@/components/characters/CategorySelector";
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
  Crown,
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
  Target,
  Bell,
  Send
} from "lucide-react";

interface AdminStats {
  totals: {
    users: number;
    characters: number;
    chats: number;
    messages: number;
  };
  recent_activity: {
    chats_last_30_days: number;
  };
  popular_content: {
    characters: { name: string; chat_count: number }[];
  };
}


interface Character {
  id: number;
  name: string;
  avatarUrl: string;
  backstory: string;
  voiceStyle: string;
  traits: string[];
  personalityTraits: { [key: string]: number };
  category?: string;
  categories?: string[];  // 新增：多分类标签
  createdAt: string;
  // Admin management fields
  isFeatured?: boolean;
  viewCount?: number;
  likeCount?: number;
  chatCount?: number;
  trendingScore?: number;
  lastActivity?: string;
}

interface User {
  id: number;
  username: string;
  memory_enabled: boolean;
  created_at: string;
  total_chats: number;
}

const AdminPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [showCharacterDialog, setShowCharacterDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    title: "",
    content: "",
    type: "admin",
    priority: "normal",
    target: "all",
    userIds: [] as number[]
  });

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
      console.log('Updating character with data:', characterData);
      const response = await fetch(`/api/admin/characters/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(characterData),
      });
      if (!response.ok) throw new Error("Failed to update character");
      const result = await response.json();
      console.log('Update response:', result);
      return result;
    },
    onSuccess: (updatedCharacter) => {
      console.log('Character update successful:', updatedCharacter);
      
      // Clear all related caches first
      queryClient.removeQueries({ queryKey: ["admin-characters"] });
      
      // Force a fresh refetch
      queryClient.invalidateQueries({ queryKey: ["admin-characters"] });
      queryClient.refetchQueries({ queryKey: ["admin-characters"] });
      
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

  // Toggle featured status mutation
  const toggleFeaturedMutation = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await fetch(`/api/admin/characters/${characterId}/toggle-featured`, {
        method: "POST",
        headers: authHeaders,
      });
      if (!response.ok) throw new Error("Failed to toggle featured status");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-characters"] });
      toast({ 
        title: `✅ Character ${data.isFeatured ? 'added to' : 'removed from'} Editor's Choice`,
        className: "border-green-200 bg-green-50"
      });
    },
  });

  const filteredCharacters = characters.filter(character => {
    // 文本搜索
    const matchesSearch = character.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      character.backstory.toLowerCase().includes(searchTerm.toLowerCase());

    // 分类过滤
    if (categoryFilter === "all") {
      return matchesSearch;
    } else if (categoryFilter === "uncategorized") {
      return matchesSearch && (!character.categories || character.categories.length === 0);
    } else {
      return matchesSearch && character.categories && character.categories.includes(categoryFilter);
    }
  });

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Notification mutations
  const sendNotificationMutation = useMutation({
    mutationFn: async (notificationData: {
      title: string;
      content: string;
      type: string;
      priority: string;
      target: string;
      userIds?: number[];
    }) => {
      const endpoint = notificationData.target === "all" ? "bulk" : "";
      const response = await fetch(`/api/notifications/admin/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(notificationData.target === "all" ? {
          template_name: "admin_message",
          variables: {
            title: notificationData.title,
            content: notificationData.content
          },
          type: notificationData.type,
          priority: notificationData.priority
        } : {
          title: notificationData.title,
          content: notificationData.content,
          type: notificationData.type,
          priority: notificationData.priority,
          user_ids: notificationData.userIds
        }),
      });
      if (!response.ok) throw new Error("Failed to send notification");
      return response.json();
    },
    onSuccess: () => {
      toast({ 
        title: "✅ Notification sent successfully",
        description: "Your notification has been delivered to the selected users",
        className: "border-green-200 bg-green-50"
      });
      setShowNotificationDialog(false);
      setNotificationForm({
        title: "",
        content: "",
        type: "admin",
        priority: "normal",
        target: "all",
        userIds: []
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Failed to send notification",
        description: error.message,
        variant: "destructive",
      });
    }
  });

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
    <div className="admin-theme min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
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
            <TabsTrigger value="characters" className="text-slate-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" />
              Characters
            </TabsTrigger>
            <TabsTrigger value="users" className="text-slate-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white">
              <Globe className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-slate-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

            {/* Popular Content */}
            <div className="grid grid-cols-1 gap-6">
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
                      <p className="text-gray-500 text-center py-4">No data available yet</p>
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
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-48 bg-white border-slate-300 text-slate-900">
                    <div className="flex items-center">
                      <Filter className="w-4 h-4 mr-2 text-slate-400" />
                      <SelectValue placeholder="筛选分类" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部分类</SelectItem>
                    <SelectItem value="uncategorized">未分类</SelectItem>
                    {(() => {
                      // 获取所有唯一的分类标签
                      const allCategories = new Set<string>();
                      characters.forEach(character => {
                        if (character.categories) {
                          character.categories.forEach(category => allCategories.add(category));
                        }
                      });
                      return Array.from(allCategories).sort().map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
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
              {filteredCharacters.map((character) => {
                // Debug logging
                console.log('Rendering character:', character.name, 'with avatar:', character.avatarUrl);
                return (
                <Card key={character.id} className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                          {character.avatarUrl ? (
                            <img
                              key={`${character.id}-${character.avatarUrl}-${Date.now()}`}
                              src={`${character.avatarUrl}?v=${Date.now()}`}
                              alt={character.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                console.error('Image failed to load:', character.avatarUrl);
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.nextElementSibling?.classList.remove('hidden');
                              }}
                              onLoad={() => {
                                console.log('Image loaded successfully:', character.avatarUrl);
                              }}
                            />
                          ) : null}
                          <div className={`${character.avatarUrl ? 'hidden' : ''} w-full h-full flex items-center justify-center bg-slate-200`}>
                            <Users className="w-6 h-6 text-slate-400" />
                          </div>
                        </div>
                        <CardTitle className="text-lg text-slate-900">{character.name}</CardTitle>
                      </div>
                      <div className="flex gap-1">
                        {/* Featured Status Toggle */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleFeaturedMutation.mutate(character.id)}
                          className={`h-8 w-8 p-0 ${character.isFeatured ? 'bg-amber-100 hover:bg-amber-200' : 'hover:bg-gray-100'}`}
                          title={character.isFeatured ? "Remove from Editor's Choice" : "Add to Editor's Choice"}
                        >
                          <Crown className={`w-4 h-4 ${character.isFeatured ? 'text-amber-600' : 'text-gray-400'}`} />
                        </Button>
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
                );
              })}
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
                        <span className="text-sm text-gray-600">Total Chats:</span>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {user.total_chats}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Memory:</span>
                        <Badge variant="outline" className={user.memory_enabled ? "bg-green-100 text-green-700 border-green-300" : "bg-gray-100 text-gray-700 border-gray-300"}>
                          {user.memory_enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Joined:</span>
                        <span className="text-sm text-gray-700">
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
                  <p className="text-gray-500 text-center">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 分类标签统计 */}
              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center text-slate-900">
                    <Target className="w-5 h-5 mr-2 text-purple-600" />
                    分类标签分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(() => {
                      // 计算分类标签分布
                      const categoryCount: { [key: string]: number } = {};
                      characters.forEach(character => {
                        if (character.categories && character.categories.length > 0) {
                          character.categories.forEach(category => {
                            categoryCount[category] = (categoryCount[category] || 0) + 1;
                          });
                        } else {
                          categoryCount['未分类'] = (categoryCount['未分类'] || 0) + 1;
                        }
                      });

                      const sortedCategories = Object.entries(categoryCount)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 6);

                      return sortedCategories.map(([category, count]) => (
                        <div key={category} className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                          <span className="text-sm font-medium text-purple-800">{category}</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-purple-200 rounded-full h-2">
                              <div 
                                className="bg-purple-600 h-2 rounded-full" 
                                style={{ width: `${Math.max(count / Math.max(...Object.values(categoryCount)) * 100, 10)}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold text-purple-600">{count}</span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </CardContent>
              </Card>
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
                    
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-blue-800">Average Messages per Chat</span>
                        <span className="text-lg font-bold text-blue-600">
                          {stats?.totals?.chats && stats.totals.chats > 0 ? Math.round((stats?.totals?.messages || 0) / stats.totals.chats) : 0}
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
                          {stats?.totals?.users && stats.totals.users > 0 ? Math.round(((stats?.totals?.chats || 0) / stats.totals.users) * 100) : 0}%
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

          <TabsContent value="notifications" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Notification Management</h2>
                <p className="text-slate-600">Send notifications to users and manage communication</p>
              </div>
              <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                    <Send className="w-4 h-4 mr-2" />
                    Send Notification
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl text-slate-900">Send Notification</DialogTitle>
                  </DialogHeader>
                  <NotificationForm
                    form={notificationForm}
                    setForm={setNotificationForm}
                    users={users}
                    onSubmit={() => sendNotificationMutation.mutate(notificationForm)}
                    onCancel={() => setShowNotificationDialog(false)}
                    isLoading={sendNotificationMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {/* Notification Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-900">Total Notifications</CardTitle>
                  <Bell className="w-4 h-4 text-slate-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">---</div>
                  <p className="text-xs text-slate-600">All time notifications sent</p>
                </CardContent>
              </Card>
              
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-900">Active Users</CardTitle>
                  <Users className="w-4 h-4 text-slate-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{users.length}</div>
                  <p className="text-xs text-slate-600">Users who can receive notifications</p>
                </CardContent>
              </Card>
              
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-900">Recent Activity</CardTitle>
                  <Activity className="w-4 h-4 text-slate-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">---</div>
                  <p className="text-xs text-slate-600">Notifications sent this week</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center text-slate-900">
                    <Send className="w-5 h-5 mr-2 text-blue-600" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-slate-700 border-slate-300 bg-white hover:bg-slate-50"
                      onClick={() => {
                        setNotificationForm({
                          title: "Welcome to ProductInsightAI",
                          content: "Thank you for joining our AI role-playing community. Start exploring characters to begin your journey!",
                          type: "admin",
                          priority: "normal",
                          target: "all",
                          userIds: []
                        });
                        setShowNotificationDialog(true);
                      }}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Send Welcome Message
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-slate-700 border-slate-300 bg-white hover:bg-slate-50"
                      onClick={() => {
                        setNotificationForm({
                          title: "System Maintenance Notice",
                          content: "We will be performing scheduled maintenance tonight from 2:00 AM to 4:00 AM. Please save your progress.",
                          type: "system",
                          priority: "high",
                          target: "all",
                          userIds: []
                        });
                        setShowNotificationDialog(true);
                      }}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Maintenance Notice
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-slate-700 border-slate-300 bg-white hover:bg-slate-50"
                      onClick={() => {
                        setNotificationForm({
                          title: "New Feature Available",
                          content: "Discover our new character creation feature! Create your own AI personas and share them with the community.",
                          type: "admin",
                          priority: "normal",
                          target: "all",
                          userIds: []
                        });
                        setShowNotificationDialog(true);
                      }}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Feature Announcement
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center text-slate-900">
                    <Target className="w-5 h-5 mr-2 text-green-600" />
                    Notification Tips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <div>
                        <p className="font-medium text-gray-700">Keep it concise</p>
                        <p>Short, clear messages are more effective than long explanations.</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <div>
                        <p className="font-medium text-gray-700">Use appropriate priority</p>
                        <p>Set high priority only for urgent system-wide issues.</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <div>
                        <p className="font-medium text-gray-700">Target your audience</p>
                        <p>Send specific notifications to relevant user groups when possible.</p>
                      </div>
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
    category: character?.category || "original",
    categories: character?.categories || [],  // 新增：多分类标签
  });

  const [newTrait, setNewTrait] = useState("");

  // Reset form data when character changes
  useEffect(() => {
    setFormData({
      name: character?.name || "",
      avatarUrl: character?.avatarUrl || "",
      backstory: character?.backstory || "",
      voiceStyle: character?.voiceStyle || "",
      traits: character?.traits || [],
      personalityTraits: character?.personalityTraits || {},
      category: character?.category || "original",
      categories: character?.categories || [],
    });
  }, [character]);

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
          
          <ImageSelector
            value={formData.avatarUrl}
            onChange={(url) => setFormData({ ...formData, avatarUrl: url })}
            assetType="characters"
            label="Character Avatar"
            required
          />
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

const NotificationForm = ({ form, setForm, users, onSubmit, onCancel, isLoading }: {
  form: {
    title: string;
    content: string;
    type: string;
    priority: string;
    target: string;
    userIds: number[];
  };
  setForm: (form: any) => void;
  users: User[];
  onSubmit: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const handleUserToggle = (userId: number, checked: boolean) => {
    if (checked) {
      setForm({ ...form, userIds: [...form.userIds, userId] });
    } else {
      setForm({ ...form, userIds: form.userIds.filter(id => id !== userId) });
    }
  };

  return (
    <ScrollArea className="max-h-[70vh]">
      <form onSubmit={handleSubmit} className="space-y-6 p-1">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium text-slate-900">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Enter notification title"
              className="bg-white border-slate-300 text-slate-900"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type" className="text-sm font-medium text-slate-900">Type</Label>
            <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
              <SelectTrigger className="bg-white border-slate-300 text-slate-900">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="announcement">Announcement</SelectItem>
                <SelectItem value="achievement">Achievement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="content" className="text-sm font-medium text-slate-900">Message Content</Label>
          <Textarea
            id="content"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Enter your notification message..."
            className="bg-white border-slate-300 text-slate-900"
            rows={4}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="priority" className="text-sm font-medium text-slate-900">Priority</Label>
            <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}>
              <SelectTrigger className="bg-white border-slate-300 text-slate-900">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="target" className="text-sm font-medium text-slate-900">Target Audience</Label>
            <Select value={form.target} onValueChange={(value) => setForm({ ...form, target: value, userIds: [] })}>
              <SelectTrigger className="bg-white border-slate-300 text-slate-900">
                <SelectValue placeholder="Select target" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="specific">Specific Users</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {form.target === "specific" && (
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-900">Select Users</Label>
            <div className="max-h-48 overflow-y-auto border border-slate-300 rounded-lg p-3 bg-slate-50">
              {users.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No users available</p>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={form.userIds.includes(user.id)}
                        onCheckedChange={(checked) => handleUserToggle(user.id, checked as boolean)}
                      />
                      <Label
                        htmlFor={`user-${user.id}`}
                        className="text-sm text-gray-700 cursor-pointer flex-1"
                      >
                        {user.username} (ID: {user.id})
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {form.target === "specific" && (
              <p className="text-xs text-gray-600">
                {form.userIds.length} user(s) selected
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-700 border-slate-300 bg-white hover:bg-slate-50"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading || (form.target === "specific" && form.userIds.length === 0)}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Notification
              </>
            )}
          </Button>
        </div>
      </form>
    </ScrollArea>
  );
};

export default AdminPage;