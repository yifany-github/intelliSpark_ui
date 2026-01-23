import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AdminUserDetail } from "../types";

export const UserDetailDialog = ({
  open,
  onOpenChange,
  isLoading,
  userDetail,
  onOpenChatPreview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  userDetail: AdminUserDetail | null;
  onOpenChatPreview: (chat: {
    id: number;
    uuid?: string | null;
    title: string;
    character_id: number;
    character_name?: string | null;
  }) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-3xl bg-white">
      <DialogHeader className="bg-white">
        <DialogTitle className="text-xl text-slate-900">
          {userDetail?.username || "User details"}
        </DialogTitle>
      </DialogHeader>
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : userDetail ? (
        <div className="space-y-6 py-2">
          <div className="space-y-2 text-sm text-slate-900">
            <div><span className="text-xs uppercase tracking-wide text-slate-500 mr-2">Email:</span><span className="font-medium break-all">{userDetail.email || "—"}</span></div>
            <div><span className="text-xs uppercase tracking-wide text-slate-500 mr-2">Provider:</span><span className="font-medium capitalize">{userDetail.provider || "email"}</span></div>
            <div><span className="text-xs uppercase tracking-wide text-slate-500 mr-2">Created:</span><span className="font-medium">{new Date(userDetail.created_at).toLocaleString()}</span></div>
            <div>
              <span className="text-xs uppercase tracking-wide text-slate-500 mr-2">Last Login:</span>
              <span className="font-medium">{userDetail.last_login_at ? new Date(userDetail.last_login_at).toLocaleString() : "Never"}</span>
              {userDetail.last_login_ip && (
                <span className="ml-2 text-xs text-slate-500">IP: {userDetail.last_login_ip}</span>
              )}
            </div>
            <div><span className="text-xs uppercase tracking-wide text-slate-500 mr-2">Token balance:</span><span className="font-semibold text-slate-900">{userDetail.token_balance}</span></div>
            <div><span className="text-xs uppercase tracking-wide text-slate-500 mr-2">Total chats:</span><span className="font-medium">{userDetail.total_chats}</span></div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">Status:</span>
              <Badge
                variant="outline"
                className={`text-xs ${userDetail.is_suspended ? "bg-red-50 text-red-600 border-red-300" : "bg-emerald-50 text-emerald-600 border-emerald-300"}`}
              >
                {userDetail.is_suspended ? "Suspended" : "Active"}
              </Badge>
              <Badge
                variant="outline"
                className={`text-xs ${userDetail.email_verified ? "bg-green-100 text-green-700 border-green-300" : "bg-amber-50 text-amber-700 border-amber-300"}`}
              >
                {userDetail.email_verified ? "Email verified" : "Email unverified"}
              </Badge>
              {userDetail.is_suspended && userDetail.suspension_reason && (
                <span className="text-xs text-slate-500">Reason: {userDetail.suspension_reason}</span>
              )}
            </div>
            <div><span className="text-xs uppercase tracking-wide text-slate-500 mr-2">Unread notifications:</span><span className="font-medium">{userDetail.unread_notifications}</span></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Recent Chats</h4>
              {userDetail.recent_chats.length === 0 ? (
                <p className="text-sm text-slate-500">No chats yet.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto pr-2">
                  <div className="space-y-2">
                    {userDetail.recent_chats.map((chat) => {
                      const characterLabel = chat.character_name ? `${chat.character_name}` : `Character #${chat.character_id}`;
                      return (
                        <button
                          key={chat.id}
                          type="button"
                          onClick={() => onOpenChatPreview(chat)}
                          className="w-full text-left bg-white border border-slate-200 rounded-md p-2 transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        >
                          <div className="text-sm font-medium text-slate-900">{chat.title}</div>
                          <div className="text-xs text-slate-500">Chat #{chat.id} · {characterLabel}</div>
                          <div className="text-xs text-slate-500">{new Date(chat.created_at).toLocaleString()}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Recent Token Activity</h4>
              {userDetail.recent_token_transactions.length === 0 ? (
                <p className="text-sm text-slate-500">No token transactions recorded.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto pr-2">
                  <div className="space-y-2">
                    {userDetail.recent_token_transactions.map((txn) => (
                      <div key={txn.id} className="bg-white border border-slate-200 rounded-md p-2">
                        <div className="flex justify-between text-sm text-slate-900">
                          <span className="capitalize">{txn.transaction_type}</span>
                          <span className={`font-semibold ${txn.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {txn.amount}
                          </span>
                        </div>
                        {txn.description && (
                          <div className="text-xs text-slate-500 mt-1 whitespace-pre-line">{txn.description}</div>
                        )}
                        <div className="text-xs text-slate-500 mt-1">{new Date(txn.created_at).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-10 text-center text-sm text-slate-500">Unable to load user details.</div>
      )}
    </DialogContent>
  </Dialog>
);
