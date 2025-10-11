import { QueryClient, QueryFunction } from "@tanstack/react-query";
import {
  isTokenValid,
  willTokenExpireSoon,
  clearTokenValidationCache,
} from "../utils/auth";
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearStoredTokens,
} from "../utils/tokenManager";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function handleExpiredToken() {
  console.log("Token expired, clearing and redirecting to login...");
  clearStoredTokens();
  clearTokenValidationCache();
  window.dispatchEvent(new CustomEvent("auth-token-expired"));
}

let refreshPromise: Promise<string> | null = null;

async function requestRefreshToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("Refresh token missing");
  }

  if (!refreshPromise) {
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : undefined;
    refreshPromise = fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken, user_agent: userAgent }),
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = (await res.text()) || res.statusText;
          throw new Error(text);
        }
        return res.json();
      })
      .then((data) => {
        if (!data?.access_token || !data?.refresh_token) {
          throw new Error("Invalid refresh response");
        }
        setAccessToken(data.access_token);
        setRefreshToken(data.refresh_token);
        clearTokenValidationCache();
        window.dispatchEvent(
          new CustomEvent("auth-token-refreshed", { detail: { token: data.access_token } }),
        );
        return data.access_token as string;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function forceRefreshAccessToken() {
  return requestRefreshToken();
}

async function ensureAccessTokenFresh() {
  const token = getAccessToken();

  if (!token) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await requestRefreshToken();
    }
    return;
  }

  if (!isTokenValid(token) || willTokenExpireSoon(token)) {
    await requestRefreshToken();
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

  let body: BodyInit | undefined;
  const baseHeaders: Record<string, string> = {};

  if (data) {
    if (data instanceof FormData) {
      body = data;
    } else {
      baseHeaders["Content-Type"] = "application/json";
      body = JSON.stringify(data);
    }
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await ensureAccessTokenFresh();
    } catch (error) {
      handleExpiredToken();
      throw error;
    }

    const token = getAccessToken();
    const headers = { ...baseHeaders };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(fullUrl, {
      method,
      headers,
      body,
      credentials: "include",
    });

    if (res.status !== 401) {
      await throwIfResNotOk(res);
      return res;
    }

    try {
      await requestRefreshToken();
    } catch (refreshError) {
      handleExpiredToken();
      throw refreshError;
    }
  }

  handleExpiredToken();
  throw new Error('401: {"detail":"Token expired"}');
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await ensureAccessTokenFresh();
      } catch (error) {
        handleExpiredToken();
        if (unauthorizedBehavior === "throw") {
          throw error;
        }
        return null;
      }

      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(fullUrl, {
        headers,
        credentials: "include",
      });

      if (res.status !== 401) {
        await throwIfResNotOk(res);
        return await res.json();
      }

      if (unauthorizedBehavior === "returnNull") {
        handleExpiredToken();
        return null;
      }

      try {
        await requestRefreshToken();
      } catch (refreshError) {
        handleExpiredToken();
        throw refreshError;
      }
    }

    handleExpiredToken();
    if (unauthorizedBehavior === "throw") {
      throw new Error('401: {"detail":"Token expired"}');
    }
    return null;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: (query) => {
        const queryKey = query.queryKey[0] as string;
        if (queryKey === "/api/characters" || /^\/api\/characters\/\d+$/.test(queryKey)) {
          return true;
        }
        if (queryKey === "/api/chats" || /^\/api\/chats\/.+\/messages$/.test(queryKey)) {
          return "always";
        }
        return false;
      },
      staleTime: (query) => {
        const queryKey = query.queryKey[0] as string;
        if (queryKey === "/api/characters" || queryKey.match(/^\/api\/characters\/\d+$/)) {
          return 5 * 60 * 1000;
        }
        if (queryKey === "/api/chats" || /^\/api\/chats\/.+\/messages$/.test(queryKey)) {
          return 0;
        }
        return 30 * 1000;
      },
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
