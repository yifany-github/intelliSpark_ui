import {
  Activity,
  Bell,
  RefreshCw,
  Send,
  Settings,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NotificationForm } from "../components/NotificationForm";
import type { AdminNotificationAnalytics, AdminNotificationBatchSummary, AdminUser } from "../types";

const NotificationsTab = ({
  notificationForm,
  onNotificationFormChange,
  showNotificationDialog,
  onShowNotificationDialogChange,
  users,
  onSendNotification,
  isSendingNotification,
  notificationAnalytics,
  notificationAnalyticsLoading,
  notificationRecentBatches,
  formatMetric,
  getPriorityBadgeClass,
  totalUsers,
  onRefreshNotificationAnalytics,
}: {
  notificationForm: {
    title: string;
    content: string;
    type: string;
    priority: string;
    target: string;
    userIds: number[];
  };
  onNotificationFormChange: (form: any) => void;
  showNotificationDialog: boolean;
  onShowNotificationDialogChange: (open: boolean) => void;
  users: AdminUser[];
  onSendNotification: () => void;
  isSendingNotification: boolean;
  notificationAnalytics?: AdminNotificationAnalytics;
  notificationAnalyticsLoading: boolean;
  notificationRecentBatches: AdminNotificationBatchSummary[];
  formatMetric: (value?: number) => string;
  getPriorityBadgeClass: (priority: string) => string;
  totalUsers: number;
  onRefreshNotificationAnalytics: () => void;
}) => (
  <>
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Notification Management</h2>
        <p className="text-slate-600">Send notifications to users and manage communication</p>
      </div>
      <Dialog open={showNotificationDialog} onOpenChange={onShowNotificationDialogChange}>
        <DialogTrigger asChild>
          <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
            <Send className="w-4 h-4 mr-2" />
            Send Notification
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader className="bg-white">
            <DialogTitle className="text-xl text-slate-900">Send Notification</DialogTitle>
          </DialogHeader>
          <NotificationForm
            form={notificationForm}
            setForm={onNotificationFormChange}
            users={users}
            onSubmit={onSendNotification}
            onCancel={() => onShowNotificationDialogChange(false)}
            isLoading={isSendingNotification}
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
          <div className="text-2xl font-bold text-slate-900">
            {notificationAnalyticsLoading ? "…" : formatMetric(notificationAnalytics?.totalAdminNotifications)}
          </div>
          <p className="text-xs text-slate-600">All time notifications sent</p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-900">Active Users</CardTitle>
          <Users className="w-4 h-4 text-slate-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-900">
            {notificationAnalyticsLoading ? "…" : formatMetric(notificationAnalytics?.activeUsers ?? totalUsers)}
          </div>
          <p className="text-xs text-slate-600">Users who can receive notifications</p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-900">Recent Activity</CardTitle>
          <Activity className="w-4 h-4 text-slate-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-900">
            {notificationAnalyticsLoading ? "…" : formatMetric(notificationAnalytics?.adminLast7Days)}
          </div>
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
                onNotificationFormChange({
                  title: "Welcome to YY Chat",
                  content: "Thank you for joining our AI role-playing community. Start exploring characters to begin your journey!",
                  type: "admin",
                  priority: "normal",
                  target: "all",
                  userIds: []
                });
                onShowNotificationDialogChange(true);
              }}
            >
              <Users className="w-4 h-4 mr-2" />
              Send Welcome Message
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start text-slate-700 border-slate-300 bg-white hover:bg-slate-50"
              onClick={() => {
                onNotificationFormChange({
                  title: "System Maintenance Notice",
                  content: "We will be performing scheduled maintenance tonight from 2:00 AM to 4:00 AM. Please save your progress.",
                  type: "system",
                  priority: "high",
                  target: "all",
                  userIds: []
                });
                onShowNotificationDialogChange(true);
              }}
            >
              <Settings className="w-4 h-4 mr-2" />
              Maintenance Notice
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start text-slate-700 border-slate-300 bg-white hover:bg-slate-50"
              onClick={() => {
                onNotificationFormChange({
                  title: "New Feature Available",
                  content: "Discover our new character creation feature! Create your own AI personas and share them with the community.",
                  type: "admin",
                  priority: "normal",
                  target: "all",
                  userIds: []
                });
                onShowNotificationDialogChange(true);
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

    <Card className="shadow-sm border-slate-200">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-lg text-slate-900">Recent Broadcasts</CardTitle>
          <p className="text-sm text-slate-500">Logged delivery and read counts for each admin send.</p>
        </div>
        <Button
          variant="outline"
          className="border-slate-200 text-slate-700 hover:bg-slate-100"
          onClick={onRefreshNotificationAnalytics}
          disabled={notificationAnalyticsLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${notificationAnalyticsLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Delivered</th>
                <th className="px-4 py-3">Read</th>
                <th className="px-4 py-3">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notificationAnalyticsLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">Loading logs…</td>
                </tr>
              )}
              {!notificationAnalyticsLoading && notificationRecentBatches.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No admin notifications have been sent yet.
                  </td>
                </tr>
              )}
              {notificationRecentBatches.map((batch) => (
                <tr key={batch.batchId} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{batch.title}</p>
                    <p className="text-xs text-slate-500 line-clamp-1">{batch.content}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(batch.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {batch.targetScope === "all" ? "All users" : `${batch.targetCount} users`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{batch.deliveredCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {batch.readCount}/{batch.deliveredCount}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${getPriorityBadgeClass(batch.priority)}`}>
                      {batch.priority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  </>
);

export default NotificationsTab;
