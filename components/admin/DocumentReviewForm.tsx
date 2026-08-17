"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  validateDocument,
  reprocessDocument,
  linkDocumentToTrip,
} from "@/lib/actions/trips";
import { DocumentStatus } from "@prisma/client";
import { useRouter } from "next/navigation";

interface DocumentReviewFormProps {
  document: {
    id: string;
    status: DocumentStatus;
    rawOcrText: string | null;
    extractedData: Record<string, unknown> | null;
    tripId: string | null;
  };
  trips: { id: string; label: string }[];
}

export function DocumentReviewForm({
  document,
  trips,
}: DocumentReviewFormProps) {
  const router = useRouter();
  const extracted = document.extractedData ?? {};

  const [fields, setFields] = useState({
    amount: String(extracted.amount ?? ""),
    date: String(extracted.date ?? ""),
    invoiceNumber: String(extracted.invoiceNumber ?? ""),
    ruc: String(extracted.ruc ?? ""),
    guideNumber: String(extracted.guideNumber ?? ""),
  });
  const [tripId, setTripId] = useState(document.tripId ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleValidate = async () => {
    setLoading(true);
    setMessage("");
    try {
      const data: Record<string, unknown> = {};
      if (fields.amount) data.amount = parseFloat(fields.amount);
      if (fields.date) data.date = fields.date;
      if (fields.invoiceNumber) data.invoiceNumber = fields.invoiceNumber;
      if (fields.ruc) data.ruc = fields.ruc;
      if (fields.guideNumber) data.guideNumber = fields.guideNumber;

      await validateDocument(document.id, data);
      if (tripId) await linkDocumentToTrip(document.id, tripId);
      setMessage("Documento validado");
      router.refresh();
    } catch {
      setMessage("Error al validar");
    } finally {
      setLoading(false);
    }
  };

  const handleReprocess = async () => {
    setLoading(true);
    setMessage("");
    try {
      const result = await reprocessDocument(document.id);
      const data = result.extractedData as Record<string, unknown>;
      setFields({
        amount: String(data.amount ?? ""),
        date: String(data.date ?? ""),
        invoiceNumber: String(data.invoiceNumber ?? ""),
        ruc: String(data.ruc ?? ""),
        guideNumber: String(data.guideNumber ?? ""),
      });
      setMessage("OCR reprocesado");
      router.refresh();
    } catch {
      setMessage("Error al reprocesar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Texto OCR crudo</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">
            {document.rawOcrText ?? "(sin texto OCR)"}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campos extraídos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Monto</Label>
            <Input
              value={fields.amount}
              onChange={(e) =>
                setFields((f) => ({ ...f, amount: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Fecha</Label>
            <Input
              value={fields.date}
              onChange={(e) =>
                setFields((f) => ({ ...f, date: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>No. Factura</Label>
            <Input
              value={fields.invoiceNumber}
              onChange={(e) =>
                setFields((f) => ({ ...f, invoiceNumber: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>RUC</Label>
            <Input
              value={fields.ruc}
              onChange={(e) =>
                setFields((f) => ({ ...f, ruc: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Vincular a viaje</Label>
            <select
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Sin vincular</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}

      <div className="flex gap-3">
        <Button onClick={handleValidate} disabled={loading}>
          Validar
        </Button>
        <Button variant="outline" onClick={handleReprocess} disabled={loading}>
          Reprocesar OCR
        </Button>
      </div>
    </div>
  );
}
