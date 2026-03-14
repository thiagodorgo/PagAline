import { useStore } from "@/lib/store";
import { format, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from "recharts";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Target } from "lucide-react";

// Updated more vibrant color palette for modern design
const COLORS = ['#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#ef4444', '#64748b'];

export default function Reports() {
  const bills = useStore((state) => state.bills);
  const monthlyGoal = useStore((state) => state.monthlyGoal);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Filter bills for the selected month
  const monthBills = bills.filter(bill => {
    const dateToUse = bill.status === 'paid' && bill.paidDate ? bill.paidDate : bill.dueDate;
    return isSameMonth(dateToUse, currentMonth);
  });

  const totalAmount = monthBills.reduce((sum, bill) => sum + bill.amount, 0);
  const paidAmount = monthBills.filter(b => b.status === 'paid').reduce((sum, bill) => sum + bill.amount, 0);
  const pendingAmount = totalAmount - paidAmount;
  
  const goalPercentage = Math.min((totalAmount / monthlyGoal) * 100, 100);

  // Prepare data for Pie Chart (Expenses by Category)
  const categoryData = monthBills.reduce((acc: any[], bill) => {
    const existing = acc.find(item => item.name === bill.category);
    if (existing) {
      existing.value += bill.amount;
    } else {
      acc.push({ name: bill.category, value: bill.amount });
    }
    return acc;
  }, []).sort((a, b) => b.value - a.value);

  // Prepare data for Bar Chart (Paid vs Pending)
  const statusData = [
    { name: 'Pago', valor: paidAmount, fill: 'hsl(var(--success))' },
    { name: 'Pendente', valor: pendingAmount, fill: 'hsl(var(--destructive))' }
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Custom Tooltip for Charts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover text-popover-foreground border border-border p-3 rounded-lg shadow-xl">
          <p className="font-medium text-sm mb-1">{payload[0].name}</p>
          <p className="font-bold text-lg text-primary">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col min-h-full pb-24">
      <header className="px-6 pt-12 pb-6 bg-card border-b border-border sticky top-0 z-10">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Resumo Mensal</h1>
        
        {/* Month Selector */}
        <div className="flex items-center justify-between bg-muted rounded-full p-1 border border-border/50">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-10 w-10 rounded-full hover:bg-background">
            <ChevronLeft size={20} />
          </Button>
          <span className="font-bold text-sm capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-10 w-10 rounded-full hover:bg-background">
            <ChevronRight size={20} />
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Goal Card - Elevated Design */}
        <Card className="bg-gradient-to-br from-primary/90 to-primary text-primary-foreground border-none shadow-lg overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <Target size={64} />
          </div>
          <CardContent className="p-5 relative z-10">
            <div className="flex justify-between items-end mb-4">
              <div>
                <p className="text-primary-foreground/80 text-sm font-medium mb-1">Gasto Total do Mês</p>
                <p className="text-3xl font-bold tracking-tight">{formatCurrency(totalAmount)}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-primary-foreground/90">
                <span>Progresso da Meta</span>
                <span>{formatCurrency(monthlyGoal)} limite</span>
              </div>
              <div className="h-2 w-full bg-primary-foreground/20 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${goalPercentage > 90 ? 'bg-red-400' : goalPercentage > 75 ? 'bg-orange-300' : 'bg-white'}`} 
                  style={{ width: `${goalPercentage}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-primary-foreground/70 font-medium">
                {goalPercentage >= 100 
                  ? "Você ultrapassou sua meta mensal!" 
                  : `Você usou ${Math.round(goalPercentage)}% da sua meta`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success mb-2">
                <TrendingDown size={20} />
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Total Pago</p>
              <p className="text-lg font-bold text-success">{formatCurrency(paidAmount)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-2">
                <TrendingUp size={20} />
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Pendente</p>
              <p className="text-lg font-bold">{formatCurrency(pendingAmount)}</p>
            </CardContent>
          </Card>
        </div>

        {totalAmount > 0 ? (
          <>
            {/* Category Chart - Redesigned */}
            <Card className="shadow-sm border-border">
              <CardHeader className="pb-0 pt-5">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <div className="w-2 h-6 bg-primary rounded-full"></div>
                  Onde você gastou
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-[220px] w-full relative">
                  <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-sm text-muted-foreground font-medium">Total</span>
                    <span className="font-bold text-lg">{formatCurrency(totalAmount)}</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="mt-6 grid grid-cols-1 gap-3">
                  {categoryData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="font-medium text-sm">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm">{formatCurrency(item.value)}</span>
                        <span className="text-muted-foreground text-xs font-medium bg-background px-2 py-1 rounded-md w-12 text-center">
                          {Math.round((item.value / totalAmount) * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Status Chart */}
            <Card className="shadow-sm border-border">
              <CardHeader className="pb-2 pt-5">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <div className="w-2 h-6 bg-primary rounded-full"></div>
                  Balanço do Mês
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-[120px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: 'hsl(var(--foreground))', fontWeight: 500 }} />
                      <RechartsTooltip content={<CustomTooltip />} cursor={{fill: 'hsl(var(--muted))', opacity: 0.5}} />
                      <Bar dataKey="valor" radius={[0, 8, 8, 0]} barSize={28}>
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-16 px-4 bg-muted/30 rounded-2xl border border-border border-dashed">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingDown size={24} className="text-muted-foreground" />
            </div>
            <p className="font-bold text-lg mb-1">Nenhum dado encontrado</p>
            <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">Não há contas registradas para o mês de {format(currentMonth, "MMMM", { locale: ptBR })}.</p>
          </div>
        )}
      </div>
    </div>
  );
}
