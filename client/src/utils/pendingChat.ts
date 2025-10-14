const STORAGE_KEY = "pendingChatRequest";

export interface PendingChatRequest {
  characterId: number;
  idempotencyKey: string;
  startedAt: number;
}

const isBrowser = typeof window !== "undefined";

const generateIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export function savePendingChatRequest(request: PendingChatRequest) {
  if (!isBrowser) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(request));
  } catch (error) {
    console.warn("Failed to persist pending chat request", error);
  }
}

export function createAndStorePendingChatRequest(characterId: number): PendingChatRequest {
  const request: PendingChatRequest = {
    characterId,
    idempotencyKey: generateIdempotencyKey(),
    startedAt: Date.now(),
  };
  savePendingChatRequest(request);
  return request;
}

export function loadPendingChatRequest(): PendingChatRequest | null {
  if (!isBrowser) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingChatRequest | null;
    if (!parsed) {
      return null;
    }
    if (typeof parsed.characterId !== "number" || typeof parsed.startedAt !== "number" || typeof parsed.idempotencyKey !== "string") {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn("Failed to read pending chat request", error);
    return null;
  }
}

export function clearPendingChatRequest() {
  if (!isBrowser) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear pending chat request", error);
  }
}
