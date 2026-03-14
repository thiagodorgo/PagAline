import { useStore, Bill } from "@/lib/store";
import { format, isToday, isTomorrow, isPast, isThisMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, Search, Plus, Filter, CheckCircle2, AlertCircle, Clock, MoreVertical, Check, Calendar as CalendarIcon, Edit, Trash, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, useAnimation, PanInfo } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";

// Format functions outside component to be shared
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

const getStatusColor = (date: Date, status: string) => {
  if (status === 'paid') return 'text-success bg-success/10 border-success/20';
  if (isPast(date) && !isToday(date)) return 'text-destructive bg-destructive/10 border-destructive/20';
  if (isToday(date) || isTomorrow(date)) return 'text-warning bg-warning/10 border-warning/20';
  return 'text-muted-foreground bg-muted border-border';
};

function BillItem({ 
  bill, 
  isSelectionMode, 
  isSelected, 
  toggleSelection, 
  onPay, 
  onSchedule, 
  onLongPress 
}: { 
  bill: Bill;
  isSelectionMode: boolean;
  isSelected: boolean;
  toggleSelection: (id: string) => void;
  onPay: (id: string) => void;
  onSchedule: (bill: Bill) => void;
  onLongPress: (bill: Bill) => void;
}) {
  const controls = useAnimation();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Custom hook fix: use drag controls locally to trigger UI updates without error
  const [dragOffset, setDragOffset] = useState(0);

  const handleTouchStart = () => {
    if (isSelectionMode) return;
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
    
    // Increased threshold for dragging, velocity still matters for fast swipes
    if (info.offset.x > threshold || (info.offset.x > 30 && velocity > 500)) {
      controls.start({ x: 500, transition: { duration: 0.2 } }).then(() => {
        onPay(bill.id);
        controls.set({ x: 0 }); // Reset position for future renders
      });
    } else if (info.offset.x < -threshold || (info.offset.x < -30 && velocity < -500)) {
      onSchedule(bill);
      controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } });
    } else {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } });
    }
  };

  return (
    <div className="relative rounded-xl overflow-hidden bg-muted mb-3">
      {/* Background actions (Swipe) */}
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
      
      <motion.div
        drag={!isSelectionMode ? "x" : false}
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
        whileTap={!isSelectionMode ? { scale: 0.98 } : {}}
        onClick={() => {
          if (!isSelectionMode) {
             onLongPress(bill);
          }
        }}
      >
        <Card className={cn(
          "overflow-hidden transition-colors duration-200 cursor-pointer shadow-sm border-0",
          isSelectionMode && isSelected ? "border-2 border-primary bg-primary/5" : ""
        )}
        onClick={() => {
          if (isSelectionMode) toggleSelection(bill.id);
        }}>
          <CardContent className="p-0">
            <div className="flex items-center p-4 bg-card h-[88px]">
              {isSelectionMode && (
                <div className="pr-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox 
                    checked={isSelected}
                    onCheckedChange={() => toggleSelection(bill.id)}
                    className="h-5 w-5 rounded-full"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-base truncate pr-2">{bill.description}</h3>
                  <span className="font-bold text-base whitespace-nowrap">{formatCurrency(bill.amount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="truncate max-w-[120px]">{bill.category}</span>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] font-medium px-2 py-0.5 border", getStatusColor(bill.dueDate, bill.status))}>
                    {getDueDateLabel(bill.dueDate, bill.status)}
                  </Badge>
                </div>
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
  const markAsPaid = useStore((state) => state.markAsPaid);
  const markMultipleAsPaid = useStore((state) => state.markMultipleAsPaid);
  const deleteBill = useStore((state) => state.deleteBill);
  const { toast } = useToast();
  
  const [selectedBills, setSelectedBills] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Drawer states
  const [activeBill, setActiveBill] = useState<Bill | null>(null);
  const [drawerType, setDrawerType] = useState<'schedule' | 'options' | 'edit' | null>(null);
  
  const [editForm, setEditForm] = useState({
    description: '',
    amount: '',
    dueDate: '',
    category: ''
  });
  
  const categories = useStore((state) => state.categories);
  const updateBill = useStore((state) => state.updateBill);

  const pendingBills = bills.filter(b => b.status !== 'paid').sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  
  const totalPending = pendingBills.reduce((acc, bill) => acc + bill.amount, 0);
  const totalPaidThisMonth = bills.filter(b => b.status === 'paid' && isThisMonth(b.paidDate || new Date())).reduce((acc, bill) => acc + bill.amount, 0);

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedBills([]);
  };

  const toggleBillSelection = (id: string) => {
    setSelectedBills(prev => 
      prev.includes(id) ? prev.filter(bId => bId !== id) : [...prev, id]
    );
  };

  const handlePaySelected = () => {
    if (selectedBills.length === 0) return;
    
    markMultipleAsPaid(selectedBills);
    toast({
      title: "Contas pagas",
      description: `${selectedBills.length} conta(s) marcadas como pagas com sucesso.`,
    });
    setIsSelectionMode(false);
    setSelectedBills([]);
  };

  const handlePaySingle = (id: string) => {
    markAsPaid(id);
    toast({
      title: "Conta paga",
      description: "A conta foi marcada como paga e movida para o histórico.",
    });
  };

  const handleSchedule = (bill: Bill) => {
    setActiveBill(bill);
    setDrawerType('schedule');
  };

  const handleLongPress = (bill: Bill) => {
    if (!isSelectionMode) {
      setActiveBill(bill);
      setDrawerType('options');
      // Trigger haptic feedback if available
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
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
      {/* Header / Top App Bar */}
      <header className="px-6 pt-12 pb-4 bg-primary text-primary-foreground rounded-b-3xl shadow-md sticky top-0 z-10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PagAline</h1>
            <p className="text-primary-foreground/80 text-sm">{format(new Date(), "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())}</p>
          </div>
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20 rounded-full h-10 w-10">
            <Bell size={20} />
          </Button>
        </div>

        {/* Dashboard KPIs */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-primary-foreground/10 border-none text-primary-foreground shadow-none">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-primary-foreground/70 mb-1">A Pagar</p>
              <p className="text-xl font-bold">{formatCurrency(totalPending)}</p>
              <p className="text-[10px] mt-1 text-primary-foreground/60">{pendingBills.length} contas pendentes</p>
            </CardContent>
          </Card>
          <Card className="bg-primary-foreground/10 border-none text-primary-foreground shadow-none">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-primary-foreground/70 mb-1">Pago no Mês</p>
              <p className="text-xl font-bold">{formatCurrency(totalPaidThisMonth)}</p>
            </CardContent>
          </Card>
        </div>
      </header>

      {/* Action Bar */}
      <div className="px-6 py-4 flex items-center justify-between">
        {isSelectionMode ? (
          <div className="flex items-center justify-between w-full animate-in fade-in">
            <span className="text-sm font-medium">{selectedBills.length} selecionadas</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={toggleSelectionMode}>Cancelar</Button>
              <Button size="sm" onClick={handlePaySelected} disabled={selectedBills.length === 0} className="gap-1">
                <Check size={16} /> Pagar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full animate-in fade-in">
            <h2 className="text-lg font-semibold tracking-tight">Próximos Vencimentos</h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <Search size={18} />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <Filter size={18} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <MoreVertical size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={toggleSelectionMode}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Selecionar várias
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </div>

      {/* Pending Bills List */}
      <div className="px-4 flex-1">
        {pendingBills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={32} className="text-success" />
            </div>
            <p className="font-medium">Tudo em dia!</p>
            <p className="text-sm mt-1 max-w-[200px]">Você não tem nenhuma conta pendente no momento.</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground mb-4 ml-2 italic">Dica: Toque para ver opções ou deslize para pagar.</p>
            {pendingBills.map((bill) => (
              <BillItem
                key={bill.id}
                bill={bill}
                isSelectionMode={isSelectionMode}
                isSelected={selectedBills.includes(bill.id)}
                toggleSelection={toggleBillSelection}
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
