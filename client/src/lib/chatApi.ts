import { apiRequest } from "@/lib/queryClient";
import { ChatErrorPayload, ChatGenerationSuccessResponse } from "@/types";

export class ChatGenerationError extends Error {
  payload: ChatErrorPayload;
  status: number;

  constructor(payload: ChatErrorPayload, status: number) {
    super(payload.messageKey);
    this.payload = payload;
    this.status = status;
  }
}

export async function requestChatGeneration(
  chatId: string | number,
  init?: { signal?: AbortSignal },
): Promise<ChatGenerationSuccessResponse> {
  try {
    const response = await apiRequest(
      "POST",
      `/api/chats/${chatId}/generate`,
      {},
      { signal: init?.signal },
    );
    return (await response.json()) as ChatGenerationSuccessResponse;
  } catch (err) {
    if (err instanceof ChatGenerationError) {
      throw err;
    }

    if (err instanceof Error) {
      const match = err.message.match(/^(\d+):\\s*(.*)$/s);
      if (match) {
        const status = Number(match[1]);
        const body = match[2];

        try {
          const parsed = JSON.parse(body);
          if (parsed?.error) {
            throw new ChatGenerationError(parsed.error as ChatErrorPayload, status);
          }
        } catch {
          // fall through if body is not JSON
        }
      }
    }

    throw err;
  }
}
