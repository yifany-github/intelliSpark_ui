import { useState, useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
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
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import TabNavigation from "@/components/layout/TabNavigation";
import { RolePlayProvider } from "@/context/RolePlayContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Protected App component that requires authentication
function ProtectedApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  useEffect(() => {
    // Check if the user has completed onboarding
    const hasCompletedOnboarding = localStorage.getItem("onboardingCompleted");
    if (!hasCompletedOnboarding && isAuthenticated) {
      setShowOnboarding(true);
    }
  }, [isAuthenticated]);
  
  const completeOnboarding = () => {
    localStorage.setItem("onboardingCompleted", "true");
    setShowOnboarding(false);
  };

  // Show loading while checking auth
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

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  // Show onboarding if needed
  if (showOnboarding) {
    return <OnboardingPage onComplete={completeOnboarding} />;
  }

  return (
    <RolePlayProvider>
      <div className="min-h-screen pb-16">
        <Toaster />
        <div className="max-w-5xl mx-auto">
          <Switch>
            <Route path="/" component={ScenesPage} />
            <Route path="/scenes" component={ScenesPage} />
            <Route path="/characters" component={CharactersPage} />
            <Route path="/chats" component={ChatsPage} />
            <Route path="/chats/:id">
              {params => <ChatsPage chatId={params.id} />}
            </Route>
            <Route path="/profile" component={ProfilePage} />
            <Route component={NotFound} />
          </Switch>
        </div>
        <TabNavigation />
      </div>
    </RolePlayProvider>
  );
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
                <ProtectedApp />
              </Route>
            </Switch>
          </AuthProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
