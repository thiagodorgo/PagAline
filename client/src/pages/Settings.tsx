import { Bell, Shield, CircleHelp, LogOut, ChevronRight, Moon, Smartphone, Edit2, Target, Trash2, RefreshCcw, Camera, UserPlus, QrCode, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useState, useEffect, useRef } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { isSameMonth, parseISO } from "date-fns";

const toDate = (d: string | Date) => (typeof d === 'string' ? parseISO(d) : d);

async function compressImageToDataUrl(file: File) {
  const imageBitmap = await createImageBitmap(file);
  const maxSize = 512;
  const scale = Math.min(1, maxSize / Math.max(imageBitmap.width, imageBitmap.height));
  const width = Math.max(1, Math.round(imageBitmap.width * scale));
  const height = Math.max(1, Math.round(imageBitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Não foi possível processar a imagem selecionada.");
  }

  context.drawImage(imageBitmap, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  imageBitmap.close();
  return dataUrl;
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const categories = useStore(state => state.categories);
  const settings = useStore(state => state.settings);
  const bills = useStore(state => state.bills);
  const currentUser = useStore(state => state.currentUser);
  const users = useStore(state => state.users);
  
  const addCategory = useStore(state => state.addCategory);
  const deleteCategory = useStore(state => state.deleteCategory);
  const updateSettings = useStore(state => state.updateSettings);
  const updateCurrentUser = useStore(state => state.updateCurrentUser);
  const createUser = useStore(state => state.createUser);
  const fetchUsers = useStore(state => state.fetchUsers);
  const logout = useStore(state => state.logout);
  const createDeviceLoginToken = useStore(state => state.createDeviceLoginToken);
  const resetData = useStore(state => state.resetData);
  const fetchBills = useStore(state => state.fetchBills);
  const fetchCategories = useStore(state => state.fetchCategories);
  const fetchSettings = useStore(state => state.fetchSettings);

  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isGoalDrawerOpen, setIsGoalDrawerOpen] = useState(false);
  const [newGoal, setNewGoal] = useState(settings?.monthlyGoal?.toString() || "5000");
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [newName, setNewName] = useState(currentUser?.displayName || "Aline");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [isAccessQrOpen, setIsAccessQrOpen] = useState(false);
  const [accessLink, setAccessLink] = useState("");

  useEffect(() => {
    setMounted(true);
    fetchBills();
    fetchCategories();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      setNewGoal(settings.monthlyGoal.toString());
    }
  }, [settings]);

  useEffect(() => {
    if (currentUser) {
      setNewName(currentUser.displayName);
      if (currentUser.isAdmin) {
        fetchUsers();
      }
    }
  }, [currentUser]);

  const isDark = mounted && (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches));

  const monthlyGoal = settings?.monthlyGoal || 5000;
  const userName = currentUser?.displayName || currentUser?.username || "Usuário";
  const userPlan = currentUser?.isAdmin ? "Administrador" : "Usuária";

  const handleAddCategory = async () => {
    if (newCategoryName.trim()) {
      try {
        await addCategory(newCategoryName.trim());
        setNewCategoryName("");
        toast({ title: "Categoria adicionada", description: `A categoria ${newCategoryName} foi criada.` });
      } catch (error) {
        toast({
          title: "Falha ao adicionar categoria",
          description: error instanceof Error ? error.message : "Não foi possível criar a categoria.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSaveGoal = async () => {
    const goal = parseFloat(newGoal.replace(',', '.'));
    if (!isNaN(goal) && goal > 0) {
      try {
        await updateSettings({ monthlyGoal: goal });
        setIsGoalDrawerOpen(false);
        toast({ title: "Meta atualizada", description: "Sua meta mensal foi salva." });
      } catch (error) {
        toast({
          title: "Falha ao salvar meta",
          description: error instanceof Error ? error.message : "Não foi possível salvar a meta.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSaveProfile = async () => {
    if (newName.trim()) {
      try {
        await updateCurrentUser({ displayName: newName.trim() });
        setIsProfileDrawerOpen(false);
        toast({ title: "Perfil atualizado", description: "Seus dados foram alterados com sucesso." });
      } catch (error) {
        toast({
          title: "Falha ao salvar perfil",
          description: error instanceof Error ? error.message : "Não foi possível atualizar o perfil.",
          variant: "destructive",
        });
      }
    }
  };

  const handleReset = async () => {
    if (window.confirm("Isso apagará todas as suas contas. Tem certeza?")) {
      try {
        await resetData();
        toast({ title: "Dados apagados", description: "O aplicativo foi resetado para o estado inicial." });
      } catch (error) {
        toast({
          title: "Falha ao resetar dados",
          description: error instanceof Error ? error.message : "Não foi possível limpar os dados.",
          variant: "destructive",
        });
      }
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageToDataUrl(file);
        await updateCurrentUser({ avatarUrl: compressed });
        toast({ title: "Foto atualizada", description: "Sua foto de perfil foi salva com sucesso." });
      } catch (error) {
        toast({
          title: "Falha ao atualizar foto",
          description: error instanceof Error ? error.message : "Não foi possível salvar a foto.",
          variant: "destructive",
        });
      } finally {
        e.target.value = "";
      }
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) return;

    try {
      await createUser({
        username: newUsername.trim(),
        password: newPassword,
        isAdmin: newIsAdmin,
      });
      setNewUsername("");
      setNewPassword("");
      setNewIsAdmin(false);
      toast({ title: "Usuário criado", description: "O novo acesso foi salvo com sucesso." });
    } catch (error) {
      toast({
        title: "Falha ao criar usuário",
        description: error instanceof Error ? error.message : "Não foi possível criar o usuário.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      toast({
        title: "Falha ao sair",
        description: error instanceof Error ? error.message : "Não foi possível encerrar a sessão.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateAccessQr = async () => {
    try {
      const token = await createDeviceLoginToken();
      setAccessLink(token.url);
      setIsAccessQrOpen(true);
    } catch (error) {
      toast({
        title: "Falha ao gerar QR",
        description: error instanceof Error ? error.message : "Não foi possível criar o acesso rápido.",
        variant: "destructive",
      });
    }
  };

  const handleCopyAccessLink = async () => {
    try {
      await navigator.clipboard.writeText(accessLink);
      toast({ title: "Link copiado", description: "Agora você pode abrir no outro dispositivo." });
    } catch (error) {
      toast({
        title: "Falha ao copiar",
        description: error instanceof Error ? error.message : "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  };

  const currentMonth = new Date();
  const monthBills = bills.filter(bill => {
    const dateToUse = bill.status === 'paid' && bill.paidDate ? toDate(bill.paidDate) : toDate(bill.dueDate);
    return isSameMonth(dateToUse, currentMonth);
  });
  const currentSpending = monthBills.reduce((sum, bill) => sum + bill.amount, 0);
  const spendingPercentage = Math.min((currentSpending / monthlyGoal) * 100, 100);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const avatarSrc = currentUser?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`;

  return (
    <div className="flex flex-col min-h-full pb-24">
      <header className="px-6 pt-12 pb-4 bg-card border-b border-border sticky top-0 z-10">
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
      </header>

      <div className="p-4 space-y-6">
        <Card className="border-none shadow-sm bg-primary/5 relative overflow-hidden">
          <CardContent className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => setIsProfileDrawerOpen(true)}>
            <div className="relative group">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary overflow-hidden">
                <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit2 className="text-white w-5 h-5" />
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center group">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg group-hover:text-primary transition-colors">{userName}</h2>
                <Edit2 className="w-3 h-3 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{userPlan}</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground px-2 uppercase tracking-wider">Metas Mensais</h3>
          <Card className="overflow-hidden">
            <div className="p-4 bg-card flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Target size={18} /></div>
                  <div>
                    <span className="font-medium block">Meta de Gastos</span>
                    <span className="text-xs text-muted-foreground">Alertar a cada nova conta</span>
                  </div>
                </div>
                <div className="text-right"><span className="font-bold block">{formatCurrency(monthlyGoal)}</span></div>
              </div>
              <div className="space-y-2 mt-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Gasto atual: {formatCurrency(currentSpending)}</span>
                  <span className={spendingPercentage > 90 ? "text-destructive" : spendingPercentage > 75 ? "text-warning" : "text-primary"}>{Math.round(spendingPercentage)}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${spendingPercentage > 90 ? 'bg-destructive' : spendingPercentage > 75 ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${spendingPercentage}%` }}></div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {currentSpending < monthlyGoal ? `Você ainda pode gastar ${formatCurrency(monthlyGoal - currentSpending)} este mês.` : "Você ultrapassou sua meta!"}
                </p>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setIsGoalDrawerOpen(true)}>Ajustar Meta</Button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground px-2 uppercase tracking-wider">Preferências</h3>
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between p-4 bg-card">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Bell size={18} /></div>
                  <span className="font-medium">Notificações Push</span>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 bg-card">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Moon size={18} /></div>
                  <span className="font-medium">Modo Escuro</span>
                </div>
                <Switch checked={isDark} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
              </div>
              <div className="flex items-center justify-between p-4 bg-card cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setIsCategoryDrawerOpen(true)}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Smartphone size={18} /></div>
                  <span className="font-medium">Gerenciar Categorias</span>
                </div>
                <ChevronRight className="text-muted-foreground" size={20} />
              </div>
              <div className="flex items-center justify-between p-4 bg-card cursor-pointer hover:bg-muted/50 transition-colors" onClick={handleGenerateAccessQr}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><QrCode size={18} /></div>
                  <span className="font-medium">Acesso por QR Code</span>
                </div>
                <ChevronRight className="text-muted-foreground" size={20} />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground px-2 uppercase tracking-wider">Conta e Dados</h3>
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between p-4 bg-card cursor-pointer hover:bg-muted/50 transition-colors text-destructive" onClick={handleReset}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center"><RefreshCcw size={18} /></div>
                  <span className="font-medium">Apagar todos os dados</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-card cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><CircleHelp size={18} /></div>
                  <span className="font-medium">Ajuda e Suporte</span>
                </div>
                <ChevronRight className="text-muted-foreground" size={20} />
              </div>
            </div>
          </Card>
        </div>

        {currentUser?.isAdmin && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground px-2 uppercase tracking-wider">Ajustes de Admin</h3>
            <Card className="overflow-hidden">
              <div className="space-y-4 p-4">
                <div className="flex items-start gap-3 rounded-2xl bg-primary/5 p-4">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Shield size={18} />
                  </div>
                  <div>
                    <p className="font-medium">Criar acesso de usuário</p>
                    <p className="text-sm text-muted-foreground">
                      Thiago administra os acessos. Novos usuários entram com nome de usuário e senha.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nome de usuário"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full rounded-xl bg-muted px-4 py-3"
                  />
                  <input
                    type="password"
                    placeholder="Senha"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl bg-muted px-4 py-3"
                  />
                  <label className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3 text-sm font-medium">
                    Conceder acesso de administrador
                    <Switch checked={newIsAdmin} onCheckedChange={setNewIsAdmin} />
                  </label>
                  <Button className="w-full" onClick={handleCreateUser} disabled={!newUsername.trim() || !newPassword.trim()}>
                    <UserPlus className="mr-2 h-4 w-4" /> Criar usuário
                  </Button>
                </div>

                <div className="space-y-2">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                      <div>
                        <p className="font-medium">{user.displayName}</p>
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {user.isAdmin ? "Admin" : "Usuário"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        <div className="pt-4">
          <button
            className="flex items-center justify-center gap-2 w-full py-4 text-muted-foreground font-medium bg-muted rounded-2xl hover:bg-muted/80 transition-colors"
            onClick={handleLogout}
          >
            <LogOut size={20} /> Sair da conta
          </button>
        </div>
      </div>

      <Drawer open={isCategoryDrawerOpen} onOpenChange={setIsCategoryDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Gerenciar Categorias</DrawerTitle>
            <DrawerDescription>Adicione ou remova categorias de contas.</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 flex flex-col gap-3 overflow-y-auto">
            <div className="flex gap-2 mb-2">
              <input type="text" placeholder="Nova categoria..." value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                className="flex-1 p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-medium" />
              <Button onClick={handleAddCategory} className="rounded-xl h-auto px-6" disabled={!newCategoryName.trim()}>Adicionar</Button>
            </div>
            <div className="space-y-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                  <span className="font-medium">{cat.name}</span>
                  <Button variant="ghost" size="icon" onClick={() => deleteCategory(cat.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
            <DrawerClose asChild className="mt-4"><Button variant="outline" className="w-full">Fechar</Button></DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={isProfileDrawerOpen} onOpenChange={setIsProfileDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Editar Perfil</DrawerTitle>
            <DrawerDescription>Altere sua foto e seu nome.</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-28 h-28 rounded-full bg-primary/20 flex items-center justify-center text-primary overflow-hidden border-4 border-primary/20 cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}>
                <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="text-white mb-1" size={24} /><span className="text-white text-xs font-medium">Trocar Foto</span>
                </div>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handlePhotoUpload} />
              <p className="text-xs text-muted-foreground">Toque na foto para alterar</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome de Usuário</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-medium text-lg" />
            </div>
            <Button className="w-full py-6 text-lg rounded-2xl" onClick={handleSaveProfile}>Salvar Alterações</Button>
            <DrawerClose asChild><Button variant="ghost" className="w-full">Cancelar</Button></DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={isGoalDrawerOpen} onOpenChange={setIsGoalDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Ajustar Meta Mensal</DrawerTitle>
            <DrawerDescription>Defina um limite de gastos para receber alertas.</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor da Meta (R$)</label>
              <input type="number" value={newGoal} onChange={(e) => setNewGoal(e.target.value)}
                className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-bold text-lg" />
            </div>
            <Button className="w-full py-6 text-lg rounded-2xl" onClick={handleSaveGoal}>Salvar Meta</Button>
            <DrawerClose asChild><Button variant="ghost" className="w-full">Cancelar</Button></DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={isAccessQrOpen} onOpenChange={setIsAccessQrOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Acesso em outro dispositivo</DialogTitle>
            <DialogDescription>
              Escaneie este QR no celular para entrar automaticamente com a mesma conta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {accessLink && (
              <>
                <div className="mx-auto w-fit rounded-3xl bg-white p-4 shadow-sm">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(accessLink)}`}
                    alt="QR code de acesso"
                    className="h-64 w-64 rounded-2xl"
                  />
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  O QR é de uso único e expira em poucos minutos.
                </p>
                <Button variant="outline" className="w-full" onClick={handleCopyAccessLink}>
                  <Copy className="mr-2 h-4 w-4" /> Copiar link de acesso
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
