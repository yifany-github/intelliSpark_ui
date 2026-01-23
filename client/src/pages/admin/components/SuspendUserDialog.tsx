import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AdminUser } from "../types";

export const SuspendUserDialog = ({
  open,
  onOpenChange,
  targetUser,
  suspendReason,
  onSuspendReasonChange,
  onCancel,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: AdminUser | null;
  suspendReason: string;
  onSuspendReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md bg-white">
      <DialogHeader className="bg-white">
        <DialogTitle className="text-xl text-slate-900">
          Suspend {targetUser?.username ?? "user"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <p className="text-sm text-slate-600">
          Suspended users cannot log in until you restore their account. Provide an optional reason for the audit log.
        </p>
        <div className="space-y-2">
          <Label htmlFor="suspendReason" className="text-sm font-medium text-slate-900">Reason (optional)</Label>
          <Textarea
            id="suspendReason"
            value={suspendReason}
            onChange={(e) => onSuspendReasonChange(e.target.value)}
            placeholder="Explain why this account is being suspended..."
            className="bg-white border-slate-300 text-slate-900"
            rows={4}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={onConfirm}
            disabled={isPending || !targetUser}
          >
            {isPending ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Suspending...
              </div>
            ) : (
              "Confirm suspend"
            )}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
