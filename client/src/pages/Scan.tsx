import { useState, useEffect } from "react";
import { Camera, Upload, X, Check, Zap, Keyboard, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Scan() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const addBill = useStore(state => state.addBill);
  const categories = useStore(state => state.categories);
  const fetchCategories = useStore(state => state.fetchCategories);

  useEffect(() => { fetchCategories(); }, []);

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    dueDate: "",
    category: "Outros",
    notes: ""
  });

  const handleSave = async () => {
    const amount = parseFloat(formData.amount.replace(',', '.')) || 0;
    
    await addBill({
      description: formData.description || "Nova Conta",
      amount,
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : new Date().toISOString(),
      category: formData.category,
      status: "pending"
    });
    
    if (amount > 1000) {
      toast({ title: "Atenção à sua meta!", description: "Esta conta consome uma parte significativa da sua meta mensal.", variant: "destructive" });
    } else {
      toast({ title: "Conta salva", description: "A conta foi adicionada com sucesso à sua lista." });
    }
    
    setLocation("/");
  };

  return (
    <div className="flex flex-col min-h-full bg-muted/30 pb-24">
      <header className="px-6 pt-12 pb-4 bg-card border-b border-border sticky top-0 z-10 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="-ml-2 h-10 w-10 rounded-full">
          <X size={20} />
        </Button>
        <h1 className="text-xl font-bold">Adicionar Conta</h1>
      </header>

      <div className="p-6 flex-1 space-y-6">
        {parseFloat(formData.amount.replace(',', '.')) > 1000 && (
          <Alert variant="destructive" className="bg-warning/10 border-warning/20 text-warning-foreground">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertTitle className="text-sm font-semibold text-warning">Aviso de Meta!</AlertTitle>
            <AlertDescription className="text-xs text-warning/80">
              Este valor compromete grande parte da sua meta mensal restante.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-border shadow-sm overflow-hidden bg-card">
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Descrição</label>
              <input type="text" value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-medium"
                placeholder="Ex: Boleto de Luz" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
                <input type="text" value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                  className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-bold text-lg"
                  placeholder="0,00" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Vencimento</label>
                <input type="date" value={formData.dueDate}
                  onChange={e => setFormData({...formData, dueDate: e.target.value})}
                  className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-medium" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Categoria</label>
              <select value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-medium">
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Observações (opcional)</label>
              <textarea value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 text-sm min-h-[80px]"
                placeholder="Adicione um comentário..." />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="w-full py-6 text-lg rounded-2xl gap-2 font-semibold shadow-lg shadow-primary/20">
          <Check size={20} /> Salvar Conta
        </Button>
      </div>
    </div>
  );
}
