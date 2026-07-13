import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { requestChatGeneration, ChatGenerationError } from "@/lib/chatApi";
import { ChatErrorPayload, ChatGenerationSuccessResponse, ChatMessage } from "@/types";

type ErrorState =
  | { status: "idle" }
  | {
      status: "error";
      payload: ChatErrorPayload;
      appearedAt: number;
      retryAvailableAt: number | null;
    };

interface UseChatGenerationOptions {
  chatId?: string;
  messagesQueryKey?: string;
  invalidateKeys?: string[];
  onSuccess?: (data: ChatGenerationSuccessResponse) => void;
  onError?: (payload: ChatErrorPayload) => void;
}

function toClientMessage(raw: ChatMessage | Record<string, unknown>): ChatMessage {
  const record = raw as Record<string, unknown>;
  const timestamp =
    (typeof record.timestamp === "string" && record.timestamp) ||
    (typeof record.createdAt === "string" && record.createdAt) ||
    new Date().toISOString();

  return {
    id: Number(record.id),
    chatId: Number(record.chatId ?? record.chat_id ?? 0),
    role: record.role as ChatMessage["role"],
    content: String(record.content ?? ""),
    audioUrl: (record.audioUrl ?? record.audio_url) as string | undefined,
    audio_url: (record.audio_url ?? record.audioUrl) as string | undefined,
    audioStatus: (record.audioStatus ?? record.audio_status) as string | undefined,
    audio_status: (record.audio_status ?? record.audioStatus) as string | undefined,
    audioError: (record.audioError ?? record.audio_error) as string | undefined,
    audio_error: (record.audio_error ?? record.audioError) as string | undefined,
    timestamp,
    createdAt: (typeof record.createdAt === "string" && record.createdAt) || timestamp,
    updatedAt: (typeof record.updatedAt === "string" && record.updatedAt) || timestamp,
    stateSnapshot: (record.stateSnapshot ?? record.state_snapshot) as ChatMessage["stateSnapshot"],
  };
}

export function useChatGeneration(options: UseChatGenerationOptions) {
  const queryClient = useQueryClient();
  const controllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const [typingActive, setTypingActive] = useState(false);
  const [errorState, setErrorState] = useState<ErrorState>({ status: "idle" });
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const cancelCurrentRequest = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    clearTimers();
    setTypingActive(false);
  }, [clearTimers]);

  useEffect(() => () => cancelCurrentRequest(), [cancelCurrentRequest]);

  useEffect(() => {
    if (errorState.status !== "error" || errorState.retryAvailableAt === null) {
      setRetryCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.ceil((errorState.retryAvailableAt - Date.now()) / 1000);
      setRetryCountdown(Math.max(0, remaining));
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [errorState]);

  const mutation = useMutation<ChatGenerationSuccessResponse, ChatErrorPayload, void>({
    mutationFn: async () => {
      if (!options.chatId) {
        throw { code: "chat_not_found", messageKey: "chat.error.notFound" } satisfies ChatErrorPayload;
      }

      cancelCurrentRequest();
      const controller = new AbortController();
      controllerRef.current = controller;
      setTypingActive(true);
      setErrorState({ status: "idle" });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutRef.current = window.setTimeout(() => {
          reject(new ChatGenerationError({ code: "timeout", messageKey: "chat.error.timeout" }, 504));
          controller.abort();
        }, 30_000);
      });

      try {
        const result = await Promise.race([
          requestChatGeneration(options.chatId!, { signal: controller.signal }),
          timeoutPromise,
        ]);
        return result;
      } catch (err) {
        if (err instanceof ChatGenerationError) {
          throw err.payload;
        }
        if (err instanceof DOMException && err.name === "AbortError") {
          throw { code: "timeout", messageKey: "chat.error.timeout" } satisfies ChatErrorPayload;
        }
        throw err;
      } finally {
        clearTimers();
        controllerRef.current = null;
      }
    },
    onSuccess: (data) => {
      setTypingActive(false);
      setErrorState({ status: "idle" });
      setRetryCountdown(null);

      // Append AI message immediately — avoid waiting for a full messages refetch
      if (options.messagesQueryKey && data.message) {
        const serverMessage = toClientMessage(data.message);
        queryClient.setQueryData<ChatMessage[]>(
          [options.messagesQueryKey],
          (old = []) => {
            if (old.some((msg) => msg.id === serverMessage.id)) {
              return old;
            }
            return [...old, serverMessage];
          },
        );
      }

      options.invalidateKeys?.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });

      options.onSuccess?.(data);
    },
    onError: (payload) => {
      setTypingActive(false);
      const retryAvailableAt = payload.retryAfterSeconds
        ? Date.now() + payload.retryAfterSeconds * 1000
        : null;
      setErrorState({
        status: "error",
        payload,
        appearedAt: Date.now(),
        retryAvailableAt,
      });
      setRetryCountdown(payload.retryAfterSeconds ?? null);
      options.onError?.(payload);
    },
  });

  const triggerGeneration = useCallback(() => {
    if (!options.chatId) {
      return;
    }
    // Ensure a fresh request even if a prior generate was just aborted
    if (mutation.isPending) {
      cancelCurrentRequest();
    }
    mutation.mutate();
  }, [cancelCurrentRequest, mutation, options.chatId]);

  const retryGeneration = useCallback(() => {
    if (mutation.isPending) {
      return;
    }
    const countdown = retryCountdown ?? 0;
    if (countdown > 0) {
      return;
    }
    mutation.mutate();
  }, [mutation, retryCountdown]);

  const clearError = useCallback(() => {
    setErrorState({ status: "idle" });
    setRetryCountdown(null);
  }, []);

  const handleAssistantMessage = useCallback(() => {
    setTypingActive(false);
    clearError();
  }, [clearError]);

  return {
    triggerGeneration,
    retryGeneration,
    cancelGeneration: cancelCurrentRequest,
    typing: typingActive,
    isPending: mutation.isPending,
    error: errorState.status === "error" ? errorState.payload : null,
    retryCountdown,
    clearError,
    handleAssistantMessage,
  };
}
