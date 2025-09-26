import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { AgeGateWrapper } from "@/components/age-gate-wrapper";
import { useDocumentTitle, setDocumentMeta } from "@/hooks/use-document-title";
import { useEffect } from "react";

import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import ChatPage from "@/pages/chat-page";
import ScenarioPage from "@/pages/scenario-page";
import DashboardPage from "@/pages/dashboard-page";
import AdminAnalyticsPage from "@/pages/admin-analytics-page";
import AdminHealthPage from "@/pages/admin-health-page";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/chat" component={ChatPage} />
      <ProtectedRoute path="/scenarios" component={ScenarioPage} />
      <ProtectedRoute path="/dashboard" component={DashboardPage} />
      <ProtectedRoute path="/admin/analytics" component={AdminAnalyticsPage} />
      <ProtectedRoute path="/admin/health" component={AdminHealthPage} />
      <ProtectedRoute path="/" component={HomePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useDocumentTitle(); // Set base title to HeartScene
  
  useEffect(() => {
    // Set up meta tags and favicon for HeartScene branding
    setDocumentMeta();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <AgeGateWrapper>
            <Router />
          </AgeGateWrapper>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
