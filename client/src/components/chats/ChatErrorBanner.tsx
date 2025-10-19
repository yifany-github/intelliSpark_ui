import { useEffect, useState } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { ChatErrorPayload } from "@/types";
import { Button } from "@/components/ui/button";

interface ChatErrorBannerProps {
  error: ChatErrorPayload;
  retryCountdown?: number | null;
  onRetry: () => void;
  onReload: () => void;
  onDismiss: () => void;
  onReport?: () => void;
  retryDisabled?: boolean;
  isRetrying?: boolean;
}

export function ChatErrorBanner({
  error,
  retryCountdown,
  onRetry,
  onReload,
  onDismiss,
  onReport,
  retryDisabled,
  isRetrying,
}: ChatErrorBannerProps) {
  const { t } = useLanguage();
  const [localCountdown, setLocalCountdown] = useState<number | null>(retryCountdown ?? null);

  useEffect(() => {
    setLocalCountdown(retryCountdown ?? null);
  }, [retryCountdown]);

  useEffect(() => {
    if (localCountdown === null) {
      return;
    }
    if (localCountdown <= 0) {
      return;
    }
    const interval = window.setInterval(() => {
      setLocalCountdown((previous) => {
        if (previous === null) {
          return null;
        }
        return previous <= 1 ? 0 : previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [localCountdown]);

  const retryReady = (localCountdown ?? 0) <= 0 && !retryDisabled;

  return (
    <div className="mx-4 mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-red-200">{t("chatErrorTitle") || "Something went wrong"}</p>
          <p className="mt-1 text-red-100/90">{t(error.messageKey) || error.messageKey}</p>
          {typeof localCountdown === "number" && localCountdown > 0 && (
            <p className="mt-1 text-xs text-red-100/80">
              {(t("chatErrorRetryCountdown") || "Retry available in") + ` ${localCountdown}s`}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onDismiss} className="text-red-200 hover:text-red-100">
          ×
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={onRetry} disabled={!retryReady} variant="default" className="bg-red-500 hover:bg-red-400" >
          {isRetrying ? (t("retrying") || "Retrying...") : t("retry") || "Retry"}
        </Button>
        <Button onClick={onReload} variant="outline" className="border-red-400/60 text-red-100 hover:bg-red-500/20">
          {t("reloadChat") || "Reload chat"}
        </Button>
        {onReport && (
          <Button onClick={onReport} variant="outline" className="border-red-400/60 text-red-100 hover:bg-red-500/20">
            {t("reportIssue") || "Report issue"}
          </Button>
        )}
      </div>
    </div>
  );
}
