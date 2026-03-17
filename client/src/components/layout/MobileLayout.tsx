import { Link, useLocation } from "wouter";
import { Home, Camera, Calendar, PieChart, Settings, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { icon: Home, label: "Início", path: "/" },
    { icon: FileText, label: "Contas", path: "/bills" },
    { icon: Plus, label: "Adicionar", path: "/scan", isMain: true },
    { icon: PieChart, label: "Resumo", path: "/reports" },
    { icon: Settings, label: "Ajustes", path: "/settings" },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ede9fe_0%,#f8fafc_34%,#eef2ff_100%)] text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-6 md:px-6 lg:px-8">
        <aside className="hidden md:flex md:w-72 md:shrink-0 md:flex-col md:justify-between md:py-6">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/60 bg-white/75 p-6 shadow-[0_24px_80px_rgba(76,29,149,0.08)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/70">PagAline</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Controle leve, visão ampla.</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                O layout continua com alma mobile, mas agora respira melhor em telas maiores.
              </p>
            </div>

            <nav className="rounded-[2rem] border border-white/60 bg-white/80 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="space-y-2">
                {navItems.map((item) => {
                  const isActive = location === item.path;
                  const Icon = item.icon;

                  return (
                    <Link key={item.path} href={item.path}>
                      <div
                        className={cn(
                          "flex cursor-pointer items-center gap-4 rounded-2xl px-4 py-3 transition-all",
                          item.isMain
                            ? "bg-primary text-primary-foreground shadow-[0_18px_40px_rgba(79,70,229,0.28)]"
                            : isActive
                              ? "bg-primary/10 text-primary"
                              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-11 w-11 items-center justify-center rounded-2xl",
                            item.isMain
                              ? "bg-white/18"
                              : isActive
                                ? "bg-primary/15"
                                : "bg-slate-100",
                          )}
                        >
                          <Icon size={22} strokeWidth={item.isMain ? 2.4 : 2.1} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold">{item.label}</p>
                          <p
                            className={cn(
                              "text-xs",
                              item.isMain
                                ? "text-primary-foreground/70"
                                : isActive
                                  ? "text-primary/70"
                                  : "text-slate-400",
                            )}
                          >
                            {item.isMain ? "Nova conta com OCR" : "Abrir seção"}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>

          <div className="rounded-[2rem] border border-white/60 bg-slate-950 p-5 text-slate-100 shadow-[0_28px_90px_rgba(15,23,42,0.22)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Desktop</p>
            <p className="mt-3 text-lg font-semibold">Mais espaço para revisar contas, OCR e ajustes sem apertos.</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              No celular, tudo continua compacto. No desktop, a navegação sai da base e vira painel lateral.
            </p>
          </div>
        </aside>

        <div className="relative flex min-h-screen flex-1 flex-col md:py-6">
          <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-background md:min-h-[calc(100vh-3rem)] md:rounded-[2rem] md:border md:border-white/60 md:bg-white/92 md:shadow-[0_32px_120px_rgba(15,23,42,0.12)]">
            <main className="flex-1 overflow-y-auto pb-24 no-scrollbar md:pb-8">
              {children}
            </main>

            <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 rounded-t-2xl border-t border-border/50 bg-card px-4 pt-2 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] md:hidden">
              <div className="flex items-center justify-between relative">
                {navItems.map((item) => {
                  const isActive = location === item.path;
                  const Icon = item.icon;

                  if (item.isMain) {
                    return (
                      <Link key={item.path} href={item.path}>
                        <div className="absolute left-1/2 -top-6 flex -translate-x-1/2 cursor-pointer flex-col items-center justify-center">
                          <div className="flex items-center justify-center rounded-full bg-primary p-4 text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95">
                            <Icon size={28} strokeWidth={2.5} />
                          </div>
                        </div>
                      </Link>
                    );
                  }

                  return (
                    <Link key={item.path} href={item.path}>
                      <div
                        className={cn(
                          "flex h-12 w-16 cursor-pointer flex-col items-center justify-center transition-colors",
                          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon size={22} className={cn("mb-1 transition-transform", isActive && "scale-110")} />
                        <span className="text-[10px] font-medium">{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
