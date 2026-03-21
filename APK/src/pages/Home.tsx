import { useEffect, useRef, useState } from 'react';
import { format, isPast, isThisMonth, isToday, isTomorrow, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import {
  Bell,
  Calendar as CalendarIcon,
  CheckCircle2,
  Edit,
  FileText,
  MoreVertical,
  Trash,
} from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useStore, type Bill } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const isOverdue = (bill: Bill) =>
  bill.status === 'pending' && parseISO(bill.dueDate) < startOfDay(new Date());

const getDueDateLabel = (bill: Bill) => {
  const date = parseISO(bill.dueDate);
  if (bill.status === 'paid') return 'Pago';
  if (isOverdue(bill)) return 'Vencido';
  if (isToday(date)) return 'Vence hoje';
  if (isTomorrow(date)) return 'Vence amanhã';
  return `Vence em ${format(date, 'dd MMM', { locale: ptBR })}`;
};

const getStatusClasses = (bill: Bill) => {
  if (bill.status === 'paid') return 'text-success bg-success/10 border-success/20';
  if (isOverdue(bill)) return 'text-destructive bg-destructive/10 border-destructive/20';
  if (isToday(parseISO(bill.dueDate)) || isTomorrow(parseISO(bill.dueDate))) {
    return 'text-warning bg-warning/10 border-warning/20';
  }
  return 'text-muted-foreground bg-muted border-border';
};

function BillItem({
  bill,
  isSelectionMode,
  isSelected,
  onToggleSelection,
  onPay,
  onSchedule,
  onOpenOptions,
}: {
  bill: Bill;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
  onPay: (id: string) => void;
  onSchedule: (bill: Bill) => void;
  onOpenOptions: (bill: Bill) => void;
}) {
  const controls = useAnimation();
  const timerRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const clearPressTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchStart = () => {
    if (isSelectionMode) return;
    timerRef.current = window.setTimeout(() => {
      void onOpenOptions(bill);
    }, 2000);
  };

  const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setDragOffset(info.offset.x);
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    clearPressTimer();
    setDragOffset(0);
    const threshold = 100;

    if (info.offset.x > threshold || (info.offset.x > 30 && info.velocity.x > 500)) {
      void controls.start({ x: 500, transition: { duration: 0.2 } }).then(() => {
        onPay(bill.id);
        controls.set({ x: 0 });
      });
      return;
    }

    if (info.offset.x < -threshold || (info.offset.x < -30 && info.velocity.x < -500)) {
      onSchedule(bill);
    }

    void controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } });
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-muted">
      <div className="absolute inset-0 flex items-center justify-between px-6">
        <div className={cn('flex items-center gap-2 text-sm font-medium', dragOffset > 40 ? 'text-success' : 'text-muted-foreground/60')}>
          <CheckCircle2 size={20} />
          <span>Pagar</span>
        </div>
        <div className={cn('flex items-center gap-2 text-sm font-medium', dragOffset < -40 ? 'text-primary' : 'text-muted-foreground/60')}>
          <span>Agendar</span>
          <CalendarIcon size={20} />
        </div>
      </div>

      <motion.div
        drag={!isSelectionMode ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        animate={controls}
        onDrag={handleDrag}
        onDragStart={clearPressTimer}
        onDragEnd={handleDragEnd}
        onTouchStart={handleTouchStart}
        onTouchEnd={clearPressTimer}
        onTouchCancel={clearPressTimer}
        onMouseDown={handleTouchStart}
        onMouseUp={clearPressTimer}
        onMouseLeave={clearPressTimer}
        className="relative z-10 touch-pan-y"
        whileTap={!isSelectionMode ? { scale: 0.98 } : {}}
        onClick={() => {
          if (isSelectionMode) {
            onToggleSelection(bill.id);
          } else {
            void onOpenOptions(bill);
          }
        }}
      >
        <Card className={cn('border-0 shadow-sm', isSelectionMode && isSelected && 'ring-2 ring-primary')}>
          <CardContent className="flex items-center gap-4 p-4">
            {isSelectionMode ? (
              <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelection(bill.id)} />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold">{bill.description}</h3>
                  <p className="text-sm text-muted-foreground">{bill.category}</p>
                </div>
                <span className="text-base font-bold">{formatCurrency(bill.amount)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <Badge variant="outline" className={cn('border px-2 py-1 text-[10px] font-medium', getStatusClasses(bill))}>
                  {getDueDateLabel(bill)}
                </Badge>
                <span className="text-xs text-muted-foreground">{format(parseISO(bill.dueDate), 'dd/MM/yyyy')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function Home() {
  const bills = useStore((state) => state.bills);
  const categories = useStore((state) => state.categories);
  const fetchBills = useStore((state) => state.fetchBills);
  const fetchCategories = useStore((state) => state.fetchCategories);
  const updateBill = useStore((state) => state.updateBill);
  const deleteBill = useStore((state) => state.deleteBill);
  const markAsPaid = useStore((state) => state.markAsPaid);
  const markMultipleAsPaid = useStore((state) => state.markMultipleAsPaid);
  const { toast } = useToast();

  const [selectedBills, setSelectedBills] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [activeBill, setActiveBill] = useState<Bill | null>(null);
  const [drawerType, setDrawerType] = useState<'options' | 'schedule' | 'edit' | null>(null);
  const [editForm, setEditForm] = useState({ description: '', amount: '', dueDate: '', category: 'Outros' });

  useEffect(() => {
    void Promise.all([fetchBills(), fetchCategories()]);
  }, [fetchBills, fetchCategories]);

  const pendingBills = bills
    .filter((bill) => bill.status !== 'paid')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const totalPending = pendingBills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalPaidThisMonth = bills
    .filter((bill) => bill.status === 'paid' && bill.paidDate && isThisMonth(parseISO(bill.paidDate)))
    .reduce((sum, bill) => sum + bill.amount, 0);

  const toggleSelection = (id: string) => {
    setSelectedBills((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const triggerHaptic = async () => {
    await Haptics.impact({ style: ImpactStyle.Light });
  };

  const openOptions = async (bill: Bill) => {
    await triggerHaptic();
    setActiveBill(bill);
    setDrawerType('options');
  };

  const openSchedule = async (bill: Bill) => {
    await triggerHaptic();
    setActiveBill(bill);
    setDrawerType('schedule');
  };

  const handlePaySelected = async () => {
    if (selectedBills.length === 0) return;
    await markMultipleAsPaid(selectedBills);
    toast({ title: 'Contas pagas', description: `${selectedBills.length} conta(s) marcadas como pagas.` });
    setSelectedBills([]);
    setSelectionMode(false);
  };

  const handleSaveEdit = async () => {
    if (!activeBill) return;
    await updateBill(activeBill.id, {
      description: editForm.description,
      amount: Number(editForm.amount.replace(',', '.')),
      dueDate: new Date(editForm.dueDate).toISOString(),
      category: editForm.category,
    });
    toast({ title: 'Conta atualizada', description: 'Os dados da conta foram salvos.' });
    setDrawerType(null);
  };

  return (
    <div className="flex min-h-full flex-col pb-24">
      <header className="sticky top-0 z-10 rounded-b-3xl bg-primary px-6 pt-12 pb-5 text-primary-foreground shadow-lg">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PagAline</h1>
            <p className="text-sm text-primary-foreground/80">
              {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, (value) => value.toUpperCase())}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full text-primary-foreground hover:bg-primary-foreground/15">
            <Bell size={20} />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-none bg-primary-foreground/10 text-primary-foreground shadow-none">
            <CardContent className="p-4">
              <p className="text-xs text-primary-foreground/70">A pagar</p>
              <p className="mt-1 text-2xl font-bold">{formatCurrency(totalPending)}</p>
              <p className="text-[11px] text-primary-foreground/70">{pendingBills.length} contas pendentes</p>
            </CardContent>
          </Card>
          <Card className="border-none bg-primary-foreground text-primary shadow-none">
            <CardContent className="p-4">
              <p className="text-xs text-primary/70">Pago no mês</p>
              <p className="mt-1 text-2xl font-bold">{formatCurrency(totalPaidThisMonth)}</p>
              <p className="text-[11px] text-primary/60">Histórico do mês atual</p>
            </CardContent>
          </Card>
        </div>
      </header>

      <div className="flex items-center justify-between px-4 py-4">
        <div>
          <h2 className="text-lg font-bold">Próximos vencimentos</h2>
          <p className="text-sm text-muted-foreground">Deslize para pagar ou abrir agendamento.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setSelectionMode((value) => !value); setSelectedBills([]); }}>
          {selectionMode ? 'Cancelar' : 'Selecionar'}
        </Button>
      </div>

      {selectionMode ? (
        <div className="px-4 pb-3">
          <Button className="w-full" disabled={selectedBills.length === 0} onClick={handlePaySelected}>
            Marcar selecionadas como pagas ({selectedBills.length})
          </Button>
        </div>
      ) : null}

      <div className="space-y-3 px-4 pb-8">
        {pendingBills.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma conta pendente. Tudo certo por aqui.
            </CardContent>
          </Card>
        ) : (
          pendingBills.map((bill) => (
            <BillItem
              key={bill.id}
              bill={bill}
              isSelectionMode={selectionMode}
              isSelected={selectedBills.includes(bill.id)}
              onToggleSelection={toggleSelection}
              onPay={async (id) => {
                await markAsPaid(id);
                toast({ title: 'Conta paga', description: 'A conta foi movida para o histórico.' });
              }}
              onSchedule={(billToSchedule) => void openSchedule(billToSchedule)}
              onOpenOptions={(billToOpen) => openOptions(billToOpen)}
            />
          ))
        )}
      </div>

      <Drawer open={drawerType === 'options'} onOpenChange={(open) => !open && setDrawerType(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center justify-between gap-4">
              <span className="truncate">{activeBill?.description}</span>
              <span className="text-primary">{activeBill ? formatCurrency(activeBill.amount) : ''}</span>
            </DrawerTitle>
            <DrawerDescription>
              Categoria {activeBill?.category} • Vencimento {activeBill ? format(parseISO(activeBill.dueDate), 'dd/MM/yyyy') : ''}
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-2 p-4">
            <Button className="w-full justify-start" variant="outline" onClick={async () => {
              if (!activeBill) return;
              await markAsPaid(activeBill.id);
              toast({ title: 'Conta paga', description: 'A conta foi quitada com sucesso.' });
              setDrawerType(null);
            }}>
              <CheckCircle2 className="mr-3 text-success" size={18} /> Marcar como paga
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => activeBill && void openSchedule(activeBill)}>
              <CalendarIcon className="mr-3 text-primary" size={18} /> Agendar pagamento
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => {
              toast({ title: 'Anexar boleto', description: 'Esse fluxo segue como visual mockado nesta fase offline.' });
            }}>
              <FileText className="mr-3" size={18} /> Anexar boleto
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => {
              if (!activeBill) return;
              setEditForm({
                description: activeBill.description,
                amount: activeBill.amount.toString(),
                dueDate: activeBill.dueDate.slice(0, 10),
                category: activeBill.category,
              });
              setDrawerType('edit');
            }}>
              <Edit className="mr-3" size={18} /> Editar
            </Button>
            <Button className="w-full justify-start text-destructive" variant="outline" onClick={async () => {
              if (!activeBill) return;
              await deleteBill(activeBill.id);
              toast({ title: 'Conta excluída', description: 'O lançamento foi removido.', variant: 'destructive' });
              setDrawerType(null);
            }}>
              <Trash className="mr-3" size={18} /> Excluir
            </Button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="ghost"><MoreVertical className="mr-2" size={16} /> Fechar</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={drawerType === 'schedule'} onOpenChange={(open) => !open && setDrawerType(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Agendar pagamento</DrawerTitle>
            <DrawerDescription>Fluxo visual mantido como no web. O agendamento segue sem persistência, conforme requisito.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 p-4">
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                Para {activeBill?.description}, escolha a data do lembrete no fluxo futuro do produto.
              </CardContent>
            </Card>
            <Button className="w-full" onClick={() => {
              toast({ title: 'Agendamento salvo visualmente', description: 'A UI foi mantida, mas não há persistência nesta versão.' });
              setDrawerType(null);
            }}>
              Confirmar lembrete
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={drawerType === 'edit'} onOpenChange={(open) => !open && setDrawerType(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Editar conta</DrawerTitle>
            <DrawerDescription>Atualize os dados diretamente no banco local do app.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <Label htmlFor="home-description">Descrição</Label>
              <Input id="home-description" value={editForm.description} onChange={(event) => setEditForm((state) => ({ ...state, description: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="home-amount">Valor</Label>
              <Input id="home-amount" inputMode="decimal" value={editForm.amount} onChange={(event) => setEditForm((state) => ({ ...state, amount: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="home-due-date">Vencimento</Label>
              <Input id="home-due-date" type="date" value={editForm.dueDate} onChange={(event) => setEditForm((state) => ({ ...state, dueDate: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={editForm.category} onValueChange={(value) => setEditForm((state) => ({ ...state, category: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSaveEdit}>Salvar alterações</Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
