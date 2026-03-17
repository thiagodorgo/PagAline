import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";
import MobileLayout from "./components/layout/MobileLayout";
import Home from "./pages/Home";
import Bills from "./pages/Bills";
import Scan from "./pages/Scan";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import { useEffect, useMemo } from "react";
import { useStore } from "./lib/store";

function Router() {
  return (
    <MobileLayout>
      <Switch>
        <Route path="/" component={Home}/>
        <Route path="/bills" component={Bills}/>
        <Route path="/scan" component={Scan}/>
        <Route path="/reports" component={Reports}/>
        <Route path="/settings" component={Settings}/>
        <Route component={NotFound} />
      </Switch>
    </MobileLayout>
  );
}

function App() {
  const currentUser = useStore((state) => state.currentUser);
  const authReady = useStore((state) => state.authReady);
  const fetchCurrentUser = useStore((state) => state.fetchCurrentUser);
  const isDeviceLoginPath = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.location.pathname.startsWith("/login/access");
  }, []);

  useEffect(() => {
    void fetchCurrentUser();
  }, [fetchCurrentUser]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          {!authReady ? (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : isDeviceLoginPath ? (
            <Login />
          ) : currentUser ? (
            <Router />
          ) : (
            <Login />
          )}
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
