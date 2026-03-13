import { useState } from "react";
import { useStore, Bill } from "@/lib/store";
import { format, isSameMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Filter, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Bills() {
  const bills = useStore((state) => state.bills);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState("all");

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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
    <div className="flex flex-col min-h-full">
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

      <div className="px-4 pb-8 flex-1">
        {filteredBills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <p className="font-medium">Nenhuma conta encontrada</p>
            <p className="text-sm mt-1">Nenhum registro para este período ou filtro.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBills.map((bill) => (
              <Card key={bill.id} className="overflow-hidden">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="font-semibold text-base truncate mb-1">{bill.description}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{bill.category}</span>
                      <span>•</span>
                      <span>Venc: {format(bill.dueDate, "dd/MM", { locale: ptBR })}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="font-bold text-base">{formatCurrency(bill.amount)}</span>
                    {getStatusBadge(bill)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
