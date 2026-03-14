import { useState, useRef } from "react";
import { useStore, Bill } from "@/lib/store";
import { format, isSameMonth, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Filter, Search, CheckCircle2, Calendar as CalendarIcon, Edit, Trash, Paperclip, FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, useAnimation, PanInfo } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer";

// Reusing the same formatter
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const getDueDateLabel = (date: Date, status: string) => {
  if (status === 'paid') return 'Pago';
  if (isPast(date) && !isToday(date)) return 'Vencido';
  if (isToday(date)) return 'Vence hoje';
  if (isTomorrow(date)) return 'Vence amanhã';
  return `Vence em ${format(date, "dd MMM", { locale: ptBR })}`;
};

function BillItemWithSwipe({ 
  bill, 
  onPay, 
  onSchedule, 
  onLongPress 
}: { 
  bill: Bill;
  onPay: (id: string) => void;
  onSchedule: (bill: Bill) => void;
  onLongPress: (bill: Bill) => void;
}) {
  const controls = useAnimation();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const handleTouchStart = () => {
    timerRef.current = setTimeout(() => {
      onLongPress(bill);
    }, 2000);
  };

  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleDragStart = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleDrag = (e: any, info: PanInfo) => {
    setDragOffset(info.offset.x);
  };

  const handleDragEnd = async (e: any, info: PanInfo) => {
    const threshold = 100;
    const velocity = info.velocity.x;
    setDragOffset(0);
    
    if (info.offset.x > threshold || (info.offset.x > 30 && velocity > 500)) {
      if (bill.status !== 'paid') {
        controls.start({ x: 500, transition: { duration: 0.2 } }).then(() => {
          onPay(bill.id);
          controls.set({ x: 0 });
        });
      } else {
        controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } });
      }
    } else if (info.offset.x < -threshold || (info.offset.x < -30 && velocity < -500)) {
      if (bill.status !== 'paid') {
        onSchedule(bill);
        controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } });
      } else {
        controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } });
      }
    } else {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } });
    }
  };

  const getStatusBadge = (bill: Bill) => {
    if (bill.status === 'paid') {
      return <Badge variant="outline" className="text-success border-success/30 bg-success/10">Pago</Badge>;
    }
    if (bill.status === 'overdue') {
      return <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">Vencido</Badge>;
    }
    return <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10">Pendente</Badge>;
  };

  return (
    <div className="relative rounded-xl overflow-hidden bg-muted mb-3">
      {/* Background actions (Swipe) - Only show if not paid */}
      {bill.status !== 'paid' && (
        <div className="absolute inset-0 flex justify-between items-center px-6">
          <div className={cn("flex items-center gap-2 font-medium transition-opacity", dragOffset > 40 ? "text-success opacity-100" : "text-muted-foreground opacity-50")}>
            <CheckCircle2 size={22} />
            <span className="text-sm">Pagar</span>
          </div>
          <div className={cn("flex items-center gap-2 font-medium transition-opacity", dragOffset < -40 ? "text-primary opacity-100" : "text-muted-foreground opacity-50")}>
            <span className="text-sm">Agendar</span>
            <CalendarIcon size={22} />
          </div>
        </div>
      )}
      
      <motion.div
        drag={bill.status !== 'paid' ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={controls}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
        className="relative z-10 touch-pan-y"
        whileTap={{ scale: 0.98 }}
        onClick={() => onLongPress(bill)}
      >
        <Card className="overflow-hidden border-0 shadow-sm cursor-pointer">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <h3 className="font-semibold text-base truncate mb-1">{bill.description}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{bill.category}</span>
                <span>•</span>
                <span>Venc: {format(bill.dueDate, "dd/MM", { locale: ptBR })}</span>
                {bill.status === 'paid' && (
                  <>
                    <span>•</span>
                    <Paperclip size={12} className="text-primary" />
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="font-bold text-base">{formatCurrency(bill.amount)}</span>
              {getStatusBadge(bill)}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function Bills() {
  const bills = useStore((state) => state.bills);
  const markAsPaid = useStore((state) => state.markAsPaid);
  const deleteBill = useStore((state) => state.deleteBill);
  const { toast } = useToast();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState("all");
  
  // Drawer states
  const [activeBill, setActiveBill] = useState<Bill | null>(null);
  const [drawerType, setDrawerType] = useState<'schedule' | 'options' | 'receipt' | 'edit' | null>(null);

  const [editForm, setEditForm] = useState({
    description: '',
    amount: '',
    dueDate: '',
    category: ''
  });
  
  const categories = useStore((state) => state.categories);
  const updateBill = useStore((state) => state.updateBill);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthBills = bills.filter(bill => {
    // For pending bills, use due date. For paid bills, use paid date or due date if paid date is missing.
    const dateToUse = bill.status === 'paid' && bill.paidDate ? bill.paidDate : bill.dueDate;
    return isSameMonth(dateToUse, currentMonth);
  });

  const filteredBills = monthBills.filter(bill => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return bill.status !== "paid";
    if (activeTab === "paid") return bill.status === "paid";
    return true;
  }).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const handlePaySingle = (id: string) => {
    markAsPaid(id);
    toast({
      title: "Conta paga",
      description: "A conta foi marcada como paga e atualizada no histórico.",
    });
  };

  const handleSchedule = (bill: Bill) => {
    setActiveBill(bill);
    setDrawerType('schedule');
  };

  const handleLongPress = (bill: Bill) => {
    setActiveBill(bill);
    setDrawerType('options');
    // Trigger haptic feedback if available
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(50);
    }
  };

  const handleDelete = () => {
    if (activeBill) {
      deleteBill(activeBill.id);
      toast({
        title: "Conta excluída",
        description: "A conta foi removida com sucesso.",
        variant: "destructive"
      });
      setDrawerType(null);
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24">
      <header className="px-6 pt-12 pb-4 bg-card border-b border-border sticky top-0 z-10">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Contas e Histórico</h1>
        
        {/* Month Selector */}
        <div className="flex items-center justify-between bg-muted/50 rounded-full p-1 mb-4">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 rounded-full">
            <ChevronLeft size={18} />
          </Button>
          <span className="font-semibold text-sm capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 rounded-full">
            <ChevronRight size={18} />
          </Button>
        </div>

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="paid">Pagas</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <div className="px-4 py-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Buscar contas..." 
            className="w-full pl-9 pr-4 py-2 bg-muted border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <Button variant="outline" size="icon" className="shrink-0 rounded-xl border-border">
          <Filter size={18} />
        </Button>
      </div>

      <div className="px-4 flex-1">
        {filteredBills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <p className="font-medium">Nenhuma conta encontrada</p>
            <p className="text-sm mt-1">Nenhum registro para este período ou filtro.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {activeTab !== 'paid' && filteredBills.some(b => b.status !== 'paid') && (
              <p className="text-xs text-muted-foreground mb-4 ml-2 italic">Dica: Toque para ver opções ou deslize para pagar.</p>
            )}
            {filteredBills.map((bill) => (
              <BillItemWithSwipe 
                key={bill.id} 
                bill={bill}
                onPay={handlePaySingle}
                onSchedule={handleSchedule}
                onLongPress={handleLongPress}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drawers */}
      <Drawer open={drawerType === 'options'} onOpenChange={(open) => !open && setDrawerType(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex justify-between items-center">
              <span>{activeBill?.description}</span>
              <span className="text-primary font-bold">{activeBill && formatCurrency(activeBill.amount)}</span>
            </DrawerTitle>
            <DrawerDescription>
              Categoria: {activeBill?.category} • Vencimento: {activeBill && format(activeBill.dueDate, "dd/MM/yyyy")}
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 flex flex-col gap-2">
            {activeBill?.status !== 'paid' ? (
              <>
                <Button variant="outline" className="justify-start text-base py-6" onClick={() => {
                  handlePaySingle(activeBill!.id);
                  setDrawerType(null);
                }}>
                  <CheckCircle2 className="mr-3 text-success" size={20} />
                  Marcar como Paga
                </Button>
                <Button variant="outline" className="justify-start text-base py-6" onClick={() => {
                  setDrawerType('schedule');
                }}>
                  <CalendarIcon className="mr-3 text-primary" size={20} />
                  Agendar Pagamento
                </Button>
                <Button variant="outline" className="justify-start text-base py-6" onClick={() => {
                  toast({
                    title: "Em desenvolvimento",
                    description: "A funcionalidade de adicionar boleto estará disponível na próxima versão.",
                  });
                }}>
                  <FileText className="mr-3 text-muted-foreground" size={20} />
                  Anexar Boleto / PDF
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="justify-start text-base py-6 bg-success/5 border-success/20 text-success hover:bg-success/10" onClick={() => {
                  setDrawerType('receipt');
                }}>
                  <FileText className="mr-3" size={20} />
                  Ver Comprovante
                </Button>
              </>
            )}
            
            <Button variant="outline" className="justify-start text-base py-6" onClick={() => {
              if (activeBill) {
                setEditForm({
                  description: activeBill.description,
                  amount: activeBill.amount.toString(),
                  dueDate: new Date(activeBill.dueDate).toISOString().split('T')[0],
                  category: activeBill.category
                });
                setDrawerType('edit');
              }
            }}>
              <Edit className="mr-3 text-muted-foreground" size={20} />
              Editar Conta
            </Button>
            <Button variant="outline" className="justify-start text-base py-6 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20" onClick={handleDelete}>
              <Trash className="mr-3" size={20} />
              Excluir Conta
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={drawerType === 'schedule'} onOpenChange={(open) => !open && setDrawerType(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Agendar Pagamento</DrawerTitle>
            <DrawerDescription>{activeBill?.description}</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data do Agendamento</label>
              <input 
                type="date" 
                className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50"
                defaultValue={activeBill ? new Date(activeBill.dueDate).toISOString().split('T')[0] : ''}
              />
            </div>
            <Button className="w-full py-6 text-lg rounded-2xl" onClick={() => {
              toast({
                title: "Pagamento agendado",
                description: "O pagamento foi agendado para a data selecionada.",
              });
              setDrawerType(null);
            }}>
              Confirmar Agendamento
            </Button>
            <DrawerClose asChild>
              <Button variant="ghost" className="w-full">Cancelar</Button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Comprovante Mock Drawer */}
      <Drawer open={drawerType === 'receipt'} onOpenChange={(open) => !open && setDrawerType(null)}>
        <DrawerContent className="h-[85vh]">
          <DrawerHeader className="border-b border-border pb-4">
            <DrawerTitle>Comprovante de Pagamento</DrawerTitle>
            <DrawerDescription>Salvo em {activeBill?.paidDate ? format(activeBill.paidDate, "dd/MM/yyyy HH:mm") : 'Data não disponível'}</DrawerDescription>
          </DrawerHeader>
          <div className="p-6 flex flex-col items-center justify-center gap-6 h-full overflow-y-auto">
            <div className="bg-muted w-full max-w-sm rounded-xl p-6 border border-border shadow-sm flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-success"></div>
              
              <div className="flex flex-col items-center justify-center pb-6 border-b border-border border-dashed">
                <div className="w-12 h-12 bg-success/20 text-success rounded-full flex items-center justify-center mb-3">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="font-bold text-lg">Pagamento Concluído</h3>
                <p className="text-3xl font-black mt-2">{activeBill ? formatCurrency(activeBill.amount) : ''}</p>
              </div>
              
              <div className="py-6 space-y-4">
                <div className="flex justify-between items-start">
                  <span className="text-sm text-muted-foreground">Beneficiário</span>
                  <span className="text-sm font-medium text-right max-w-[150px]">{activeBill?.description}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Instituição</span>
                  <span className="text-sm font-medium">Banco Genérico S.A.</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Data do Pagamento</span>
                  <span className="text-sm font-medium">{activeBill?.paidDate ? format(activeBill.paidDate, "dd/MM/yyyy") : ''}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-muted-foreground">Código</span>
                  <span className="text-xs font-mono bg-background p-1 rounded max-w-[150px] break-all text-right text-muted-foreground">
                    00000.00000 00000.000000 00000.000000 0 00000000000000
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Autenticação</span>
                  <span className="text-xs font-mono">A1B2C3D4E5F6G7H8</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 w-full max-w-sm mt-auto">
              <Button variant="outline" className="flex-1 gap-2">
                <Download size={18} />
                Baixar
              </Button>
              <Button className="flex-1 gap-2">
                Compartilhar
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={drawerType === 'edit'} onOpenChange={(open) => !open && setDrawerType(null)}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Editar Conta</DrawerTitle>
            <DrawerDescription>Atualize os dados da conta abaixo.</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-4 overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Descrição</label>
              <input 
                type="text" 
                value={editForm.description}
                onChange={e => setEditForm({...editForm, description: e.target.value})}
                className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-medium"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={editForm.amount}
                  onChange={e => setEditForm({...editForm, amount: e.target.value})}
                  className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-bold text-lg"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Vencimento</label>
                <input 
                  type="date" 
                  value={editForm.dueDate}
                  onChange={e => setEditForm({...editForm, dueDate: e.target.value})}
                  className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Categoria</label>
              <select 
                value={editForm.category}
                onChange={e => setEditForm({...editForm, category: e.target.value})}
                className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-medium"
              >
                {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <Button className="w-full py-6 text-lg rounded-2xl mt-4" onClick={() => {
              if (activeBill) {
                updateBill(activeBill.id, {
                  description: editForm.description,
                  amount: parseFloat(editForm.amount) || 0,
                  dueDate: editForm.dueDate ? new Date(editForm.dueDate) : activeBill.dueDate,
                  category: editForm.category
                });
                toast({
                  title: "Conta atualizada",
                  description: "Os dados da conta foram salvos.",
                });
                setDrawerType(null);
              }
            }}>
              Salvar Alterações
            </Button>
            <DrawerClose asChild>
              <Button variant="ghost" className="w-full">Cancelar</Button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
