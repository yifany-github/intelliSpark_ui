import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { isTokenValid } from "../utils/auth";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Helper function to clear expired token and redirect
function handleExpiredToken() {
  console.log('Token expired, clearing and redirecting to login...');
  localStorage.removeItem('auth_token');
  
  // Dispatch custom event to notify auth context
  window.dispatchEvent(new CustomEvent('auth-token-expired'));
  
  // Don't redirect here - let the auth context handle it
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  
  // Get auth token from localStorage
  const token = localStorage.getItem('auth_token');
  
  // Check if token is expired before making the request
  if (token && !isTokenValid(token)) {
    handleExpiredToken();
    throw new Error('401: {"detail":"Token expired"}');
  }
  
  const headers: Record<string, string> = {};
  
  // Handle FormData vs JSON
  let body: BodyInit | undefined;
  if (data) {
    if (data instanceof FormData) {
      // Let browser set Content-Type for FormData (includes boundary)
      body = data;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(data);
    }
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const res = await fetch(fullUrl, {
    method,
    headers,
    body,
    credentials: "include",
  });

  // Handle 401 responses by clearing expired token
  if (res.status === 401) {
    handleExpiredToken();
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    
    // Get auth token from localStorage
    const token = localStorage.getItem('auth_token');
    
    // Check if token is expired before making request
    if (token && !isTokenValid(token)) {
      handleExpiredToken();
      if (unauthorizedBehavior === "throw") {
        throw new Error('401: {"detail":"Token expired"}');
      }
      return null;
    }
    
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const res = await fetch(fullUrl, {
      headers,
      credentials: "include",
    });

    // Handle 401 responses by clearing expired token
    if (res.status === 401) {
      handleExpiredToken();
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: (query) => {
        // Refetch character data when window gains focus to ensure latest descriptions
        const queryKey = query.queryKey[0] as string;
        return queryKey.includes('/api/characters') || queryKey.includes('/api/chats');
      },
      staleTime: (query) => {
        // Character-related queries should refresh more frequently to pick up 
        // real-time description/trait updates from persona prompts (Issue #119)
        const queryKey = query.queryKey[0] as string;
        if (queryKey.includes('/api/characters') || queryKey.includes('/api/chats')) {
          return 30 * 1000; // 30 seconds stale time for character data
        }
        return Infinity; // Other data can be cached forever
      },
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
