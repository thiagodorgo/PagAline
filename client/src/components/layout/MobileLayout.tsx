import { useEffect, useState } from "react";
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

  const desktopSignals = [
    {
      title: "Alerta de vencimento",
      description: "Contas que vencem hoje, amanhã e nesta semana.",
      tone: "border-destructive/20 bg-destructive/5 text-destructive",
    },
    {
      title: "Alerta de meta mensal",
      description: "Avisos quando o gasto encostar ou passar da meta.",
      tone: "border-warning/20 bg-warning/8 text-warning",
    },
    {
      title: "Sugestão pós-OCR",
      description: "Resumo rápido do boleto lido, com categoria e próximos passos.",
      tone: "border-primary/20 bg-primary/8 text-primary",
    },
    {
      title: "Resumo mensal financeiro",
      description: "Leitura consolidada do mês com tendência e prioridades.",
      tone: "border-emerald-500/20 bg-emerald-500/8 text-emerald-700",
    },
    {
      title: "Futuras mensagens",
      description: "Espaço para novas automações e alertas do produto.",
      tone: "border-slate-200 bg-slate-100 text-slate-600",
    },
  ];

  const [activeSignalIndex, setActiveSignalIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSignalIndex((current) => (current + 1) % desktopSignals.length);
    }, 30000);

    return () => window.clearInterval(timer);
  }, [desktopSignals.length]);

  const activeSignal = desktopSignals[activeSignalIndex];
  const nextSignals = desktopSignals.filter((_, index) => index !== activeSignalIndex).slice(0, 3);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ede9fe_0%,#f8fafc_34%,#eef2ff_100%)] text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-6 md:px-6 lg:px-8">
        <aside className="hidden md:flex md:w-72 md:shrink-0 md:flex-col md:justify-between md:py-6">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/60 bg-white/75 p-6 shadow-[0_24px_80px_rgba(76,29,149,0.08)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/70">PagAline</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Painel inteligente em construção.</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                No desktop, essa coluna vai virar a casa das mensagens contextuais do produto.
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
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Desktop Signals</p>
            <div className="mt-4 rounded-[1.6rem] border border-white/10 bg-white/4 p-4">
              <div
                className={cn(
                  "rounded-[1.4rem] border px-4 py-4 transition-all duration-500",
                  activeSignal.tone,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{activeSignal.title}</p>
                    <p className="mt-2 text-xs leading-5 text-inherit/80">{activeSignal.description}</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                    Agora
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {nextSignals.map((signal) => (
                  <div
                    key={signal.title}
                    className="rounded-2xl border border-white/10 bg-white/4 px-4 py-3 text-white/84"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Próxima</p>
                    <p className="mt-1 text-sm font-semibold">{signal.title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/60">{signal.description}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                {desktopSignals.map((signal, index) => (
                  <button
                    key={signal.title}
                    type="button"
                    aria-label={`Mostrar ${signal.title}`}
                    onClick={() => setActiveSignalIndex(index)}
                    className={cn(
                      "h-2.5 flex-1 rounded-full transition-all",
                      index === activeSignalIndex ? "bg-primary" : "bg-white/12 hover:bg-white/25",
                    )}
                  />
                ))}
              </div>

              <p className="mt-3 text-[11px] leading-5 text-white/45">
                O card em destaque alterna a cada 30 segundos e pode receber novas automações no futuro.
              </p>
            </div>
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
