import { useStore, Bill } from "@/lib/store";
import { format, isToday, isTomorrow, isPast, isThisMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, Search, Plus, Filter, CheckCircle2, AlertCircle, Clock, MoreVertical, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

export default function Home() {
  const bills = useStore((state) => state.bills);
  const markAsPaid = useStore((state) => state.markAsPaid);
  const markMultipleAsPaid = useStore((state) => state.markMultipleAsPaid);
  const { toast } = useToast();
  
  const [selectedBills, setSelectedBills] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const pendingBills = bills.filter(b => b.status !== 'paid').sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  
  const totalPending = pendingBills.reduce((acc, bill) => acc + bill.amount, 0);
  const totalPaidThisMonth = bills.filter(b => b.status === 'paid' && isThisMonth(b.paidDate || new Date())).reduce((acc, bill) => acc + bill.amount, 0);

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

  return (
    <div className="flex flex-col min-h-full">
      {/* Header / Top App Bar */}
      <header className="px-6 pt-12 pb-4 bg-primary text-primary-foreground rounded-b-3xl shadow-md sticky top-0 z-10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PayFlow</h1>
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
      <div className="px-4 pb-8 flex-1">
        {pendingBills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={32} className="text-success" />
            </div>
            <p className="font-medium">Tudo em dia!</p>
            <p className="text-sm mt-1 max-w-[200px]">Você não tem nenhuma conta pendente no momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingBills.map((bill) => (
              <Card key={bill.id} className={cn(
                "overflow-hidden transition-all duration-200",
                isSelectionMode && selectedBills.includes(bill.id) ? "border-primary bg-primary/5" : ""
              )}>
                <CardContent className="p-0">
                  <div className="flex items-center p-4">
                    {isSelectionMode && (
                      <div className="pr-4">
                        <Checkbox 
                          checked={selectedBills.includes(bill.id)}
                          onCheckedChange={() => toggleBillSelection(bill.id)}
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
                  
                  {/* Quick actions shown below the card or on swipe (mocked as below card for now) */}
                  {!isSelectionMode && (
                    <div className="bg-muted/30 px-4 py-2 flex justify-end gap-2 border-t border-border/50">
                      <Button variant="ghost" size="sm" className="h-8 text-xs font-medium px-3 text-muted-foreground">
                        Editar
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="h-8 text-xs font-medium px-4 gap-1"
                        onClick={() => handlePaySingle(bill.id)}
                      >
                        <Check size={14} /> Pagar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
