"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";

const TYPES = [
  { value: "", label: "Detectar automáticamente" },
  { value: "FACTURA", label: "Factura" },
  { value: "GUIA", label: "Guía de remisión" },
  { value: "VOUCHER", label: "Voucher" },
  { value: "PEAJE", label: "Peaje" },
];

interface UploadResult {
  type: string;
  status: string;
  confidence: number;
  source: string;
  extractedData: Record<string, unknown> | null;
}

const SOURCE_LABEL: Record<string, string> = {
  PDF_TEXT: "texto del PDF",
  PDF_OCR: "OCR sobre PDF escaneado",
  OCR: "OCR sobre imagen",
};

export function DocumentUploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Seleccione un archivo");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const body = new FormData();
      body.append("file", file);
      if (type) body.append("type", type);

      const response = await fetch("/api/admin/documents/upload", {
        method: "POST",
        body,
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error ?? "Error al subir");

      setResult(data);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setLoading(false);
    }
  };

  const extracted = result?.extractedData ?? {};
  const extractedEntries = Object.entries(extracted).filter(
    ([, value]) => value !== null && value !== undefined && value !== ""
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Upload className="h-5 w-5" />
          Subir documento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="file">Archivo</Label>
              <Input
                id="file"
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                JPG, PNG o PDF, hasta 10 MB. Los PDF electrónicos se leen de su
                capa de texto, sin OCR.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo de documento</Label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                En comprobantes electrónicos el tipo se confirma con la clave de
                acceso del SRI.
              </p>
            </div>
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? "Procesando..." : "Subir y procesar"}
          </Button>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {result && (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <p className="font-medium">
                {result.type} — {result.status}
              </p>
              <p className="text-muted-foreground">
                Leído por {SOURCE_LABEL[result.source] ?? result.source}
                {result.source !== "PDF_TEXT" &&
                  ` (confianza ${result.confidence.toFixed(0)}%)`}
              </p>

              {extractedEntries.length > 0 && (
                <dl className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                  {extractedEntries.map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="font-medium break-all">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
