import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Camera, FileImage, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { scanFromCamera, scanFromGallery } from '@/lib/ocr';
import { useStore } from '@/lib/store';

export default function Scan() {
  const categories = useStore((state) => state.categories);
  const settings = useStore((state) => state.settings);
  const addBill = useStore((state) => state.addBill);
  const fetchCategories = useStore((state) => state.fetchCategories);
  const fetchSettings = useStore((state) => state.fetchSettings);
  const { toast } = useToast();

  const [form, setForm] = useState({
    description: '',
    amount: '',
    dueDate: '',
    category: 'Outros',
    notes: '',
    imageUrl: '',
  });
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    void Promise.all([fetchCategories(), fetchSettings()]);
  }, [fetchCategories, fetchSettings]);

  const parsedAmount = useMemo(() => Number(form.amount.replace(',', '.')), [form.amount]);
  const goal = settings?.monthlyGoal ?? 5000;
  const exceedsGoalAlert = !Number.isNaN(parsedAmount) && parsedAmount > 1000;

  const applySuggestion = async (scanner: () => Promise<Awaited<ReturnType<typeof scanFromCamera>>>) => {
    try {
      setIsScanning(true);
      const suggestion = await scanner();
      setForm((current) => ({
        ...current,
        description: suggestion.description ?? current.description,
        amount: suggestion.amount ? suggestion.amount.toString() : current.amount,
        dueDate: suggestion.dueDate ? suggestion.dueDate.slice(0, 10) : current.dueDate,
        category: suggestion.category ?? current.category,
        notes: suggestion.notes ?? current.notes,
        imageUrl: suggestion.imageUrl ?? current.imageUrl,
      }));
      toast({ title: 'OCR concluído', description: 'Os dados capturados foram preenchidos no formulário.' });
    } catch (error) {
      toast({
        title: 'Falha no OCR',
        description: error instanceof Error ? error.message : 'Não foi possível processar a imagem.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = async () => {
    if (!form.description || !form.amount || !form.dueDate) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha descrição, valor e vencimento.', variant: 'destructive' });
      return;
    }

    const amount = Number(form.amount.replace(',', '.'));
    await addBill({
      description: form.description,
      amount,
      dueDate: new Date(form.dueDate).toISOString(),
      category: form.category,
      status: 'pending',
      notes: form.notes || null,
      imageUrl: form.imageUrl || null,
      paidDate: null,
    });

    if (amount > 1000) {
      toast({ title: 'Atenção à meta', description: `Essa conta impacta sua meta mensal de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(goal)}.` });
    } else {
      toast({ title: 'Conta adicionada', description: 'O lançamento foi salvo no banco local.' });
    }

    setForm({ description: '', amount: '', dueDate: '', category: 'Outros', notes: '', imageUrl: '' });
  };

  return (
    <div className="flex min-h-full flex-col pb-24">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-6 pt-12 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Adicionar conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">OCR local com ML Kit e persistência 100% offline.</p>
      </header>

      <div className="space-y-5 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Button className="h-14" disabled={isScanning} onClick={() => void applySuggestion(scanFromCamera)}>
            <Camera className="mr-2" size={18} /> Câmera
          </Button>
          <Button className="h-14" variant="outline" disabled={isScanning} onClick={() => void applySuggestion(scanFromGallery)}>
            <FileImage className="mr-2" size={18} /> Foto / PDF
          </Button>
        </div>

        {form.imageUrl ? (
          <Card className="overflow-hidden">
            <img src={form.imageUrl} alt="Documento digitalizado" className="max-h-56 w-full object-cover" />
          </Card>
        ) : null}

        {exceedsGoalAlert ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Impacto na meta mensal</AlertTitle>
            <AlertDescription>Essa conta ultrapassa o limiar de alerta de R$ 1.000,00.</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preenchimento manual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scan-description">Descrição</Label>
              <Input id="scan-description" value={form.description} onChange={(event) => setForm((state) => ({ ...state, description: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scan-amount">Valor</Label>
                <Input id="scan-amount" inputMode="decimal" value={form.amount} onChange={(event) => setForm((state) => ({ ...state, amount: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scan-due-date">Vencimento</Label>
                <Input id="scan-due-date" type="date" value={form.dueDate} onChange={(event) => setForm((state) => ({ ...state, dueDate: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(value) => setForm((state) => ({ ...state, category: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scan-notes">Observações</Label>
              <Textarea id="scan-notes" rows={5} value={form.notes} onChange={(event) => setForm((state) => ({ ...state, notes: event.target.value }))} />
            </div>
            <Button className="w-full" onClick={() => void handleSave()}>
              <Save className="mr-2" size={18} /> Salvar conta
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
