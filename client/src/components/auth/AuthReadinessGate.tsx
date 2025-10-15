import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

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
 */
export function AuthReadinessGate({ children }: AuthReadinessGateProps) {
  const { isReady, isLoading } = useAuth();

  if (!isReady || isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950/98 via-slate-900/95 to-slate-950/98">
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-gray-800/50" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-secondary animate-spin" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-200">Initializing...</p>
            <p className="text-xs text-gray-500">Setting up your session</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
