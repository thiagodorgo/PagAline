import { useState, useEffect, useRef } from "react";
import { Camera, Upload, X, Check, Zap, AlertTriangle, LoaderCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface OcrUploadTarget {
  key: string;
  uploadUrl: string;
  sourceUri: string;
}

interface OcrSuggestion {
  description?: string;
  amount?: number;
  dueDate?: string;
  category?: string;
  notes?: string;
  imageUrl: string;
  sourceUri: string;
  key: string;
  rawText: string;
}

function normalizeCurrencyInput(value: string) {
  return value
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
}

function parseCurrencyInput(value: string) {
  const amount = Number.parseFloat(normalizeCurrencyInput(value));
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrencyInput(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function inferContentType(file: File) {
  if (file.type) return file.type;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".tif") || lowerName.endsWith(".tiff")) return "image/tiff";
  return "image/jpeg";
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? response.statusText);
  }

  return response.json() as Promise<T>;
}

export default function Scan() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const addBill = useStore((state) => state.addBill);
  const categories = useStore((state) => state.categories);
  const fetchCategories = useStore((state) => state.fetchCategories);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    dueDate: "",
    category: "Outros",
    notes: "",
  });
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrDocument, setOcrDocument] = useState<{ fileName: string; sourceUri: string } | null>(null);
  const [ocrSummary, setOcrSummary] = useState("");

  const handleSave = async () => {
    try {
      const amount = parseCurrencyInput(formData.amount);

      await addBill({
        description: formData.description || "Nova Conta",
        amount,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : new Date().toISOString(),
        category: formData.category,
        status: "pending",
        notes: formData.notes || undefined,
        imageUrl: ocrDocument?.sourceUri,
      });

      if (amount > 1000) {
        toast({
          title: "Atenção à sua meta!",
          description: "Esta conta consome uma parte significativa da sua meta mensal.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Conta salva", description: "A conta foi adicionada com sucesso à sua lista." });
      }

      setLocation("/");
    } catch (error) {
      toast({
        title: "Falha ao salvar conta",
        description: error instanceof Error ? error.message : "Não foi possível salvar a conta.",
        variant: "destructive",
      });
    }
  };

  const applyOcrSuggestion = (suggestion: OcrSuggestion, fileName: string) => {
    setFormData((current) => ({
      description: suggestion.description ?? current.description,
      amount: suggestion.amount !== undefined ? formatCurrencyInput(suggestion.amount) : current.amount,
      dueDate: suggestion.dueDate ? new Date(suggestion.dueDate).toISOString().slice(0, 10) : current.dueDate,
      category: suggestion.category && categories.some((category) => category.name === suggestion.category) ? suggestion.category : current.category,
      notes: current.notes || suggestion.notes || "",
    }));
    setOcrDocument({ fileName, sourceUri: suggestion.sourceUri });

    const summaryParts = [
      suggestion.description ? `Descrição: ${suggestion.description}` : null,
      suggestion.amount !== undefined ? `Valor: ${formatCurrencyInput(suggestion.amount)}` : null,
      suggestion.dueDate ? `Vencimento: ${new Date(suggestion.dueDate).toLocaleDateString("pt-BR")}` : null,
    ].filter(Boolean);
    setOcrSummary(summaryParts.join(" • "));
  };

  const handleSelectedFile = async (file: File | undefined) => {
    if (!file) return;

    setIsOcrLoading(true);
    try {
      const contentType = inferContentType(file);
      const target = await requestJson<OcrUploadTarget>("/api/ocr/presign", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          contentType,
          fileSize: file.size,
        }),
      });

      const uploadResponse = await fetch(target.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Falha no upload do documento para o S3.");
      }

      const suggestion = await requestJson<OcrSuggestion>("/api/ocr/extract", {
        method: "POST",
        body: JSON.stringify({ key: target.key }),
      });

      applyOcrSuggestion(suggestion, file.name);
      toast({
        title: "OCR concluído",
        description: "Os dados foram extraídos do documento. Revise antes de salvar.",
      });
    } catch (error) {
      toast({
        title: "Falha no OCR",
        description: error instanceof Error ? error.message : "Não foi possível processar o documento.",
        variant: "destructive",
      });
    } finally {
      setIsOcrLoading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isHighAmount = parseCurrencyInput(formData.amount) > 1000;

  return (
    <div className="flex flex-col min-h-full bg-muted/30 pb-24">
      <header className="px-6 pt-12 pb-4 bg-card border-b border-border sticky top-0 z-10 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="-ml-2 h-10 w-10 rounded-full">
          <X size={20} />
        </Button>
        <h1 className="text-xl font-bold">Adicionar Conta</h1>
      </header>

      <div className="p-6 flex-1 space-y-6">
        {isHighAmount && (
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">OCR com AWS Textract</p>
                <p className="text-xs text-muted-foreground">Envie uma foto ou PDF para preencher os campos automaticamente.</p>
              </div>
              {isOcrLoading ? <LoaderCircle className="h-5 w-5 animate-spin text-primary" /> : <Zap className="h-5 w-5 text-primary" />}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="gap-2" disabled={isOcrLoading} onClick={() => cameraInputRef.current?.click()}>
                <Camera size={18} /> Câmera
              </Button>
              <Button variant="outline" className="gap-2" disabled={isOcrLoading} onClick={() => fileInputRef.current?.click()}>
                <Upload size={18} /> Foto / PDF
              </Button>
            </div>

            {ocrDocument && (
              <div className="rounded-xl bg-muted/60 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <FileText size={16} className="text-primary" />
                  <span className="truncate">{ocrDocument.fileName}</span>
                </div>
                {ocrSummary && <p className="mt-2 text-xs text-muted-foreground">{ocrSummary}</p>}
              </div>
            )}

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/png,image/jpeg,image/tiff"
              capture="environment"
              className="hidden"
              onChange={(event) => handleSelectedFile(event.target.files?.[0])}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/tiff,application/pdf"
              className="hidden"
              onChange={(event) => handleSelectedFile(event.target.files?.[0])}
            />
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm overflow-hidden bg-card">
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Descrição</label>
              <input
                type="text"
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
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
                  onChange={(event) => setFormData({ ...formData, amount: event.target.value })}
                  className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-bold text-lg"
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Vencimento</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(event) => setFormData({ ...formData, dueDate: event.target.value })}
                  className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Categoria</label>
              <select
                value={formData.category}
                onChange={(event) => setFormData({ ...formData, category: event.target.value })}
                className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 font-medium"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Observações (opcional)</label>
              <textarea
                value={formData.notes}
                onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                className="w-full p-3 bg-muted rounded-xl border-none focus:ring-2 focus:ring-primary/50 text-sm min-h-[80px]"
                placeholder="Adicione um comentário..."
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={isOcrLoading} className="w-full py-6 text-lg rounded-2xl gap-2 font-semibold shadow-lg shadow-primary/20">
          <Check size={20} /> Salvar Conta
        </Button>
      </div>
    </div>
  );
}
