import { Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AdminChatDetail } from "../types";

export const ChatPreviewDialog = ({
  open,
  onOpenChange,
  isLoading,
  chatPreview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  chatPreview: AdminChatDetail | null;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-3xl bg-white">
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
      <DialogHeader className="bg-white">
        <DialogTitle className="text-xl text-slate-900">
          {chatPreview?.chat?.title || "Chat preview"}
        </DialogTitle>
      </DialogHeader>
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : chatPreview ? (
        <div className="space-y-4 py-2">
          <div className="text-sm text-slate-700">
            <div><span className="text-xs uppercase tracking-wide text-slate-500 mr-2">Character:</span><span className="font-medium">{chatPreview.chat.character_name || chatPreview.character?.name || `#${chatPreview.chat.character_id}`}</span></div>
            <div><span className="text-xs uppercase tracking-wide text-slate-500 mr-2">Started:</span><span className="font-medium">{new Date(chatPreview.chat.created_at).toLocaleString()}</span></div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto pr-3">
            <div className="space-y-3">
              {chatPreview.messages.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-10">No messages recorded in this chat.</div>
              ) : (
                chatPreview.messages.map((message) => {
                  const isUser = message.role === "user";
                  return (
                    <div
                      key={message.id}
                      className={`rounded-md border border-slate-200 p-3 ${isUser ? 'bg-slate-50 border-blue-200' : 'bg-white border-slate-200'}`}
                    >
                      <div className="flex justify-between text-xs uppercase tracking-wide text-slate-500 mb-1">
                        <span>{isUser ? 'User' : 'Assistant'}</span>
                        <span>{message.timestamp ? new Date(message.timestamp).toLocaleString() : ''}</span>
                      </div>
                      <p className="text-sm whitespace-pre-line text-slate-900">{message.content}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-10 text-center text-sm text-slate-500">Unable to load chat history.</div>
      )}
    </DialogContent>
  </Dialog>
);
