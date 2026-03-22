import { Link, useLocation } from 'wouter';
import { FileText, Home, PieChart, Plus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { icon: Home, label: 'Início', path: '/' },
    { icon: FileText, label: 'Contas', path: '/bills' },
    { icon: Plus, label: 'Adicionar', path: '/scan', isMain: true },
    { icon: PieChart, label: 'Resumo', path: '/reports' },
    { icon: Settings, label: 'Ajustes', path: '/settings' },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ede9fe_0%,#f8fafc_34%,#eef2ff_100%)] text-foreground dark:bg-[radial-gradient(circle_at_top,#312e81_0%,#111827_40%,#020617_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:rounded-[2rem] md:my-6 md:border md:border-white/50">
        <main className="flex-1 overflow-y-auto pb-24 no-scrollbar">{children}</main>
        <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 rounded-t-3xl border-t border-border/60 bg-card/95 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] backdrop-blur md:rounded-b-[2rem]">
          <div className="relative flex items-center justify-between">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;

              if (item.isMain) {
                return (
                  <Link key={item.path} href={item.path}>
                    <button
                      type="button"
                      className="absolute left-1/2 -top-6 flex -translate-x-1/2 flex-col items-center justify-center"
                      aria-label={item.label}
                    >
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_16px_40px_rgba(124,58,237,0.45)] transition-transform active:scale-95">
                        <Icon size={28} strokeWidth={2.5} />
                      </span>
                    </button>
                  </Link>
                );
              }

              return (
                <Link key={item.path} href={item.path}>
                  <button
                    type="button"
                    className={cn(
                      'flex h-12 w-16 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon size={21} className={cn(isActive && 'scale-110')} />
                    <span>{item.label}</span>
                  </button>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
