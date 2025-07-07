import { useState, useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import ScenesPage from "@/pages/scenes";
import CharactersPage from "@/pages/characters";
import ChatsPage from "@/pages/chats";
import ProfilePage from "@/pages/profile";
import OnboardingPage from "@/pages/onboarding";
import AdminPage from "@/pages/admin";
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import ChatPreviewPage from "@/pages/chat-preview";
import TabNavigation from "@/components/layout/TabNavigation";
import AuthModal from "@/components/auth/AuthModal";
import { RolePlayProvider, useRolePlay } from "@/context/RolePlayContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

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
          navigate(`/chats/${chatId}?message=${encodeURIComponent(pendingMessage)}`);
        } else {
          navigate(`/chats/${chatId}`);
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [location] = useLocation();
  
  useEffect(() => {
    // Skip onboarding for admin routes
    if (location.startsWith('/admin')) {
      return;
    }
    
    // Only show onboarding for authenticated users who haven't completed it
    const hasCompletedOnboarding = localStorage.getItem("onboardingCompleted");
    if (!hasCompletedOnboarding && isAuthenticated) {
      setShowOnboarding(true);
    }
  }, [location, isAuthenticated]);
  
  const completeOnboarding = () => {
    localStorage.setItem("onboardingCompleted", "true");
    setShowOnboarding(false);
  };

  // Show onboarding if user is authenticated and hasn't completed it, but skip for admin routes
  if (isAuthenticated && showOnboarding && !location.startsWith('/admin')) {
    return <OnboardingPage onComplete={completeOnboarding} />;
  }

  return (
    <RolePlayProvider>
      <div className="min-h-screen pb-16">
        <Toaster />
        <AuthModalHandler />
        <div className="max-w-5xl mx-auto">
          <Switch>
            <Route path="/" component={ScenesPage} />
            <Route path="/scenes" component={ScenesPage} />
            <Route path="/characters" component={CharactersPage} />
            <Route path="/chat-preview" component={ChatPreviewPage} />
            <Route path="/chats">
              <ProtectedRoute>
                <ChatsPage />
              </ProtectedRoute>
            </Route>
            <Route path="/chats/:id">
              {params => (
                <ProtectedRoute>
                  <ChatsPage chatId={params.id} />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/profile">
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin" component={AdminPage} />
            <Route component={NotFound} />
          </Switch>
        </div>
        <TabNavigation />
      </div>
    </RolePlayProvider>
  );
}

// Protected wrapper for auth-required features
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

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
            <Switch>
              <Route path="/login" component={LoginPage} />
              <Route path="/register" component={RegisterPage} />
              <Route>
                <MainApp />
              </Route>
            </Switch>
          </AuthProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
