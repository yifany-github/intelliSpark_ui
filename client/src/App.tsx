import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
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
import TabNavigation from "@/components/layout/TabNavigation";
import { RolePlayProvider } from "@/context/RolePlayContext";
import { LanguageProvider } from "@/context/LanguageContext";

function App() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  useEffect(() => {
    // Check if the user has completed onboarding
    const hasCompletedOnboarding = localStorage.getItem("onboardingCompleted");
    if (!hasCompletedOnboarding) {
      setShowOnboarding(true);
    }
  }, []);
  
  const completeOnboarding = () => {
    localStorage.setItem("onboardingCompleted", "true");
    setShowOnboarding(false);
  };

  if (showOnboarding) {
    return <OnboardingPage onComplete={completeOnboarding} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
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
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
