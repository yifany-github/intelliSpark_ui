import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isSearchCrawler } from '@/lib/searchCrawler';

interface AuthReadinessGateProps {
  children: React.ReactNode;
}

/**
 * AuthReadinessGate ensures the auth system has fully initialized before
 * rendering protected content. This prevents queries from firing before
 * the authentication session is ready.
 *
 * This is NOT a provider - it's a lightweight conditional renderer.
 * QueryClientProvider must stay above this component so AuthProvider
 * can still call useQueryClient().
 *
 * Search crawlers skip the boot splash so JS renderers do not snapshot
 * "Initializing..." over the prerendered marketing HTML.
 */
export function AuthReadinessGate({ children }: AuthReadinessGateProps) {
  const { isReady, isLoading } = useAuth();

  // Bots index public marketing routes; waiting on Supabase only risks
  // SERP snippets of the loading splash. Humans still wait for auth.
  if (isSearchCrawler()) {
    return <>{children}</>;
  }

  if (!isReady || isLoading) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950/98 via-slate-900/95 to-slate-950/98"
        role="status"
        aria-busy="true"
        aria-label="Loading"
      >
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-gray-800/50" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-secondary animate-spin" />
          </div>
          {/* No visible "Initializing..." — that string polluted Google SERP snippets
              when a renderer snapped the boot UI before auth became ready. */}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}