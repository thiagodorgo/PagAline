import { useEffect, useState } from 'react';
import { format, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/lib/store';

const COLORS = ['#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#ef4444', '#64748b'];
const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function Reports() {
  const bills = useStore((state) => state.bills);
  const settings = useStore((state) => state.settings);
  const fetchBills = useStore((state) => state.fetchBills);
  const fetchSettings = useStore((state) => state.fetchSettings);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    void Promise.all([fetchBills(), fetchSettings()]);
  }, [fetchBills, fetchSettings]);

  const monthBills = bills.filter((bill) => {
    const comparisonDate = bill.status === 'paid' && bill.paidDate ? parseISO(bill.paidDate) : parseISO(bill.dueDate);
    return isSameMonth(comparisonDate, currentMonth);
  });

  const monthlyGoal = settings?.monthlyGoal ?? 5000;
  const totalAmount = monthBills.reduce((sum, bill) => sum + bill.amount, 0);
  const paidAmount = monthBills.filter((bill) => bill.status === 'paid').reduce((sum, bill) => sum + bill.amount, 0);
  const pendingAmount = totalAmount - paidAmount;
  const goalPercentage = monthlyGoal > 0 ? Math.min((totalAmount / monthlyGoal) * 100, 100) : 0;

  const categoryData = monthBills
    .reduce<Array<{ name: string; value: number }>>((accumulator, bill) => {
      const found = accumulator.find((item) => item.name === bill.category);
      if (found) {
        found.value += bill.amount;
      } else {
        accumulator.push({ name: bill.category, value: bill.amount });
      }
      return accumulator;
    }, [])
    .sort((a, b) => b.value - a.value);

  const statusData = [
    { name: 'Pago', valor: paidAmount, fill: 'hsl(var(--success))' },
    { name: 'Pendente', valor: pendingAmount, fill: 'hsl(var(--destructive))' },
  ];

  return (
    <div className="flex min-h-full flex-col pb-24">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-6 pt-12 pb-4">
        <h1 className="mb-4 text-2xl font-bold tracking-tight">Resumo mensal</h1>
        <div className="flex items-center justify-between rounded-full bg-muted p-1">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}><ChevronLeft size={18} /></Button>
          <span className="text-sm font-semibold capitalize">{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}><ChevronRight size={18} /></Button>
        </div>
      </header>

      <div className="space-y-6 p-4">
        <Card className="overflow-hidden border-none bg-gradient-to-br from-primary/90 to-primary text-primary-foreground shadow-lg">
          <CardContent className="relative p-5">
            <div className="absolute top-4 right-4 opacity-20"><Target size={60} /></div>
            <p className="text-sm text-primary-foreground/80">Gasto total do mês</p>
            <p className="mt-2 text-3xl font-bold">{formatCurrency(totalAmount)}</p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs font-medium text-primary-foreground/90">
                <span>Meta mensal</span>
                <span>{formatCurrency(monthlyGoal)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-primary-foreground/20">
                <div className={goalPercentage > 90 ? 'h-full bg-red-400' : goalPercentage > 75 ? 'h-full bg-orange-300' : 'h-full bg-white'} style={{ width: `${goalPercentage}%` }} />
              </div>
              <p className="text-[11px] text-primary-foreground/75">
                {goalPercentage >= 100 ? 'Você ultrapassou sua meta mensal.' : `Você usou ${Math.round(goalPercentage)}% da meta.`}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="flex flex-col items-center p-4 text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success"><TrendingDown size={20} /></div>
              <p className="text-xs text-muted-foreground">Total pago</p>
              <p className="text-lg font-bold text-success">{formatCurrency(paidAmount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center p-4 text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive"><TrendingUp size={20} /></div>
              <p className="text-xs text-muted-foreground">Total pendente</p>
              <p className="text-lg font-bold">{formatCurrency(pendingAmount)}</p>
            </CardContent>
          </Card>
        </div>

        {totalAmount > 0 ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribuição por categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative h-[240px] w-full">
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <strong>{formatCurrency(totalAmount)}</strong>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" innerRadius={70} outerRadius={92} paddingAngle={5} stroke="none">
                        {categoryData.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-3">
                  {categoryData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between rounded-2xl bg-muted/50 p-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="font-medium text-sm">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm">{formatCurrency(item.value)}</div>
                        <div className="text-xs text-muted-foreground">{Math.round((item.value / totalAmount) * 100)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pago vs pendente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[150px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={80} axisLine={false} tickLine={false} />
                      <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="valor" radius={[0, 8, 8, 0]} barSize={28}>
                        {statusData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Não há contas registradas para o mês de {format(currentMonth, 'MMMM', { locale: ptBR })}.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
