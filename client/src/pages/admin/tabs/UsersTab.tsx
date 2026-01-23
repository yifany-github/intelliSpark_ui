import {
  DollarSign,
  Eye,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Send,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminUser } from "../types";

const UsersTab = ({
  users,
  isFetchingUsers,
  onRefreshUsers,
  onOpenNotificationDialog,
  userSearchTerm,
  onUserSearchTermChange,
  userStatusFilter,
  onUserStatusFilterChange,
  userProviderFilter,
  onUserProviderFilterChange,
  onOpenTokenDialog,
  onOpenSuspendDialog,
  onViewUserDetail,
  onUnsuspendUser,
  isUnsuspending,
  isSuspending,
  suspendTargetUserId,
  userPage,
  totalUsers,
  userRangeStart,
  userRangeEnd,
  totalUserPages,
  onPageChange,
}: {
  users: AdminUser[];
  isFetchingUsers: boolean;
  onRefreshUsers: () => void;
  onOpenNotificationDialog: () => void;
  userSearchTerm: string;
  onUserSearchTermChange: (value: string) => void;
  userStatusFilter: "all" | "active" | "suspended";
  onUserStatusFilterChange: (value: "all" | "active" | "suspended") => void;
  userProviderFilter: string;
  onUserProviderFilterChange: (value: string) => void;
  onOpenTokenDialog: (user: AdminUser) => void;
  onOpenSuspendDialog: (user: AdminUser) => void;
  onViewUserDetail: (userId: number) => void;
  onUnsuspendUser: (userId: number) => void;
  isUnsuspending: boolean;
  isSuspending: boolean;
  suspendTargetUserId: number | null;
  userPage: number;
  totalUsers: number;
  userRangeStart: number;
  userRangeEnd: number;
  totalUserPages: number;
  onPageChange: (nextPage: number) => void;
}) => (
  <>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
        <p className="text-slate-600">Monitor accounts, balances, and access controls</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          onClick={onRefreshUsers}
          disabled={isFetchingUsers}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetchingUsers ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button
          variant="outline"
          className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          onClick={onOpenNotificationDialog}
        >
          <Send className="w-4 h-4 mr-2" />
          Send Notification
        </Button>
      </div>
    </div>

    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative w-full lg:max-w-xs">
        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search by username or email..."
          value={userSearchTerm}
          onChange={(e) => onUserSearchTermChange(e.target.value)}
          className="pl-10 bg-white border-slate-300 text-slate-900"
        />
      </div>
      <div className="flex flex-col gap-3 w-full lg:flex-row lg:w-auto">
        <Select value={userStatusFilter} onValueChange={(value) => onUserStatusFilterChange(value as "all" | "active" | "suspended")}>
          <SelectTrigger className="bg-white border-slate-300 text-slate-900 w-full lg:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={userProviderFilter} onValueChange={onUserProviderFilterChange}>
          <SelectTrigger className="bg-white border-slate-300 text-slate-900 w-full lg:w-40">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="supabase">Supabase</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {isFetchingUsers && users.length === 0 && (
        <Card className="shadow-sm border-slate-200">
          <CardContent className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
          </CardContent>
        </Card>
      )}

      {!isFetchingUsers && users.length === 0 && (
        <Card className="shadow-sm border-slate-200">
          <CardContent className="flex flex-col items-center justify-center h-40 text-center text-slate-500">
            <Users className="w-10 h-10 mb-3 text-slate-300" />
            {userSearchTerm || userStatusFilter !== "all" || userProviderFilter !== "all"
              ? "No users match your current filters."
              : "No users found."}
          </CardContent>
        </Card>
      )}

      {users.map((user) => (
        <Card key={user.id} className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg text-slate-900">{user.username}</CardTitle>
                <p className="text-xs text-slate-500">User ID: {user.id}</p>
              </div>
              <div className="flex gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs ${user.is_suspended ? "bg-red-50 text-red-600 border-red-300" : "bg-emerald-50 text-emerald-600 border-emerald-300"}`}
                >
                  {user.is_suspended ? "Suspended" : "Active"}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-xs ${user.email_verified ? "bg-green-100 text-green-700 border-green-300" : "bg-amber-50 text-amber-700 border-amber-300"}`}
                >
                  {user.email_verified ? "Verified" : "Unverified"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-slate-700">
              <div>
                <span className="font-medium text-slate-600">Email:</span> {user.email || "—"}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-600">Provider:</span>
                {user.provider ? (
                  <Badge variant="outline" className="text-xs capitalize bg-slate-100 text-slate-700 border-slate-300">{user.provider}</Badge>
                ) : (
                  <span>email</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => onOpenTokenDialog(user)}
                  className="bg-slate-50 border border-slate-200 rounded-md p-2 text-left transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  title="Adjust token balance"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Tokens</span>
                    <span className="flex items-center gap-1 text-blue-500 font-medium">
                      <DollarSign className="w-3 h-3" />
                      Adjust
                    </span>
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{user.token_balance}</div>
                </button>
                <div className="bg-slate-50 border border-slate-200 rounded-md p-2">
                  <div className="text-xs text-slate-500">Chats</div>
                  <div className="text-lg font-semibold text-slate-900">{user.total_chats}</div>
                </div>
              </div>
              <div>
                <div className="font-medium text-slate-600 text-xs uppercase tracking-wide mb-1">Last login</div>
                <div>{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Never"}</div>
                {user.last_login_ip && (
                  <div className="text-xs text-slate-500">IP: {user.last_login_ip}</div>
                )}
              </div>
              {user.is_suspended && user.suspension_reason && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                  <span className="font-semibold">Reason: </span>{user.suspension_reason}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-300 text-slate-700 bg-white hover:bg-slate-100"
                onClick={() => onViewUserDetail(user.id)}
              >
                <Eye className="w-4 h-4 mr-1" /> View details
              </Button>
              {user.is_suspended ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50"
                  onClick={() => onUnsuspendUser(user.id)}
                  disabled={isUnsuspending}
                >
                  {isUnsuspending ? (
                    <div className="flex items-center gap-1">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Restoring
                    </div>
                  ) : (
                    "Restore access"
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 bg-white hover:bg-red-50"
                  onClick={() => onOpenSuspendDialog(user)}
                  disabled={isSuspending && suspendTargetUserId === user.id}
                >
                  {isSuspending && suspendTargetUserId === user.id ? (
                    <div className="flex items-center gap-1">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Suspending...
                    </div>
                  ) : (
                    <><Lock className="w-4 h-4 mr-1" /> Suspend</>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>

    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-600">
        {totalUsers > 0
          ? `Showing ${userRangeStart}–${userRangeEnd} of ${totalUsers} users`
          : "No users to display"}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
          onClick={() => onPageChange(Math.max(userPage - 1, 0))}
          disabled={userPage === 0 || isFetchingUsers}
        >
          Previous
        </Button>
        <span className="text-sm text-slate-600">
          Page {totalUsers === 0 ? 0 : userPage + 1} of {totalUsers === 0 ? 0 : totalUserPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
          onClick={() => onPageChange(Math.min(userPage + 1, totalUserPages - 1))}
          disabled={totalUsers === 0 || userPage >= totalUserPages - 1 || isFetchingUsers}
        >
          Next
        </Button>
      </div>
    </div>
  </>
);

export default UsersTab;
