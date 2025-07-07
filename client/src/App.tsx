import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
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
import TabNavigation from "@/components/layout/TabNavigation";
import { RolePlayProvider } from "@/context/RolePlayContext";
import { LanguageProvider } from "@/context/LanguageContext";

function App() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [location] = useLocation();
  
  useEffect(() => {
    // Skip onboarding for admin routes
    if (location.startsWith('/admin')) {
      return;
    }
    
    // Check if the user has completed onboarding
    const hasCompletedOnboarding = localStorage.getItem("onboardingCompleted");
    if (!hasCompletedOnboarding) {
      setShowOnboarding(true);
    }
  }, [location]);
  
  const completeOnboarding = () => {
    localStorage.setItem("onboardingCompleted", "true");
    setShowOnboarding(false);
  };

  if (showOnboarding && !location.startsWith('/admin')) {
    return <OnboardingPage onComplete={completeOnboarding} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <RolePlayProvider>
            <div className={`min-h-screen ${!location.startsWith('/admin') ? 'pb-16' : ''}`}>
              <Toaster />
              <div className={location.startsWith('/admin') ? '' : 'max-w-5xl mx-auto'}>
                <Switch>
                  <Route path="/" component={ScenesPage} />
                  <Route path="/scenes" component={ScenesPage} />
                  <Route path="/characters" component={CharactersPage} />
                  <Route path="/chats" component={ChatsPage} />
                  <Route path="/chats/:id">
                    {params => <ChatsPage chatId={params.id} />}
                  </Route>
                  <Route path="/profile" component={ProfilePage} />
                  <Route path="/admin" component={AdminPage} />
                  <Route component={NotFound} />
                </Switch>
              </div>
              {!location.startsWith('/admin') && <TabNavigation />}
            </div>
          </RolePlayProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
