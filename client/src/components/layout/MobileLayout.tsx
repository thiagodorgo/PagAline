import { Link, useLocation } from "wouter";
import { Home, Camera, Calendar, PieChart, Settings, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { icon: Home, label: "Início", path: "/" },
    { icon: FileText, label: "Contas", path: "/bills" },
    { icon: Camera, label: "Scan", path: "/scan", isMain: true },
    { icon: PieChart, label: "Resumo", path: "/reports" },
    { icon: Settings, label: "Ajustes", path: "/settings" },
  ];

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-background text-foreground relative overflow-hidden">
      <main className="flex-1 overflow-y-auto pb-24 no-scrollbar">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full max-w-md bg-card border-t border-border/50 pb-safe pt-2 px-4 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-50 rounded-t-2xl">
        <div className="flex justify-between items-center relative">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;

            if (item.isMain) {
              return (
                <Link key={item.path} href={item.path}>
                  <a className="absolute left-1/2 -top-6 -translate-x-1/2 flex flex-col items-center justify-center">
                    <div className="bg-primary text-primary-foreground p-4 rounded-full shadow-lg hover:scale-105 transition-transform active:scale-95 flex items-center justify-center">
                      <Icon size={28} strokeWidth={2.5} />
                    </div>
                  </a>
                </Link>
              );
            }

            return (
              <Link key={item.path} href={item.path}>
                <a className={cn(
                  "flex flex-col items-center justify-center w-16 h-12 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}>
                  <Icon size={22} className={cn("mb-1 transition-transform", isActive && "scale-110")} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </a>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
