import { useState, useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import CharactersPage from "@/pages/characters";
import FavoritesPage from "@/pages/favorites";
import DiscoverPage from "@/pages/discover";
import CreateCharacterPage from "@/pages/create-character";
import ChatsPage from "@/pages/chats";
import ProfilePage from "@/pages/profile";
import SettingsPage from "@/pages/settings";
import AdminPage from "@/pages/admin";
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import ChatPreviewPage from "@/pages/chat-preview";
import ChatPage from "@/pages/chat";
import PaymentPage from "@/pages/payment";
import NotificationsPage from "@/pages/notifications";
import FAQPage from "@/pages/faq";
import AboutPage from "@/pages/about";
import PrivacyPolicyPage from "@/pages/privacy-policy";
import TermsOfUsePage from "@/pages/terms-of-use";
import MyCharactersPage from "@/pages/my-characters";
import EditCharacterPage from "@/pages/edit-character";
import AuthModal from "@/components/auth/AuthModal";
import { AuthReadinessGate } from "@/components/auth/AuthReadinessGate";
import TabNavigation from "@/components/layout/TabNavigation";
import { RolePlayProvider, useRolePlay } from "@/contexts/RolePlayContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import ErrorBoundary from "@/components/error/ErrorBoundary";
import { useAuthRecovery } from "@/hooks/useAuthRecovery";
import { useRealtimeChatList } from "@/hooks/useRealtimeChatList";

// Auth Modal Handler - handles post-login actions
function AuthModalHandler() {
  const { 
    isAuthModalOpen, 
    setIsAuthModalOpen, 
    pendingMessage,
    setPendingMessage,
    pendingChatAction, 
    setPendingChatAction 
  } = useRolePlay();
  const [_, navigate] = useLocation();

  const handleAuthSuccess = async () => {
    if (pendingChatAction) {
      try {
        const chatId = await pendingChatAction();
        // Navigate to the actual chat with the pending message
        if (pendingMessage) {
          // The chat page will handle sending the pending message
          navigate(`/chat/${chatId}?message=${encodeURIComponent(pendingMessage)}`);
        } else {
          navigate(`/chat/${chatId}`);
        }
      } catch (error) {
        console.error("Failed to execute pending chat action:", error);
      } finally {
        setPendingChatAction(null);
        setPendingMessage(null);
      }
    }
  };

  const handleAuthClose = () => {
    setIsAuthModalOpen(false);
    setPendingChatAction(null);
    setPendingMessage(null);
  };

  return (
    <AuthModal
      isOpen={isAuthModalOpen}
      onClose={handleAuthClose}
      onSuccess={handleAuthSuccess}
      title="Login to Continue"
      description={pendingMessage 
        ? "Please sign in to send your message and start the conversation" 
        : "Please sign in to continue your conversation with this character"
      }
    />
  );
}

// Main App component - now allows browsing without authentication
function MainApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // Session recovery: refresh token and queries when tab wakes from sleep
  useAuthRecovery();

  // Global realtime subscription: invalidates chat list when any message arrives
  useRealtimeChatList();

  return (
    <ErrorBoundary>
      <RolePlayProvider>
        <div className="min-h-screen">
          <Toaster />
          <AuthModalHandler />
          <div className="max-w-full mx-auto pb-20 sm:pb-0">
            <Switch>
              <Route path="/" component={CharactersPage} />
              <Route path="/characters" component={CharactersPage} />
              <Route path="/faq" component={FAQPage} />
              <Route path="/about" component={AboutPage} />
              <Route path="/privacy-policy" component={PrivacyPolicyPage} />
              <Route path="/terms-of-use" component={TermsOfUsePage} />
              <Route path="/favorites" component={FavoritesPage} />
              <Route path="/discover" component={DiscoverPage} />
              <Route path="/create-character">
                <ProtectedRoute>
                  <CreateCharacterPage />
                </ProtectedRoute>
              </Route>
              <Route path="/my-characters">
                <ProtectedRoute>
                  <MyCharactersPage />
                </ProtectedRoute>
              </Route>
              <Route path="/character/:id/edit">
                {params => (
                  <ProtectedRoute>
                    <EditCharacterPage characterId={params.id} />
                  </ProtectedRoute>
                )}
              </Route>
              <Route path="/chat-preview" component={ChatPreviewPage} />
              <Route path="/chats">
                {/* List view only - no chat ID */}
                <ProtectedRoute>
                  <ChatsPage />
                </ProtectedRoute>
              </Route>
              <Route path="/chat/:id">
                {/* Detail view - single source of truth */}
                {params => (
                  <ProtectedRoute>
                    <ChatPage chatId={params.id} />
                  </ProtectedRoute>
                )}
              </Route>
              <Route path="/chat">
                {/* Redirect /chat (no ID) to /chats (list) */}
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              </Route>
              <Route path="/profile">
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              </Route>
              <Route path="/settings">
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              </Route>
              <Route path="/payment">
                <ProtectedRoute>
                  <PaymentPage />
                </ProtectedRoute>
              </Route>
              <Route path="/notifications">
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              </Route>
              <Route component={NotFound} />
            </Switch>
          </div>
          {/* Show TabNavigation on mobile only, and not on certain pages */}
          {!location.startsWith('/admin') && !location.startsWith('/login') && !location.startsWith('/register') && (
            <div className="sm:hidden">
              <TabNavigation />
            </div>
          )}
        </div>
      </RolePlayProvider>
    </ErrorBoundary>
  );
}

// Protected wrapper for auth-required features
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  // AuthReadinessGate ensures isReady === true before rendering anything
  // So we can safely assume auth is initialized at this point

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <AuthProvider>
            <NavigationProvider>
              <FavoritesProvider>
                <Switch>
                  <Route path="/login" component={LoginPage} />
                  <Route path="/register" component={RegisterPage} />
                  <Route path="/admin" component={AdminPage} />
                  <Route>
                    {/* AuthReadinessGate ensures auth is initialized before any routes render */}
                    <AuthReadinessGate>
                      <MainApp />
                    </AuthReadinessGate>
                  </Route>
                </Switch>
              </FavoritesProvider>
            </NavigationProvider>
          </AuthProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
