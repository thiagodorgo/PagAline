import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface OcrErrorBoundaryProps {
  children: React.ReactNode;
}

interface OcrErrorBoundaryState {
  hasError: boolean;
}

export class OcrErrorBoundary extends React.Component<OcrErrorBoundaryProps, OcrErrorBoundaryState> {
  state: OcrErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[ocr] UI crash captured by boundary", error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-full flex-col bg-muted/30 pb-24">
        <div className="p-6">
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">O OCR falhou nesta tela</h2>
                  <p className="text-sm text-muted-foreground">
                    O restante da aplicação continua disponível. Recarregue para tentar novamente.
                  </p>
                </div>
              </div>
              <Button onClick={this.handleReload} className="w-full gap-2">
                <RotateCcw className="h-4 w-4" /> Recarregar tela
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
}
