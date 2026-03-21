import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch } from 'wouter';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { queryClient } from '@/lib/queryClient';
import MobileLayout from '@/components/layout/MobileLayout';
import Home from '@/pages/Home';
import Bills from '@/pages/Bills';
import Scan from '@/pages/Scan';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/not-found';
import { useStore } from '@/lib/store';

function Router() {
  return (
    <MobileLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/bills" component={Bills} />
        <Route path="/scan" component={Scan} />
        <Route path="/reports" component={Reports} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </MobileLayout>
  );
}

export default function App() {
  const fetchBills = useStore((state) => state.fetchBills);
  const fetchCategories = useStore((state) => state.fetchCategories);
  const fetchSettings = useStore((state) => state.fetchSettings);

  useEffect(() => {
    void Promise.all([fetchBills(), fetchCategories(), fetchSettings()]);
  }, [fetchBills, fetchCategories, fetchSettings]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
