import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { requestChatGeneration, ChatGenerationError } from "@/lib/chatApi";
import { ChatErrorPayload, ChatGenerationSuccessResponse } from "@/types";

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

      const invalidateKeys = new Set<string>();
      if (options.messagesQueryKey) {
        invalidateKeys.add(options.messagesQueryKey);
      }
      options.invalidateKeys?.forEach((key) => invalidateKeys.add(key));

      invalidateKeys.forEach((key) => {
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
    if (!options.chatId || mutation.isPending) {
      return;
    }
    mutation.mutate();
  }, [mutation, options.chatId]);

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
