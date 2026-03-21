import { useEffect, useMemo, useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Dialog } from '@capacitor/dialog';
import { useTheme } from 'next-themes';
import { isSameMonth, parseISO } from 'date-fns';
import { Bell, Camera as CameraIcon, Moon, RefreshCcw, Target, Trash2, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useStore } from '@/lib/store';

async function compressImageToDataUrl(dataUrl: string): Promise<string> {
  const image = new Image();
  image.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Não foi possível carregar a imagem selecionada.'));
  });

  const maxSize = 512;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Não foi possível processar a imagem.');
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

export default function Settings() {
  const bills = useStore((state) => state.bills);
  const categories = useStore((state) => state.categories);
  const settings = useStore((state) => state.settings);
  const fetchBills = useStore((state) => state.fetchBills);
  const fetchCategories = useStore((state) => state.fetchCategories);
  const fetchSettings = useStore((state) => state.fetchSettings);
  const addCategory = useStore((state) => state.addCategory);
  const deleteCategory = useStore((state) => state.deleteCategory);
  const updateSettings = useStore((state) => state.updateSettings);
  const resetData = useStore((state) => state.resetData);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const [profileOpen, setProfileOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newName, setNewName] = useState('Aline Silva');
  const [newGoal, setNewGoal] = useState('5000');
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    void Promise.all([fetchBills(), fetchCategories(), fetchSettings()]);
  }, [fetchBills, fetchCategories, fetchSettings]);

  useEffect(() => {
    if (settings) {
      setNewName(settings.userName);
      setNewGoal(settings.monthlyGoal.toString());
    }
  }, [settings]);

  const currentMonthBills = useMemo(() => bills.filter((bill) => {
    const comparisonDate = bill.status === 'paid' && bill.paidDate ? parseISO(bill.paidDate) : parseISO(bill.dueDate);
    return isSameMonth(comparisonDate, new Date());
  }), [bills]);

  const monthlyGoal = settings?.monthlyGoal ?? 5000;
  const totalCurrentMonth = currentMonthBills.reduce((sum, bill) => sum + bill.amount, 0);
  const spendingPercentage = monthlyGoal > 0 ? Math.min((totalCurrentMonth / monthlyGoal) * 100, 100) : 0;
  const avatarFallback = settings?.userName?.slice(0, 2).toUpperCase() ?? 'PA';

  const handleTakePhoto = async () => {
    try {
      const photo = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Base64,
        quality: 90,
        correctOrientation: true,
      });
      if (!photo.base64String) {
        throw new Error('Não foi possível capturar a foto.');
      }
      const compressed = await compressImageToDataUrl(`data:image/${photo.format ?? 'jpeg'};base64,${photo.base64String}`);
      await updateSettings({ customPhotoUrl: compressed });
      toast({ title: 'Foto atualizada', description: 'A imagem foi comprimida e salva localmente.' });
    } catch (error) {
      toast({
        title: 'Falha ao salvar foto',
        description: error instanceof Error ? error.message : 'Não foi possível atualizar a foto.',
        variant: 'destructive',
      });
    }
  };

  const handleReset = async () => {
    const { value } = await Dialog.confirm({
      title: 'Atenção',
      message: 'Isso apagará todas as suas contas. Tem certeza?',
    });
    if (!value) return;

    await resetData();
    toast({ title: 'Dados resetados', description: 'As categorias padrão e configurações iniciais foram recriadas.' });
  };

  return (
    <div className="flex min-h-full flex-col pb-24">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-6 pt-12 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
      </header>

      <div className="space-y-6 p-4">
        <Card className="border-none bg-primary/5 shadow-sm">
          <CardContent className="flex items-center gap-4 p-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={settings?.customPhotoUrl ?? undefined} alt={settings?.userName} />
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold">{settings?.userName ?? 'Aline Silva'}</h2>
              <p className="text-sm text-muted-foreground">{settings?.userPlan ?? 'Plano Premium'}</p>
            </div>
            <Button variant="outline" onClick={() => setProfileOpen(true)}>Editar</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Target size={18} /></div>
                <div>
                  <p className="font-medium">Meta mensal</p>
                  <p className="text-xs text-muted-foreground">Soma de pagas + pendentes no mês</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setGoalOpen(true)}>Ajustar</Button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Atual: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCurrentMonth)}</span>
                <span className={spendingPercentage > 90 ? 'text-destructive' : spendingPercentage > 75 ? 'text-warning' : 'text-primary'}>{Math.round(spendingPercentage)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={spendingPercentage > 90 ? 'h-full bg-destructive' : spendingPercentage > 75 ? 'h-full bg-warning' : 'h-full bg-primary'} style={{ width: `${spendingPercentage}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">Meta configurada em {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlyGoal)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="divide-y divide-border p-0">
            <button type="button" className="flex w-full items-center justify-between p-4 text-left" onClick={() => setProfileOpen(true)}>
              <div className="flex items-center gap-3"><UserRound size={18} className="text-primary" /><span>Perfil</span></div>
              <span className="text-sm text-muted-foreground">Nome e foto</span>
            </button>
            <button type="button" className="flex w-full items-center justify-between p-4 text-left" onClick={() => setCategoriesOpen(true)}>
              <div className="flex items-center gap-3"><CameraIcon size={18} className="text-primary" /><span>Categorias</span></div>
              <span className="text-sm text-muted-foreground">Gerenciar</span>
            </button>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3"><Bell size={18} className="text-primary" /><span>Notificações push</span></div>
              <Switch checked={pushEnabled} onCheckedChange={setPushEnabled} />
            </div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3"><Moon size={18} className="text-primary" /><span>Modo escuro</span></div>
              <Switch checked={theme === 'dark'} onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-3">
          <Button variant="outline" onClick={() => void fetchBills()}>
            <RefreshCcw className="mr-2" size={16} /> Recarregar dados locais
          </Button>
          <Button variant="destructive" onClick={() => void handleReset()}>
            <Trash2 className="mr-2" size={16} /> Resetar aplicativo
          </Button>
        </div>
      </div>

      <Drawer open={profileOpen} onOpenChange={setProfileOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Perfil</DrawerTitle>
            <DrawerDescription>Os dados ficam armazenados no banco local do dispositivo.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 p-4">
            <div className="flex justify-center">
              <Avatar className="h-24 w-24 border-2 border-primary/20">
                <AvatarImage src={settings?.customPhotoUrl ?? undefined} alt={settings?.userName} />
                <AvatarFallback>{avatarFallback}</AvatarFallback>
              </Avatar>
            </div>
            <Button className="w-full" variant="outline" onClick={() => void handleTakePhoto()}>
              <CameraIcon className="mr-2" size={18} /> Tirar foto
            </Button>
            <div className="space-y-2">
              <Label htmlFor="settings-name">Nome</Label>
              <Input id="settings-name" value={newName} onChange={(event) => setNewName(event.target.value)} />
            </div>
            <Button className="w-full" onClick={async () => {
              await updateSettings({ userName: newName.trim() || 'Aline Silva' });
              toast({ title: 'Perfil salvo', description: 'Seu nome foi atualizado.' });
              setProfileOpen(false);
            }}>Salvar perfil</Button>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={goalOpen} onOpenChange={setGoalOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Meta mensal</DrawerTitle>
            <DrawerDescription>Defina o limite de gastos para o resumo e alertas.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <Label htmlFor="settings-goal">Valor da meta</Label>
              <Input id="settings-goal" inputMode="decimal" value={newGoal} onChange={(event) => setNewGoal(event.target.value)} />
            </div>
            <Button className="w-full" onClick={async () => {
              const goal = Number(newGoal.replace(',', '.'));
              if (!Number.isFinite(goal) || goal <= 0) {
                toast({ title: 'Meta inválida', description: 'Informe um valor numérico maior que zero.', variant: 'destructive' });
                return;
              }
              await updateSettings({ monthlyGoal: goal });
              toast({ title: 'Meta atualizada', description: 'A nova meta mensal foi salva.' });
              setGoalOpen(false);
            }}>Salvar meta</Button>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Categorias</DrawerTitle>
            <DrawerDescription>Adicione ou remova categorias locais do dispositivo.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 p-4">
            <div className="flex gap-3">
              <Input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Nova categoria" onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void addCategory(newCategory).then(() => {
                    toast({ title: 'Categoria criada', description: 'A nova categoria foi adicionada.' });
                    setNewCategory('');
                  }).catch((error: unknown) => {
                    toast({ title: 'Falha ao criar categoria', description: error instanceof Error ? error.message : 'Não foi possível criar a categoria.', variant: 'destructive' });
                  });
                }
              }} />
              <Button onClick={() => void addCategory(newCategory).then(() => {
                toast({ title: 'Categoria criada', description: 'A nova categoria foi adicionada.' });
                setNewCategory('');
              }).catch((error: unknown) => {
                toast({ title: 'Falha ao criar categoria', description: error instanceof Error ? error.message : 'Não foi possível criar a categoria.', variant: 'destructive' });
              })}>Adicionar</Button>
            </div>
            <div className="space-y-2">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3 text-sm">
                  <span>{category.name}</span>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void deleteCategory(category.id)}>
                    Remover
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
