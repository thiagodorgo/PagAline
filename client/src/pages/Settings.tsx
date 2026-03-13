import { User, Bell, Shield, CircleHelp, LogOut, ChevronRight, Moon, Smartphone, Edit2, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export default function Settings() {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-12 pb-4 bg-card border-b border-border sticky top-0 z-10">
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
      </header>

      <div className="p-4 space-y-6">
        {/* Profile Section */}
        <Card className="border-none shadow-sm bg-primary/5 relative overflow-hidden">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="relative group cursor-pointer">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary overflow-hidden">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Aline" alt="Profile" className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit2 className="text-white w-5 h-5" />
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center cursor-pointer group">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg group-hover:text-primary transition-colors">Aline Silva</h2>
                <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-sm text-muted-foreground">Plano Premium</p>
            </div>
          </CardContent>
        </Card>

        {/* Metas Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground px-2 uppercase tracking-wider">Metas Mensais</h3>
          <Card className="overflow-hidden">
            <div className="p-4 bg-card flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Target size={18} />
                  </div>
                  <div>
                    <span className="font-medium block">Meta de Gastos</span>
                    <span className="text-xs text-muted-foreground">Alertar a cada nova conta</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold block">R$ 5.000,00</span>
                </div>
              </div>
              
              <div className="space-y-2 mt-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Gasto atual: R$ 4.250,00</span>
                  <span className="text-warning">85%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-warning rounded-full" style={{ width: '85%' }}></div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Alerta: Você está a R$ 750,00 de atingir sua meta mensal.
                </p>
              </div>
              
              <Button variant="outline" size="sm" className="w-full mt-2">
                Ajustar Meta
              </Button>
            </div>
          </Card>
        </div>

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
                  <span className="font-medium">Gerenciar Categorias</span>
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
