import { useEffect, useRef, useState } from 'react';
import { format, isSameMonth, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  FileText,
  Paperclip,
  Search,
  Share2,
  Trash,
} from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useStore, type Bill } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const isOverdue = (bill: Bill) => bill.status === 'pending' && parseISO(bill.dueDate) < startOfDay(new Date());

function SwipeBillItem({ bill, onPay, onSchedule, onOpen }: { bill: Bill; onPay: (id: string) => void; onSchedule: (bill: Bill) => void; onOpen: (bill: Bill) => void; }) {
  const controls = useAnimation();
  const [dragOffset, setDragOffset] = useState(0);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startPress = () => {
    timerRef.current = window.setTimeout(() => onOpen(bill), 2000);
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    clearTimer();
    setDragOffset(0);

    if (bill.status !== 'paid' && (info.offset.x > 100 || (info.offset.x > 30 && info.velocity.x > 500))) {
      void controls.start({ x: 500, transition: { duration: 0.2 } }).then(() => {
        onPay(bill.id);
        controls.set({ x: 0 });
      });
      return;
    }

    if (bill.status !== 'paid' && (info.offset.x < -100 || (info.offset.x < -30 && info.velocity.x < -500))) {
      onSchedule(bill);
    }

    void controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } });
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-muted">
      {bill.status !== 'paid' ? (
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
      ) : null}
      <motion.div
        drag={bill.status !== 'paid' ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        animate={controls}
        onDrag={(_, info) => setDragOffset(info.offset.x)}
        onDragStart={clearTimer}
        onDragEnd={handleDragEnd}
        onTouchStart={startPress}
        onTouchEnd={clearTimer}
        onMouseDown={startPress}
        onMouseUp={clearTimer}
        onMouseLeave={clearTimer}
        className="relative z-10 touch-pan-y"
        whileTap={{ scale: 0.985 }}
        onClick={() => onOpen(bill)}
      >
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold">{bill.description}</h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{bill.category}</span>
                <span>•</span>
                <span>{format(parseISO(bill.status === 'paid' && bill.paidDate ? bill.paidDate : bill.dueDate), 'dd/MM/yyyy')}</span>
                {bill.status === 'paid' ? <Paperclip size={12} className="text-primary" /> : null}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="font-bold">{formatCurrency(bill.amount)}</span>
              <Badge variant="outline" className={cn(
                bill.status === 'paid' && 'border-success/20 bg-success/10 text-success',
                bill.status !== 'paid' && isOverdue(bill) && 'border-destructive/20 bg-destructive/10 text-destructive',
                bill.status === 'pending' && !isOverdue(bill) && 'border-warning/20 bg-warning/10 text-warning',
              )}>
                {bill.status === 'paid' ? 'Pago' : isOverdue(bill) ? 'Vencido' : 'Pendente'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function Bills() {
  const bills = useStore((state) => state.bills);
  const categories = useStore((state) => state.categories);
  const fetchBills = useStore((state) => state.fetchBills);
  const fetchCategories = useStore((state) => state.fetchCategories);
  const markAsPaid = useStore((state) => state.markAsPaid);
  const deleteBill = useStore((state) => state.deleteBill);
  const updateBill = useStore((state) => state.updateBill);
  const { toast } = useToast();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'paid'>('all');
  const [query, setQuery] = useState('');
  const [activeBill, setActiveBill] = useState<Bill | null>(null);
  const [drawerType, setDrawerType] = useState<'options' | 'schedule' | 'edit' | 'receipt' | null>(null);
  const [editForm, setEditForm] = useState({ description: '', amount: '', dueDate: '', category: 'Outros' });

  useEffect(() => {
    void Promise.all([fetchBills(), fetchCategories()]);
  }, [fetchBills, fetchCategories]);

  const monthBills = bills.filter((bill) => {
    const comparisonDate = bill.status === 'paid' && bill.paidDate ? parseISO(bill.paidDate) : parseISO(bill.dueDate);
    return isSameMonth(comparisonDate, currentMonth);
  });

  const filteredBills = monthBills
    .filter((bill) => {
      if (activeTab === 'pending' && bill.status === 'paid') return false;
      if (activeTab === 'paid' && bill.status !== 'paid') return false;
      return bill.description.toLowerCase().includes(query.toLowerCase());
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const vibrate = async () => {
    await Haptics.impact({ style: ImpactStyle.Light });
  };

  const openOptions = async (bill: Bill) => {
    await vibrate();
    setActiveBill(bill);
    setDrawerType('options');
  };

  const openSchedule = async (bill: Bill) => {
    await vibrate();
    setActiveBill(bill);
    setDrawerType('schedule');
  };

  return (
    <div className="flex min-h-full flex-col pb-24">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-6 pt-12 pb-4">
        <h1 className="mb-4 text-2xl font-bold tracking-tight">Contas e histórico</h1>
        <div className="mb-4 flex items-center justify-between rounded-full bg-muted p-1">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>
            <ChevronLeft size={18} />
          </Button>
          <span className="text-sm font-semibold capitalize">{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>
            <ChevronRight size={18} />
          </Button>
        </div>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'all' | 'pending' | 'paid')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="paid">Pagas</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <div className="flex items-center gap-3 px-4 py-4">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar contas..." className="pl-9" />
        </div>
      </div>

      <div className="space-y-3 px-4 pb-8">
        {filteredBills.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhuma conta encontrada para este período.</CardContent>
          </Card>
        ) : (
          filteredBills.map((bill) => (
            <SwipeBillItem
              key={bill.id}
              bill={bill}
              onPay={async (id) => {
                await markAsPaid(id);
                toast({ title: 'Conta paga', description: 'O histórico foi atualizado.' });
              }}
              onSchedule={(selectedBill) => void openSchedule(selectedBill)}
              onOpen={(selectedBill) => void openOptions(selectedBill)}
            />
          ))
        )}
      </div>

      <Drawer open={drawerType === 'options'} onOpenChange={(open) => !open && setDrawerType(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{activeBill?.description}</DrawerTitle>
            <DrawerDescription>{activeBill ? `${activeBill.category} • ${formatCurrency(activeBill.amount)}` : ''}</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-2 p-4">
            {activeBill?.status !== 'paid' ? (
              <>
                <Button className="w-full justify-start" variant="outline" onClick={async () => {
                  if (!activeBill) return;
                  await markAsPaid(activeBill.id);
                  toast({ title: 'Conta paga', description: 'A conta foi atualizada no histórico.' });
                  setDrawerType(null);
                }}>
                  <CheckCircle2 className="mr-3 text-success" size={18} /> Marcar como paga
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => activeBill && void openSchedule(activeBill)}>
                  <CalendarIcon className="mr-3 text-primary" size={18} /> Agendar pagamento
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => toast({ title: 'Anexar boleto', description: 'Função visual mantida, sem integração adicional.' })}>
                  <FileText className="mr-3" size={18} /> Anexar boleto / PDF
                </Button>
              </>
            ) : (
              <Button className="w-full justify-start" variant="outline" onClick={() => setDrawerType('receipt')}>
                <FileText className="mr-3" size={18} /> Ver comprovante
              </Button>
            )}
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
              toast({ title: 'Conta excluída', description: 'A conta foi removida.', variant: 'destructive' });
              setDrawerType(null);
            }}>
              <Trash className="mr-3" size={18} /> Excluir
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={drawerType === 'schedule'} onOpenChange={(open) => !open && setDrawerType(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Agendamento visual</DrawerTitle>
            <DrawerDescription>O fluxo foi mantido, mas a regra continua sem persistência local.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 p-4">
            <Input type="date" defaultValue={activeBill?.dueDate.slice(0, 10)} />
            <Button className="w-full" onClick={() => {
              toast({ title: 'Agendamento registrado', description: 'A interface foi preservada conforme a versão web.' });
              setDrawerType(null);
            }}>Salvar</Button>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={drawerType === 'edit'} onOpenChange={(open) => !open && setDrawerType(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Editar conta</DrawerTitle>
            <DrawerDescription>Atualização direta no banco SQLite local.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={editForm.description} onChange={(event) => setEditForm((state) => ({ ...state, description: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input value={editForm.amount} onChange={(event) => setEditForm((state) => ({ ...state, amount: event.target.value }))} inputMode="decimal" />
            </div>
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Input type="date" value={editForm.dueDate} onChange={(event) => setEditForm((state) => ({ ...state, dueDate: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={editForm.category} onValueChange={(value) => setEditForm((state) => ({ ...state, category: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={async () => {
              if (!activeBill) return;
              await updateBill(activeBill.id, {
                description: editForm.description,
                amount: Number(editForm.amount.replace(',', '.')),
                dueDate: new Date(editForm.dueDate).toISOString(),
                category: editForm.category,
              });
              toast({ title: 'Conta atualizada', description: 'As alterações foram salvas.' });
              setDrawerType(null);
            }}>Salvar alterações</Button>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={drawerType === 'receipt'} onOpenChange={(open) => !open && setDrawerType(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Comprovante de pagamento</DrawerTitle>
            <DrawerDescription>Visual mockado mantido conforme a versão web.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 p-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Conta</span><span>{activeBill?.description}</span></div>
                <div className="flex justify-between"><span>Categoria</span><span>{activeBill?.category}</span></div>
                <div className="flex justify-between"><span>Valor</span><span>{activeBill ? formatCurrency(activeBill.amount) : ''}</span></div>
                <div className="flex justify-between"><span>Pago em</span><span>{activeBill?.paidDate ? format(parseISO(activeBill.paidDate), 'dd/MM/yyyy HH:mm') : '-'}</span></div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => toast({ title: 'Compartilhar', description: 'A ação segue como mock visual nesta fase.' })}>
                <Share2 className="mr-2" size={16} /> Compartilhar
              </Button>
              <Button variant="outline" onClick={() => toast({ title: 'Baixar', description: 'A exportação do comprovante ainda é visual mockada.' })}>
                <Download className="mr-2" size={16} /> Baixar
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
