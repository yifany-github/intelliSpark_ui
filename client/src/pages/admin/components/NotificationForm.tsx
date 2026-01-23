import { type FormEvent } from "react";
import { Send, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AdminUser } from "../types";

export const NotificationForm = ({
  form,
  setForm,
  users,
  onSubmit,
  onCancel,
  isLoading,
}: {
  form: {
    title: string;
    content: string;
    type: string;
    priority: string;
    target: string;
    userIds: number[];
  };
  setForm: (form: any) => void;
  users: AdminUser[];
  onSubmit: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) => {
  const handleSubmit = (e: FormEvent) => {
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
    <ScrollArea className="max-h-[70vh] bg-white">
      <form onSubmit={handleSubmit} className="space-y-6 p-1 bg-white text-slate-900">
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
                        className="cursor-pointer flex-1"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-800">{user.username}</span>
                          <span className="text-xs text-slate-500">
                            {user.email || "No email"} · ID: {user.id}
                          </span>
                        </div>
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
