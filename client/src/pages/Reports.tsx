import { useStore } from "@/lib/store";
import { format, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from "recharts";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];

export default function Reports() {
  const bills = useStore((state) => state.bills);
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
    { name: 'Pago', valor: paidAmount, fill: '#10b981' },
    { name: 'Pendente', valor: pendingAmount, fill: '#f43f5e' }
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-12 pb-4 bg-card border-b border-border sticky top-0 z-10">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Relatórios</h1>
        
        {/* Month Selector */}
        <div className="flex items-center justify-between bg-muted/50 rounded-full p-1">
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
      </header>

      <div className="p-4 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-primary text-primary-foreground border-none">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-primary-foreground/70 mb-1">Total do Mês</p>
              <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Total Pago</p>
              <p className="text-xl font-bold text-success">{formatCurrency(paidAmount)}</p>
            </CardContent>
          </Card>
        </div>

        {totalAmount > 0 ? (
          <>
            {/* Category Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Despesas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {categoryData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold">{formatCurrency(item.value)}</span>
                        <span className="text-muted-foreground text-xs w-8 text-right">
                          {Math.round((item.value / totalAmount) * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Status Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Status de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[150px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} />
                      <RechartsTooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        cursor={{fill: 'transparent'}}
                      />
                      <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={24}>
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
          <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-2xl">
            <p className="font-medium">Sem dados para exibir</p>
            <p className="text-sm">Não há contas registradas neste mês.</p>
          </div>
        )}
      </div>
    </div>
  );
}
