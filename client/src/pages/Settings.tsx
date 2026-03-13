import { User, Bell, Shield, CircleHelp, LogOut, ChevronRight, Moon, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-12 pb-4 bg-card border-b border-border sticky top-0 z-10">
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
      </header>

      <div className="p-4 space-y-6">
        {/* Profile Section */}
        <Card className="border-none shadow-sm bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <User size={32} />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg">João Silva</h2>
              <p className="text-sm text-muted-foreground">Plano Premium</p>
            </div>
            <ChevronRight className="text-muted-foreground" size={20} />
          </CardContent>
        </Card>

        {/* Settings Groups */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground px-2 uppercase tracking-wider">Preferências</h3>
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between p-4 bg-card">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Bell size={18} />
                  </div>
                  <span className="font-medium">Notificações Push</span>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 bg-card">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Moon size={18} />
                  </div>
                  <span className="font-medium">Modo Escuro</span>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between p-4 bg-card cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Smartphone size={18} />
                  </div>
                  <span className="font-medium">Categorias</span>
                </div>
                <ChevronRight className="text-muted-foreground" size={20} />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground px-2 uppercase tracking-wider">Conta e Suporte</h3>
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between p-4 bg-card cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Shield size={18} />
                  </div>
                  <span className="font-medium">Segurança e Senha</span>
                </div>
                <ChevronRight className="text-muted-foreground" size={20} />
              </div>
              <div className="flex items-center justify-between p-4 bg-card cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <CircleHelp size={18} />
                  </div>
                  <span className="font-medium">Ajuda e Suporte</span>
                </div>
                <ChevronRight className="text-muted-foreground" size={20} />
              </div>
            </div>
          </Card>
        </div>

        <div className="pt-4 pb-12">
          <button className="flex items-center justify-center gap-2 w-full py-4 text-destructive font-medium bg-destructive/10 rounded-2xl hover:bg-destructive/20 transition-colors">
            <LogOut size={20} />
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
