import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import MobileLayout from "./components/layout/MobileLayout";
import Home from "./pages/Home";
import Bills from "./pages/Bills";
import Scan from "./pages/Scan";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

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
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
