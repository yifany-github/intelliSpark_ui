import { QueryClient, QueryFunction } from "@tanstack/react-query";

import { getSupabaseAccessToken, supabase } from "@/lib/supabaseClient";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  initOverrides: RequestInit = {},
): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const accessToken = await getSupabaseAccessToken();
  const hasToken = Boolean(accessToken);

  const headers = new Headers(initOverrides.headers as HeadersInit | undefined);

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

  if (hasToken && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(fullUrl, {
    ...initOverrides,
    method,
    headers,
    body,
    credentials: initOverrides.credentials ?? 'include',
  });

  if (response.status === 401 && hasToken) {
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
    
    const accessToken = await getSupabaseAccessToken();
    const hasToken = Boolean(accessToken);

    const headers = new Headers();
    if (hasToken && accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const response = await fetch(fullUrl, {
      headers,
      credentials: 'include',
    });

    if (response.status === 401 && hasToken) {
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
      refetchInterval: false,
      refetchOnWindowFocus: (query) => {
        // Refetch character data when window gains focus to ensure latest descriptions
        const queryKey = query.queryKey[0] as string;
        // More targeted: only character list and individual character queries
        return queryKey === '/api/characters' || /^\/api\/characters\/\d+$/.test(queryKey);
      },
      staleTime: (query) => {
        // Character-related queries should refresh more frequently to pick up
        // real-time description/trait updates from persona prompts (Issue #119)
        const queryKey = query.queryKey[0] as string;
        // More targeted caching: only character endpoints, not all chats
        if (queryKey === '/api/characters' || queryKey.match(/^\/api\/characters\/\d+$/)) {
          return 5 * 60 * 1000; // 5 minutes for character data (more reasonable)
        }
        // Chat list can be cached longer since character data in chats is updated via real-time sync
        if (queryKey === '/api/chats') {
          return 2 * 60 * 1000; // 2 minutes for chat list
        }
        // Chat messages should have no stale time to catch async-generated opening lines
        // and post-idle-refresh scenarios. Polling/realtime will handle updates.
        if (typeof queryKey === 'string' && queryKey.includes('/messages')) {
          return 0; // Always considered stale, refetch when needed
        }
        return Infinity; // Other data cached forever
      },
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
