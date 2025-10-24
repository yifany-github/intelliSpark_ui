import { QueryClient, QueryFunction, keepPreviousData } from "@tanstack/react-query";

import { getAccessTokenCached, refreshAccessToken, invalidateCachedAccessToken } from "@/utils/auth";
import { supabase } from "@/lib/supabaseClient";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function buildHeaders(
  initHeaders: HeadersInit | undefined,
  accessToken: string | null,
): Promise<Headers> {
  const headers = new Headers(initHeaders);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  initOverrides: RequestInit = {},
): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const attempt = async (accessToken: string | null): Promise<Response> => {
    const headers = await buildHeaders(initOverrides.headers, accessToken);

    let body: BodyInit | null | undefined = initOverrides.body;
    if (data !== undefined) {
      if (data instanceof FormData) {
        body = data;
      } else {
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
        body = JSON.stringify(data);
      }
    }

    return fetch(fullUrl, {
      ...initOverrides,
      method,
      headers,
      body,
      credentials: initOverrides.credentials ?? 'include',
    });
  };

  let accessToken = await getAccessTokenCached();
  let response = await attempt(accessToken);

  if (response.status === 401) {
    invalidateCachedAccessToken();
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      accessToken = refreshedToken;
      response = await attempt(accessToken);
    }
  }

  if (response.status === 401) {
    console.warn("[Auth] Request still unauthorized after refresh; signing out");
    await supabase.auth.signOut();
  }

  await throwIfResNotOk(response);
  return response;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

    const attempt = async (accessToken: string | null) => {
      const headers = await buildHeaders(undefined, accessToken);
      return fetch(fullUrl, {
        headers,
        credentials: 'include',
      });
    };

    let accessToken = await getAccessTokenCached();
    let response = await attempt(accessToken);

    if (response.status === 401) {
      invalidateCachedAccessToken();
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        accessToken = refreshedToken;
        response = await attempt(accessToken);
      }
    }

    if (response.status === 401) {
      console.warn("[Auth] Query still unauthorized after refresh; signing out");
      await supabase.auth.signOut();
      if (unauthorizedBehavior === 'returnNull') {
        return null;
      }
    }

    await throwIfResNotOk(response);
    return await response.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // NOTE: placeholderData removed from global config for safety
      // Add it selectively per-query for list views only (not detail views with IDs)
      refetchInterval: false,
      refetchOnWindowFocus: (query) => {
        const queryKey = query.queryKey[0];
        if (typeof queryKey !== 'string') {
          return false;
        }

        if (queryKey === '/api/characters' || /^\/api\/characters\/\d+$/.test(queryKey)) {
          return true;
        }

        if (queryKey === '/api/chats' || /^\/api\/chats\/[^/]+$/.test(queryKey)) {
          return true;
        }

        if (queryKey.includes('/messages')) {
          return true;
        }

        return false;
      },
      staleTime: (query) => {
        const queryKey = query.queryKey[0];
        if (typeof queryKey !== 'string') {
          return 60 * 1000;
        }

        if (queryKey === '/api/auth/me') {
          return 0;
        }

        if (queryKey === '/api/chats') {
          return 30 * 1000;
        }

        if (queryKey.match(/^\/api\/chats\/[^/]+$/) && !queryKey.includes('/messages')) {
          return 30 * 1000;
        }

        if (queryKey.includes('/messages')) {
          return 0;
        }

        if (queryKey === '/api/characters' || /^\/api\/characters\/\d+$/.test(queryKey)) {
          return 5 * 60 * 1000;
        }

        return 60 * 1000;
      },
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
