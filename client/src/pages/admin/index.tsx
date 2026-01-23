import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  Activity,
  BarChart3,
  Bell,
  Database,
  Globe,
  Lock,
  RefreshCw,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import AnalyticsTab from "./tabs/AnalyticsTab";
import CharactersTab from "./tabs/CharactersTab";
import NotificationsTab from "./tabs/NotificationsTab";
import OverviewTab from "./tabs/OverviewTab";
import SystemTab from "./tabs/SystemTab";
import UsersTab from "./tabs/UsersTab";
import { ChatPreviewDialog } from "./components/ChatPreviewDialog";
import { SuspendUserDialog } from "./components/SuspendUserDialog";
import { TokenAdjustDialog } from "./components/TokenAdjustDialog";
import { UserDetailDialog } from "./components/UserDetailDialog";
import type {
  AdminChatDetail,
  AdminNotificationAnalytics,
  AdminStats,
  AdminTokenResponse,
  AdminUser,
  AdminUserDetail,
  AdminUsersResponse,
  Character,
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME || "admin";
const ADMIN_ACCESS_TOKEN_KEY = "adminAccessToken";
const ADMIN_REFRESH_TOKEN_KEY = "adminRefreshToken";
const ADMIN_TOKEN_EXPIRY_KEY = "adminAccessTokenExpiresAt";

const AdminPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [showCharacterDialog, setShowCharacterDialog] = useState(false);
  const [editingAnalytics, setEditingAnalytics] = useState<Character | null>(null);
  const [showAnalyticsDialog, setShowAnalyticsDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
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
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [promptPreviewData, setPromptPreviewData] = useState<any>(null);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [isSuspendDialogOpen, setIsSuspendDialogOpen] = useState(false);
  const [suspendTargetUser, setSuspendTargetUser] = useState<AdminUser | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [isTokenDialogOpen, setIsTokenDialogOpen] = useState(false);
  const [tokenTargetUser, setTokenTargetUser] = useState<AdminUser | null>(null);
  const [tokenAmount, setTokenAmount] = useState<string | number>("");
  const [tokenAdjustmentType, setTokenAdjustmentType] = useState<"credit" | "debit">("credit");
  const [tokenReason, setTokenReason] = useState("");
  const [isUserDetailDialogOpen, setIsUserDetailDialogOpen] = useState(false);
  const [selectedUserIdForDetail, setSelectedUserIdForDetail] = useState<number | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetail | null>(null);
  const [isUserDetailLoading, setIsUserDetailLoading] = useState(false);
  const [isChatPreviewDialogOpen, setIsChatPreviewDialogOpen] = useState(false);
  const [chatPreview, setChatPreview] = useState<AdminChatDetail | null>(null);
  const [isChatPreviewLoading, setIsChatPreviewLoading] = useState(false);

  const USER_PAGE_SIZE = 20;
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [userProviderFilter, setUserProviderFilter] = useState<string>("all");
  const [userPage, setUserPage] = useState(0);

  const queryClient = useQueryClient();
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScheduledRefresh = () => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  };

  function handleLogout(showToast = true) {
    clearScheduledRefresh();
    setIsAuthenticated(false);
    setAuthToken(null);
    setRefreshToken(null);
    setShowCharacterDialog(false);
    setEditingCharacter(null);
    setEditingAnalytics(null);
    localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
    localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
    localStorage.removeItem(ADMIN_TOKEN_EXPIRY_KEY);
    localStorage.removeItem("adminToken"); // Legacy key cleanup
    if (showToast) {
      toast({ 
        title: "Logged out", 
        description: "You have been logged out successfully",
        className: "bg-blue-600 text-white border-blue-500"
      });
    }
  }

  function scheduleTokenRefresh(expiresInSeconds: number, tokenForRefresh: string) {
    if (!expiresInSeconds || !tokenForRefresh) return;
    clearScheduledRefresh();
    const refreshDelay = Math.max((expiresInSeconds - 60) * 1000, 5000);
    refreshTimeoutRef.current = setTimeout(() => {
      refreshAdminToken(tokenForRefresh, true);
    }, refreshDelay);
  }

  function applyTokenResponse(tokenData: AdminTokenResponse) {
    setAuthToken(tokenData.access_token);
    setRefreshToken(tokenData.refresh_token);
    setIsAuthenticated(true);

    localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, tokenData.access_token);
    localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, tokenData.refresh_token);
    const expiresAt = Date.now() + tokenData.expires_in * 1000;
    localStorage.setItem(ADMIN_TOKEN_EXPIRY_KEY, expiresAt.toString());

    scheduleTokenRefresh(tokenData.expires_in, tokenData.refresh_token);
  }

  async function refreshAdminToken(providedRefreshToken?: string | null, silent = false) {
    const tokenToUse = providedRefreshToken || refreshToken;
    if (!tokenToUse) {
      toast({
        title: "Admin session expired",
        description: "Please log in again.",
        variant: "destructive",
      });
      handleLogout(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: tokenToUse }),
      });

      if (!response.ok) {
        throw new Error(`Refresh failed with status ${response.status}`);
      }

      const tokenData: AdminTokenResponse = await response.json();
      applyTokenResponse(tokenData);
      return tokenData;
    } catch (error) {
      console.error("Failed to refresh admin token:", error);
      toast({
        title: "Admin session expired",
        description: "Please log in again.",
        variant: "destructive",
      });
      handleLogout(false);
    }
  }

  async function verifyAdminToken(access: string, refreshForFallback: string | null) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/verify`, {
        headers: {
          Authorization: `Bearer ${access}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Verification failed with status ${response.status}`);
      }
    } catch (error) {
      console.warn("Admin token verification failed, attempting refresh", error);
      if (refreshForFallback) {
        await refreshAdminToken(refreshForFallback, true);
      } else {
        handleLogout(false);
      }
    }
  }

  useEffect(() => {
    const storedAccess = localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
    const storedRefresh = localStorage.getItem(ADMIN_REFRESH_TOKEN_KEY);
    const storedExpiry = localStorage.getItem(ADMIN_TOKEN_EXPIRY_KEY);

    if (storedAccess && storedRefresh) {
      setAuthToken(storedAccess);
      setRefreshToken(storedRefresh);
      setIsAuthenticated(true);

      const expiresAt = storedExpiry ? parseInt(storedExpiry, 10) : NaN;
      if (!Number.isNaN(expiresAt)) {
        const msRemaining = expiresAt - Date.now();
        if (msRemaining <= 60_000) {
          refreshAdminToken(storedRefresh, true);
        } else {
          scheduleTokenRefresh(Math.floor(msRemaining / 1000), storedRefresh);
        }
      }

      verifyAdminToken(storedAccess, storedRefresh);
    } else {
      // Remove legacy admin token if present to avoid confusion
      if (localStorage.getItem("adminToken")) {
        localStorage.removeItem("adminToken");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      clearScheduledRefresh();
    };
  }, []);

  const authHeaders = useMemo(() => (
    authToken ? { Authorization: `Bearer ${authToken}` } : {}
  ), [authToken]);

  const loginMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/login-jwt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: ADMIN_USERNAME, password }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Invalid credentials");
      }
      const data = await response.json();
      return data as AdminTokenResponse & { admin_user?: Record<string, unknown> };
    },
    onSuccess: (data) => {
      applyTokenResponse(data);
      setLoginPassword("");
      toast({ 
        title: "✅ Login successful", 
        description: "Welcome to YY Chat Admin Panel",
        className: "bg-green-600 text-white border-green-500"
      });
    },
    onError: (error: any) => {
      console.error("Admin login failed", error);
      toast({
        title: "❌ Login failed",
        description: error?.message || "Invalid password. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogin = () => {
    if (loginPassword && !loginMutation.isPending) {
      loginMutation.mutate(loginPassword);
    }
  };

  useEffect(() => {
    setUserPage(0);
  }, [userSearchTerm, userStatusFilter, userProviderFilter]);

  useEffect(() => {
    if (!isUserDetailDialogOpen || selectedUserIdForDetail === null) {
      return;
    }

    const controller = new AbortController();

    const loadUserDetail = async () => {
      setIsUserDetailLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users/${selectedUserIdForDetail}`, {
          headers: authHeaders,
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error("Failed to fetch user detail");
        }
        const detail = await response.json();
        setSelectedUserDetail(detail);
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.error("Failed to load user detail", error);
          toast({
            title: "Unable to load user details",
            description: error?.message || 'Please try again later.',
            variant: "destructive",
          });
        }
      } finally {
        setIsUserDetailLoading(false);
      }
    };

    loadUserDetail();

    return () => {
      controller.abort();
    };
  }, [isUserDetailDialogOpen, selectedUserIdForDetail, authHeaders]);

  const { data: stats, refetch: refetchStats } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/admin/stats`, {
        headers: authHeaders,
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });


  const { data: characters = [], refetch: refetchCharacters } = useQuery<Character[]>({
    queryKey: ["admin-characters", showDeleted],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/admin/characters?include_deleted=${showDeleted ? 'true' : 'false'}` , {
        headers: authHeaders,
      });
      if (!response.ok) throw new Error("Failed to fetch characters");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: usersResponse, refetch: refetchUsers, isFetching: isFetchingUsers } = useQuery<AdminUsersResponse>({
    queryKey: [
      "admin-users",
      userSearchTerm,
      userStatusFilter,
      userProviderFilter,
      userPage,
      authToken
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: USER_PAGE_SIZE.toString(),
        offset: (userPage * USER_PAGE_SIZE).toString(),
      });

      if (userSearchTerm.trim().length > 0) {
        params.append("search", userSearchTerm.trim());
      }

      if (userStatusFilter !== "all") {
        params.append("status", userStatusFilter);
      }

      if (userProviderFilter !== "all") {
        params.append("provider", userProviderFilter);
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/users?${params.toString()}`, {
        headers: authHeaders,
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
    enabled: isAuthenticated && !!authToken,
    keepPreviousData: true,
  });

  const users = usersResponse?.data ?? [];
  const usersMeta = usersResponse?.meta;
  const totalUsers = usersMeta?.total ?? 0;
  const totalUserPages = Math.max(1, Math.ceil(totalUsers / USER_PAGE_SIZE));
  const userRangeStart = totalUsers === 0 ? 0 : userPage * USER_PAGE_SIZE + 1;
  const userRangeEnd = totalUsers === 0 ? 0 : Math.min(totalUsers, (userPage + 1) * USER_PAGE_SIZE);




  const characterUpdateMutation = useMutation({
    mutationFn: async ({ id, ...characterData }: Character) => {
      const response = await fetch(`${API_BASE_URL}/api/admin/characters/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(characterData),
      });
      if (!response.ok) throw new Error("Failed to update character");
      const result = await response.json();
      return result;
    },
    onSuccess: (updatedCharacter) => {
      
      // Clear all related caches first
      queryClient.removeQueries({ queryKey: ["admin-characters"] });
      
      // Force a fresh refetch
      queryClient.invalidateQueries({ queryKey: ["admin-characters"] });
      queryClient.refetchQueries({ queryKey: ["admin-characters"] });
      
      toast({ 
        title: "✅ Character updated successfully",
        className: "bg-green-600 text-white border-green-500"
      });
      setEditingCharacter(null);
      setShowCharacterDialog(false);
    },
  });

  const characterDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`${API_BASE_URL}/api/admin/characters/${id}`, {
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
        className: "bg-green-600 text-white border-green-500"
      });
    },
  });

  // Toggle featured status mutation
  const toggleFeaturedMutation = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await fetch(`${API_BASE_URL}/api/admin/characters/${characterId}/toggle-featured`, {
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

  const analyticsUpdateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`${API_BASE_URL}/api/admin/characters/${id}/admin-settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update analytics");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-characters"] });
      toast({ 
        title: "✅ Analytics data updated successfully",
        className: "border-green-200 bg-green-50"
      });
      setEditingAnalytics(null);
      setShowAnalyticsDialog(false);
    },
  });

  const suspendUserMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: number; reason?: string }) => {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/suspend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error("Failed to suspend user");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ 
        title: "User suspended",
        description: data?.message || "The user can no longer log in.",
        className: "bg-red-600 text-white border-red-500"
      });
      setSuspendTargetUser(null);
      setIsSuspendDialogOpen(false);
      setSuspendReason("");
      if (selectedUserDetail && data?.user?.id === selectedUserDetail.id) {
        setSelectedUserDetail(prev => prev ? { ...prev, ...data.user } : prev);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to suspend user",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  });

  const unsuspendUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/unsuspend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
      });
      if (!response.ok) throw new Error("Failed to unsuspend user");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ 
        title: "User unsuspended",
        description: data?.message || "The user can now log in.",
        className: "border-green-200 bg-green-50"
      });
      if (selectedUserDetail && data?.user?.id === selectedUserDetail.id) {
        setSelectedUserDetail(prev => prev ? { ...prev, ...data.user } : prev);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to unsuspend user",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  });

  const adjustTokensMutation = useMutation({
    mutationFn: async ({ userId, amount, reason }: { userId: number; amount: number; reason?: string }) => {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ amount, reason }),
      });
      if (!response.ok) throw new Error(await response.text() || "Failed to adjust tokens");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ 
        title: "Token balance updated",
        description: data?.message || "Token balance adjusted successfully.",
        className: "border-blue-200 bg-blue-50"
      });
      if (tokenTargetUser && data?.user?.id === tokenTargetUser.id) {
        setTokenTargetUser(prev => prev ? { ...prev, ...data.user } : prev);
      }
      setTokenTargetUser(null);
      setTokenAmount("");
      setTokenAdjustmentType("credit");
      setTokenReason("");
      setIsTokenDialogOpen(false);
      if (selectedUserDetail && data?.user?.id === selectedUserDetail.id) {
        setSelectedUserDetail(prev => prev ? { ...prev, ...data.user } : prev);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update tokens",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  });

  const openSuspendDialog = (user: AdminUser) => {
    setSuspendTargetUser(user);
    setSuspendReason(user.suspension_reason || "");
    setIsSuspendDialogOpen(true);
  };

  const handleSuspendSubmit = () => {
    if (!suspendTargetUser) return;
    suspendUserMutation.mutate({
      userId: suspendTargetUser.id,
      reason: suspendReason.trim() || undefined,
    });
  };

  const openTokenDialog = (user: AdminUser) => {
    setTokenTargetUser(user);
    setTokenAmount("");
    setTokenAdjustmentType("credit");
    setTokenReason("");
    setIsTokenDialogOpen(true);
  };

  const handleTokenAdjustSubmit = () => {
    if (!tokenTargetUser) return;
    const parsedAmount = Number(tokenAmount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: "Enter a valid amount",
        description: "Amount must be a positive number.",
        variant: "destructive",
      });
      return;
    }
    adjustTokensMutation.mutate({
      userId: tokenTargetUser.id,
      amount: tokenAdjustmentType === "credit" ? parsedAmount : -parsedAmount,
      reason: tokenReason.trim() || undefined,
    });
  };

  const handleViewUserDetail = (userId: number) => {
    setSelectedUserIdForDetail(userId);
    setSelectedUserDetail(null);
    setIsUserDetailDialogOpen(true);
  };

  const openChatPreview = async (chat: {
    id: number;
    uuid?: string | null;
    title: string;
    character_id: number;
    character_name?: string | null;
  }) => {
    if (!selectedUserDetail) return;

    setChatPreview(null);
    setIsChatPreviewLoading(true);
    setIsChatPreviewDialogOpen(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${selectedUserDetail.id}/chats/${chat.id}`, {
        headers: authHeaders,
      });
      if (!response.ok) {
        throw new Error(await response.text() || "Failed to load chat");
      }
      const detail: AdminChatDetail = await response.json();
      setChatPreview(detail);
    } catch (error: any) {
      setChatPreview(null);
      toast({
        title: "Unable to load chat history",
        description: error?.message || "Please try again later.",
        variant: "destructive",
      });
      setIsChatPreviewDialogOpen(false);
    } finally {
      setIsChatPreviewLoading(false);
    }
  };

  const filteredCharacters = characters.filter(character => {
    const matchesSearch = character.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      character.backstory.toLowerCase().includes(searchTerm.toLowerCase());

    if (categoryFilter === "all") {
      return matchesSearch;
    } else if (categoryFilter === "uncategorized") {
      return matchesSearch && (!character.categories || character.categories.length === 0);
    } else {
      return matchesSearch && character.categories && character.categories.includes(categoryFilter);
    }
  });

  const {
    data: notificationAnalytics,
    isLoading: notificationAnalyticsLoading,
    refetch: refetchNotificationAnalytics
  } = useQuery<AdminNotificationAnalytics>({
    queryKey: ["admin-notification-analytics"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/notifications/admin/analytics`, {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        }
      });
      if (!response.ok) {
        throw new Error(await response.text() || "Failed to load notification analytics");
      }
      const data = await response.json();
      return {
        totalNotifications: data.total_notifications ?? 0,
        totalAdminNotifications: data.total_admin_notifications ?? 0,
        adminLast7Days: data.admin_last_7_days ?? 0,
        activeUsers: data.active_users ?? 0,
        recentBatches: (data.recent_batches || []).map((batch: any) => ({
          batchId: batch.batch_id,
          title: batch.title,
          content: batch.content,
          type: batch.type,
          priority: batch.priority,
          targetScope: batch.target_scope,
          targetCount: batch.target_count,
          deliveredCount: batch.delivered_count,
          readCount: batch.read_count,
          createdAt: batch.created_at
        }))
      };
    },
    enabled: isAuthenticated && !!authToken,
    staleTime: 60000
  });

  const formatMetric = (value?: number) =>
    typeof value === "number" && !Number.isNaN(value) ? value.toLocaleString() : "---";

  const notificationRecentBatches = notificationAnalytics?.recentBatches || [];

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-700 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "normal":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

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
      const targetAll = notificationData.target === "all";
      const payload = {
        title: notificationData.title,
        content: notificationData.content,
        type: notificationData.type,
        priority: notificationData.priority,
        ...(targetAll ? {} : { user_ids: notificationData.userIds })
      };

      const response = await fetch(`${API_BASE_URL}/api/notifications/admin/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(payload),
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
      refetchNotificationAnalytics();
    },
    onError: (error) => {
      toast({
        title: "❌ Failed to send notification",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleShowDeletedChange = (checked: boolean) => {
    setShowDeleted(checked);
    queryClient.invalidateQueries({ queryKey: ["admin-characters"] });
  };

  const handleCreateCharacter = () => {
    setEditingCharacter(null);
    setShowCharacterDialog(true);
  };

  const handleEditCharacter = (character: Character) => {
    setEditingCharacter(character);
    setShowCharacterDialog(true);
  };

  const handleCharacterCancel = () => {
    setShowCharacterDialog(false);
    setEditingCharacter(null);
  };

  const handlePromptPreview = (previewData: any) => {
    setPromptPreviewData(previewData);
    setShowPromptPreview(true);
  };

  const handleCharacterSubmit = async (data: Omit<Character, "id" | "createdAt">, pendingImages?: File[]) => {
    if (editingCharacter) {
      characterUpdateMutation.mutate({ ...data, id: editingCharacter.id, createdAt: editingCharacter.createdAt });
      return;
    }

    setIsCreatingCharacter(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/characters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create character");
      const createdCharacter = await response.json();

      if (pendingImages && pendingImages.length > 0) {
        for (const image of pendingImages) {
          const formData = new FormData();
          formData.append("file", image);
          formData.append("category", "general");
          formData.append("is_primary", "false");
          const uploadResponse = await fetch(`${API_BASE_URL}/api/admin/characters/${createdCharacter.id}/gallery/images`, {
            method: "POST",
            headers: authHeaders,
            body: formData,
          });
          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Gallery upload failed: ${errorText}`);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["admin-characters"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      setShowCharacterDialog(false);
      toast({ title: "✅ Character created" });
    } catch (error: any) {
      toast({ title: "Creation failed", description: error?.message || "Please try again", variant: "destructive" });
    } finally {
      setIsCreatingCharacter(false);
    }
  };

  const isCharacterSubmitting = isCreatingCharacter || characterUpdateMutation.isPending;

  const handleUpdateAnalytics = () => {
    if (!editingAnalytics) return;
    analyticsUpdateMutation.mutate({
      id: editingAnalytics.id,
      data: {
        viewCount: editingAnalytics.viewCount,
        chatCount: editingAnalytics.chatCount,
        likeCount: editingAnalytics.likeCount,
        trendingScore: editingAnalytics.trendingScore,
      }
    });
  };

  const handleToggleFeatured = (id: number) => {
    toggleFeaturedMutation.mutate(id);
  };

  const handleDeleteCharacter = (id: number) => {
    characterDeleteMutation.mutate(id);
  };

  const handleRestoreCharacter = async (id: number) => {
    const res = await fetch(`${API_BASE_URL}/api/admin/characters/${id}/restore`, { method: "POST", headers: authHeaders });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["admin-characters"] });
      toast({ title: "✅ Character restored", className: "bg-green-600 text-white border-green-500" });
    } else {
      toast({ title: "Restore failed", variant: "destructive" });
    }
  };

  const handleHardDeleteCharacter = async (id: number) => {
    const ok = window.confirm("This will permanently delete this character and its files. This action cannot be undone. Continue?");
    if (!ok) return;
    const res = await fetch(`${API_BASE_URL}/api/admin/characters/${id}?force=true`, { method: "DELETE", headers: authHeaders });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["admin-characters"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({ title: "🗑️ Character hard-deleted", className: "bg-red-600 text-white border-red-500" });
    } else {
      const text = await res.text();
      toast({ title: "Hard delete failed", description: text, variant: "destructive" });
    }
  };

  const openNotificationDialogFromUsers = () => {
    setNotificationForm({
      title: "",
      content: "",
      type: "admin",
      priority: "normal",
      target: "all",
      userIds: [],
    });
    setShowNotificationDialog(true);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <Card className="w-full max-w-md shadow-2xl border border-slate-200 bg-white">
          <CardHeader className="text-center pb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              YY Chat Admin
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
                <h1 className="text-2xl font-bold text-slate-900">YY Chat Admin</h1>
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
            <OverviewTab stats={stats} />
          </TabsContent>


          <TabsContent value="characters" className="space-y-6">
            <CharactersTab
              apiBaseUrl={API_BASE_URL}
              authHeaders={authHeaders}
              characters={characters}
              filteredCharacters={filteredCharacters}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              showDeleted={showDeleted}
              onShowDeletedChange={handleShowDeletedChange}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              showCharacterDialog={showCharacterDialog}
              onShowCharacterDialogChange={setShowCharacterDialog}
              editingCharacter={editingCharacter}
              onEditCharacter={handleEditCharacter}
              onCreateCharacter={handleCreateCharacter}
              isCharacterSubmitting={isCharacterSubmitting}
              onCharacterSubmit={handleCharacterSubmit}
              onCharacterCancel={handleCharacterCancel}
              showAnalyticsDialog={showAnalyticsDialog}
              onShowAnalyticsDialogChange={setShowAnalyticsDialog}
              editingAnalytics={editingAnalytics}
              onEditingAnalyticsChange={setEditingAnalytics}
              onUpdateAnalytics={handleUpdateAnalytics}
              isUpdatingAnalytics={analyticsUpdateMutation.isPending}
              showPromptPreview={showPromptPreview}
              onShowPromptPreviewChange={setShowPromptPreview}
              promptPreviewData={promptPreviewData}
              onPromptPreview={handlePromptPreview}
              onToggleFeatured={handleToggleFeatured}
              onDeleteCharacter={handleDeleteCharacter}
              onRestoreCharacter={handleRestoreCharacter}
              onHardDeleteCharacter={handleHardDeleteCharacter}
            />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <UsersTab
              users={users}
              isFetchingUsers={isFetchingUsers}
              onRefreshUsers={refetchUsers}
              onOpenNotificationDialog={openNotificationDialogFromUsers}
              userSearchTerm={userSearchTerm}
              onUserSearchTermChange={setUserSearchTerm}
              userStatusFilter={userStatusFilter}
              onUserStatusFilterChange={setUserStatusFilter}
              userProviderFilter={userProviderFilter}
              onUserProviderFilterChange={setUserProviderFilter}
              onOpenTokenDialog={openTokenDialog}
              onOpenSuspendDialog={openSuspendDialog}
              onViewUserDetail={handleViewUserDetail}
              onUnsuspendUser={(userId) => unsuspendUserMutation.mutate(userId)}
              isUnsuspending={unsuspendUserMutation.isPending}
              isSuspending={suspendUserMutation.isPending}
              suspendTargetUserId={suspendTargetUser?.id ?? null}
              userPage={userPage}
              totalUsers={totalUsers}
              userRangeStart={userRangeStart}
              userRangeEnd={userRangeEnd}
              totalUserPages={totalUserPages}
              onPageChange={(nextPage) => setUserPage(nextPage)}
            />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsTab characters={characters} stats={stats} />
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <NotificationsTab
              notificationForm={notificationForm}
              onNotificationFormChange={setNotificationForm}
              showNotificationDialog={showNotificationDialog}
              onShowNotificationDialogChange={setShowNotificationDialog}
              users={users}
              onSendNotification={() => sendNotificationMutation.mutate(notificationForm)}
              isSendingNotification={sendNotificationMutation.isPending}
              notificationAnalytics={notificationAnalytics}
              notificationAnalyticsLoading={notificationAnalyticsLoading}
              notificationRecentBatches={notificationRecentBatches}
              formatMetric={formatMetric}
              getPriorityBadgeClass={getPriorityBadgeClass}
              totalUsers={totalUsers}
              onRefreshNotificationAnalytics={refetchNotificationAnalytics}
            />
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <SystemTab />
          </TabsContent>

          <SuspendUserDialog
            open={isSuspendDialogOpen}
            onOpenChange={(open) => {
              setIsSuspendDialogOpen(open);
              if (!open) {
                setSuspendTargetUser(null);
                setSuspendReason("");
              }
            }}
            targetUser={suspendTargetUser}
            suspendReason={suspendReason}
            onSuspendReasonChange={setSuspendReason}
            onCancel={() => {
              setIsSuspendDialogOpen(false);
              setSuspendTargetUser(null);
              setSuspendReason("");
            }}
            onConfirm={handleSuspendSubmit}
            isPending={suspendUserMutation.isPending}
          />

          <TokenAdjustDialog
            open={isTokenDialogOpen}
            onOpenChange={(open) => {
              setIsTokenDialogOpen(open);
              if (!open) {
                setTokenTargetUser(null);
                setTokenAmount(0);
                setTokenReason("");
              }
            }}
            targetUser={tokenTargetUser}
            tokenAmount={tokenAmount}
            onTokenAmountChange={(value) => setTokenAmount(value)}
            tokenAdjustmentType={tokenAdjustmentType}
            onTokenAdjustmentTypeChange={setTokenAdjustmentType}
            tokenReason={tokenReason}
            onTokenReasonChange={setTokenReason}
            onCancel={() => {
              setIsTokenDialogOpen(false);
              setTokenTargetUser(null);
              setTokenAmount("");
              setTokenAdjustmentType("credit");
              setTokenReason("");
            }}
            onConfirm={handleTokenAdjustSubmit}
            isPending={adjustTokensMutation.isPending}
          />

          <UserDetailDialog
            open={isUserDetailDialogOpen}
            onOpenChange={(open) => {
              setIsUserDetailDialogOpen(open);
              if (!open) {
                setSelectedUserIdForDetail(null);
                setSelectedUserDetail(null);
                setIsChatPreviewDialogOpen(false);
                setChatPreview(null);
                setIsChatPreviewLoading(false);
              }
            }}
            isLoading={isUserDetailLoading}
            userDetail={selectedUserDetail}
            onOpenChatPreview={openChatPreview}
          />

          <ChatPreviewDialog
            open={isChatPreviewDialogOpen}
            onOpenChange={(open) => {
              setIsChatPreviewDialogOpen(open);
              if (!open) {
                setChatPreview(null);
                setIsChatPreviewLoading(false);
              }
            }}
            isLoading={isChatPreviewLoading}
            chatPreview={chatPreview}
          />

        </Tabs>
      </div>
    </div>
  );
};

export default AdminPage;
