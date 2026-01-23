import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { AdminUser } from "../types";

export const TokenAdjustDialog = ({
  open,
  onOpenChange,
  targetUser,
  tokenAmount,
  onTokenAmountChange,
  tokenAdjustmentType,
  onTokenAdjustmentTypeChange,
  tokenReason,
  onTokenReasonChange,
  onCancel,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: AdminUser | null;
  tokenAmount: string | number;
  onTokenAmountChange: (value: string) => void;
  tokenAdjustmentType: "credit" | "debit";
  onTokenAdjustmentTypeChange: (value: "credit" | "debit") => void;
  tokenReason: string;
  onTokenReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md bg-white">
      <DialogHeader className="bg-white">
        <DialogTitle className="text-xl text-slate-900">
          Adjust tokens for {targetUser?.username ?? "user"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-700">
          Current balance: <span className="font-semibold text-slate-900">{targetUser?.token_balance ?? 0}</span> tokens
        </div>
        <div className="space-y-2">
          <Label htmlFor="tokenAmount" className="text-sm font-medium text-slate-900">Amount</Label>
          <Input
            id="tokenAmount"
            type="number"
            min="0"
            value={tokenAmount}
            onChange={(e) => onTokenAmountChange(e.target.value)}
            placeholder="Enter number of tokens"
            className="bg-white border-slate-300 text-slate-900"
          />
          <p className="text-xs text-slate-500">Choose whether to add or deduct this amount below.</p>
        </div>
        <RadioGroup
          value={tokenAdjustmentType}
          onValueChange={(value) => onTokenAdjustmentTypeChange(value as "credit" | "debit")}
          className="grid grid-cols-2 gap-2"
        >
          <label className={`border rounded-md p-3 text-sm cursor-pointer transition flex items-center ${tokenAdjustmentType === "credit" ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-300 text-slate-700'}`}>
            <RadioGroupItem value="credit" className="mr-2" />
            Add tokens
          </label>
          <label className={`border rounded-md p-3 text-sm cursor-pointer transition flex items-center ${tokenAdjustmentType === "debit" ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-slate-300 text-slate-700'}`}>
            <RadioGroupItem value="debit" className="mr-2" />
            Deduct tokens
          </label>
        </RadioGroup>
        <div className="space-y-2">
          <Label htmlFor="tokenReason" className="text-sm font-medium text-slate-900">Reason (optional)</Label>
          <Textarea
            id="tokenReason"
            value={tokenReason}
            onChange={(e) => onTokenReasonChange(e.target.value)}
            placeholder="Document why this adjustment is being made..."
            className="bg-white border-slate-300 text-slate-900"
            rows={4}
          />
          <p className="text-xs text-slate-500">This note is saved in the user's token transaction history.</p>
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
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={onConfirm}
            disabled={isPending || !targetUser}
          >
            {isPending ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </div>
            ) : (
              "Update tokens"
            )}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
