import { useState } from "react";
import { Camera, Upload, X, Check, Zap, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

type ScanStep = "camera" | "review";

export default function Scan() {
  const [step, setStep] = useState<ScanStep>("camera");
  const [isProcessing, setIsProcessing] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const addBill = useStore(state => state.addBill);

  // Mock extracted data
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    dueDate: "",
    category: "Outros",
    notes: ""
  });

  const handleCapture = () => {
    setIsProcessing(true);
    // Simulate OCR processing
    setTimeout(() => {
      setFormData({
        description: "Boleto Conta de Energia",
        amount: "245.80",
        dueDate: new Date().toISOString().split('T')[0], // Today
        category: "Casa",
        notes: "Lido via OCR automático"
      });
      setIsProcessing(false);
      setStep("review");
    }, 1500);
  };

  const handleManualEntry = () => {
    setFormData({
      description: "",
      amount: "",
      dueDate: "",
      category: "Outros",
      notes: ""
    });
    setStep("review");
  };

  const handleSave = () => {
    addBill({
      description: formData.description || "Nova Conta",
      amount: parseFloat(formData.amount.replace(',', '.')) || 0,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : new Date(),
      category: formData.category,
      status: "pending"
    });
    
    toast({
      title: "Conta salva",
      description: "A conta foi adicionada com sucesso à sua lista.",
    });
    
    setLocation("/");
  };

  if (step === "camera") {
    return (
      <div className="flex flex-col h-full bg-black text-white relative">
        <header className="absolute top-0 left-0 right-0 p-6 pt-12 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="text-white hover:bg-white/20 rounded-full">
            <X size={24} />
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full">
              <Zap size={20} />
            </Button>
          </div>
        </header>

        {/* Viewfinder Mock */}
        <div className="flex-1 flex items-center justify-center p-8 relative">
          {/* Mock Camera Feed Background */}
          <div className="absolute inset-0 bg-zinc-900 overflow-hidden">
            <div className="w-full h-full opacity-30 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-700 via-zinc-900 to-black"></div>
          </div>
          
          {/* Target Box */}
          <div className="w-full aspect-[3/4] max-w-sm border-2 border-white/50 rounded-2xl relative z-10 flex flex-col items-center justify-center">
            {isProcessing ? (
              <div className="flex flex-col items-center animate-pulse">
                <ScanLine className="w-full h-1 bg-primary absolute top-0 animate-[scan_2s_ease-in-out_infinite]" />
                <p className="text-lg font-medium text-primary">Analisando documento...</p>
                <p className="text-sm text-white/60 mt-2">Extraindo valores e código de barras</p>
              </div>
            ) : (
              <div className="text-center p-4 bg-black/40 backdrop-blur-sm rounded-lg">
                <p className="text-white/80 font-medium">Alinhe o boleto na marcação</p>
              </div>
            )}
            
            {/* Corners */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl -translate-x-1 -translate-y-1"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl translate-x-1 -translate-y-1"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl -translate-x-1 translate-y-1"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl translate-x-1 translate-y-1"></div>
          </div>
        </div>

        {/* Camera Controls */}
        <div className="pb-12 pt-6 px-8 flex justify-between items-center bg-black z-10">
          <Button variant="ghost" size="icon" className="w-12 h-12 rounded-full bg-zinc-800 text-white hover:bg-zinc-700">
            <Upload size={20} />
          </Button>
          
          <Button 
            onClick={handleCapture}
            disabled={isProcessing}
            className="w-20 h-20 rounded-full bg-white hover:bg-zinc-200 border-4 border-zinc-400 p-0 flex items-center justify-center"
          >
            <div className="w-16 h-16 rounded-full border-2 border-black"></div>
          </Button>
          
          <Button variant="ghost" size="icon" onClick={handleManualEntry} className="w-12 h-12 rounded-full bg-zinc-800 text-white hover:bg-zinc-700">
            <Keyboard size={20} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-muted/30">
      <header className="px-6 pt-12 pb-4 bg-card border-b border-border sticky top-0 z-10 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setStep("camera")} className="-ml-2 h-10 w-10 rounded-full">
          <X size={20} />
        </Button>
        <h1 className="text-xl font-bold">Revisar Dados</h1>
      </header>

      <div className="p-6 flex-1 space-y-6">
        <Card className="border-primary/20 shadow-sm overflow-hidden">
          <div className="bg-primary/10 px-4 py-2 border-b border-primary/10 flex items-center gap-2 text-primary text-sm font-medium">
            <Zap size={16} />
            <span>Dados extraídos via OCR</span>
          </div>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Descrição</label>
              <input 
                type="text" 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-medium"
                placeholder="Ex: Boleto de Luz"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
                <input 
                  type="text" 
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                  className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-bold text-lg"
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Vencimento</label>
                <input 
                  type="date" 
                  value={formData.dueDate}
                  onChange={e => setFormData({...formData, dueDate: e.target.value})}
                  className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Categoria</label>
              <select 
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-medium"
              >
                <option value="Casa">Casa</option>
                <option value="Transporte">Transporte</option>
                <option value="Educação">Educação</option>
                <option value="Saúde">Saúde</option>
                <option value="Impostos">Impostos</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Observações (opcional)</label>
              <textarea 
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 text-sm min-h-[80px]"
                placeholder="Adicione um comentário..."
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="w-full py-6 text-lg rounded-2xl gap-2 font-semibold">
          <Check size={20} />
          Salvar Conta
        </Button>
      </div>
    </div>
  );
}

function ScanLine({ className }: { className?: string }) {
  return (
    <div className={className} style={{
      boxShadow: "0 0 10px 2px hsl(var(--primary))"
    }} />
  );
}
