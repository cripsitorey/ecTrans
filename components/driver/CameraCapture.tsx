"use client";

import { useCallback, useRef, useState } from "react";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Camera, FlipHorizontal, FileText, Receipt, Truck } from "lucide-react";
import { DocumentType } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmDocumentToTrip } from "@/lib/actions/trips";

type Step =
  | "camera"
  | "preview"
  | "uploading"
  | "type-select"
  | "processing"
  | "confirm"
  | "done";

interface CameraCaptureProps {
  vehicleId: string;
}

/**
 * Sin pedir resolución, getUserMedia entrega su valor por defecto (640x480),
 * que deja ilegible un número de comprobante. Se pide 4K como `ideal` para que
 * el navegador entregue lo máximo que soporte la cámara sin fallar si no llega.
 */
const RESOLUTION: MediaTrackConstraints = {
  width: { ideal: 3840 },
  height: { ideal: 2160 },
};

/**
 * Enfoque continuo: al fotografiar un documento de cerca, el stream tiende a
 * quedarse en foco infinito. No todos los navegadores lo soportan, y los que no,
 * lo ignoran sin romper la petición.
 *
 * `focusMode` es parte de Media Capture pero todavía no está en los tipos del
 * DOM, de ahí la conversión.
 */
const ADVANCED_FOCUS = [
  { focusMode: "continuous" },
] as unknown as MediaTrackConstraintSet[];

const VIDEO_CONSTRAINTS: Record<
  "environment" | "user",
  MediaTrackConstraints
> = {
  environment: {
    facingMode: { ideal: "environment" },
    ...RESOLUTION,
    advanced: ADVANCED_FOCUS,
  },
  user: {
    facingMode: { ideal: "user" },
    ...RESOLUTION,
    advanced: ADVANCED_FOCUS,
  },
};

/**
 * Cota superior del lado más largo antes de subir. El servidor reescala a 2000 px
 * de ancho para el OCR, así que enviar la foto en 4K solo gasta datos móviles del
 * chofer y arriesga el límite de 10 MB.
 */
const MAX_UPLOAD_EDGE = 2600;

const DOCUMENT_TYPES: {
  type: DocumentType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { type: "FACTURA", label: "Factura", icon: <Receipt className="h-8 w-8" /> },
  { type: "VOUCHER", label: "Voucher", icon: <FileText className="h-8 w-8" /> },
  { type: "GUIA", label: "Guía", icon: <Truck className="h-8 w-8" /> },
];

export function CameraCapture({ vehicleId }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [step, setStep] = useState<Step>("camera");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRetry, setPendingRetry] = useState<Blob | null>(null);
  const [captureSize, setCaptureSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const [fields, setFields] = useState({
    amount: "",
    date: "",
    invoiceNumber: "",
    origin: "",
    destination: "",
    productOrGuideNumber: "",
    clientNameOrCompany: "",
    viaticos: "",
    diesel: "",
    advance: "",
    notes: "",
  });

  const capture = useCallback(() => {
    const webcam = webcamRef.current;
    const video = webcam?.video;
    if (!webcam || !video?.videoWidth) return;

    // Se piden las dimensiones del stream de forma explícita. react-webcam
    // cachea el tamaño del canvas en la primera captura, así que sin esto una
    // foto tomada después de cambiar de cámara saldría con el tamaño anterior.
    const screenshot = webcam.getScreenshot({
      width: video.videoWidth,
      height: video.videoHeight,
    });

    if (screenshot) {
      setImageSrc(screenshot);
      setCaptureSize({ width: video.videoWidth, height: video.videoHeight });
      setStep("preview");
    }
  }, []);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  /**
   * Reduce la foto al lado máximo de subida conservando la proporción. Se
   * mantiene una calidad JPEG alta porque el OCR depende de los bordes nítidos
   * de los caracteres, que es justo lo primero que destruye la compresión.
   */
  const dataUrlToBlob = (dataUrl: string): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const image = new window.Image();

      image.onload = () => {
        const longestEdge = Math.max(image.width, image.height);
        const scale = Math.min(1, MAX_UPLOAD_EDGE / longestEdge);

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo procesar la imagen"));
          return;
        }

        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen")),
          "image/jpeg",
          0.92
        );
      };

      image.onerror = () => reject(new Error("No se pudo leer la foto"));
      image.src = dataUrl;
    });

  const uploadImage = async (blob: Blob) => {
    setStep("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("file", blob, "capture.jpg");

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error al subir la foto");
      }

      setPendingRetry(null);
      setStep("type-select");
    } catch (err) {
      setPendingRetry(blob);
      setError(
        err instanceof Error ? err.message : "Sin conexión. Puede reintentar."
      );
      setStep("preview");
    }
  };

  const confirmPhoto = async () => {
    if (!imageSrc) return;
    try {
      const blob = await dataUrlToBlob(imageSrc);
      await uploadImage(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar la foto");
    }
  };

  const selectType = async (type: DocumentType) => {
    setDocType(type);
    setStep("processing");
    setError(null);

    try {
      const res = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al procesar");

      setDocumentId(data.documentId);
      const extracted = data.extractedData ?? {};

      setFields({
        amount: extracted.amount?.toString() ?? "",
        date: extracted.date ?? new Date().toLocaleDateString("es-EC"),
        invoiceNumber: extracted.invoiceNumber ?? "",
        origin: extracted.origin ?? "",
        destination: extracted.destination ?? "",
        productOrGuideNumber: extracted.guideNumber ?? extracted.productOrGuideNumber ?? "",
        clientNameOrCompany: extracted.clientName ?? extracted.clientNameOrCompany ?? "",
        viaticos: type === "VOUCHER" ? (extracted.amount?.toString() ?? "") : "",
        diesel: type === "FACTURA" ? (extracted.amount?.toString() ?? "") : "",
        advance: "",
        notes: "",
      });

      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar");
      setStep("confirm");
    }
  };

  const saveToTrip = async () => {
    if (!documentId || !docType) return;

    try {
      await confirmDocumentToTrip({
        documentId,
        vehicleId,
        fields: {
          amount: fields.amount ? parseFloat(fields.amount) : undefined,
          date: fields.date,
          invoiceNumber: fields.invoiceNumber || undefined,
          origin: fields.origin || undefined,
          destination: fields.destination || undefined,
          productOrGuideNumber: fields.productOrGuideNumber || undefined,
          clientNameOrCompany: fields.clientNameOrCompany || undefined,
          viaticos: fields.viaticos ? parseFloat(fields.viaticos) : undefined,
          diesel: fields.diesel ? parseFloat(fields.diesel) : undefined,
          advance: fields.advance ? parseFloat(fields.advance) : undefined,
          notes: fields.notes || undefined,
        },
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    }
  };

  const reset = () => {
    setStep("camera");
    setImageSrc(null);
    setDocumentId(null);
    setDocType(null);
    setError(null);
    setPendingRetry(null);
    setCaptureSize(null);
    setFields({
      amount: "",
      date: "",
      invoiceNumber: "",
      origin: "",
      destination: "",
      productOrGuideNumber: "",
      clientNameOrCompany: "",
      viaticos: "",
      diesel: "",
      advance: "",
      notes: "",
    });
  };

  if (step === "camera") {
    return (
      <div className="fixed inset-0 flex flex-col bg-black">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.95}
          forceScreenshotSourceSize
          videoConstraints={VIDEO_CONSTRAINTS[facingMode]}
          onUserMediaError={() =>
            setError("No se pudo abrir la cámara. Revise los permisos.")
          }
          className="h-full w-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-4 bg-gradient-to-t from-black/80 to-transparent pb-10 pt-16">
          <button
            onClick={toggleCamera}
            className="absolute right-4 top-4 rounded-full bg-black/50 p-3 text-white"
            aria-label="Cambiar cámara"
          >
            <FlipHorizontal className="h-6 w-6" />
          </button>
          <button
            onClick={capture}
            className="h-20 w-20 rounded-full border-4 border-white bg-white/20"
            aria-label="Tomar foto"
          />
        </div>
      </div>
    );
  }

  if (step === "preview" || step === "uploading") {
    return (
      <div className="fixed inset-0 flex flex-col bg-black">
        {imageSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt="Vista previa" className="h-full w-full object-contain" />
        )}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-3 bg-black/80 p-4">
          {captureSize && (
            <p className="text-center text-xs text-white/60">
              {captureSize.width} × {captureSize.height} px
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-red-600/90 px-4 py-3 text-center text-white">
              {error}
            </p>
          )}
          <Button
            size="xl"
            variant="outline"
            className="w-full border-white bg-white/10 text-white hover:bg-white/20"
            onClick={() => setStep("camera")}
            disabled={step === "uploading"}
          >
            Repetir foto
          </Button>
          <Button
            size="xl"
            className="w-full"
            onClick={pendingRetry ? () => uploadImage(pendingRetry) : confirmPhoto}
            disabled={step === "uploading"}
          >
            {step === "uploading" ? "Subiendo..." : pendingRetry ? "Reintentar subida" : "Usar esta foto"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "type-select") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6">
        <h1 className="text-2xl font-bold">¿Qué tipo de documento es?</h1>
        <div className="grid w-full max-w-md gap-4">
          {DOCUMENT_TYPES.map(({ type, label, icon }) => (
            <Button
              key={type}
              size="xl"
              className="h-24 flex-col gap-2 text-lg"
              onClick={() => selectType(type)}
            >
              {icon}
              {label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <Camera className="h-16 w-16 animate-pulse text-primary" />
        <p className="text-xl font-medium">Procesando documento...</p>
        <p className="text-muted-foreground">Extrayendo datos de la foto</p>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="min-h-screen bg-background p-4 pb-24">
        <h1 className="mb-2 text-2xl font-bold">Confirmar datos</h1>
        <p className="mb-6 text-muted-foreground">
          Revise y corrija los datos antes de guardar
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-yellow-100 px-4 py-3 text-yellow-900">
            {error}
          </p>
        )}

        <div className="space-y-4">
          {(docType === "FACTURA" || docType === "VOUCHER") && (
            <>
              <div>
                <Label htmlFor="amount">Monto ($)</Label>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={docType === "FACTURA" ? fields.diesel : fields.viaticos}
                  onChange={(e) =>
                    setFields((f) =>
                      docType === "FACTURA"
                        ? { ...f, diesel: e.target.value, amount: e.target.value }
                        : { ...f, viaticos: e.target.value, amount: e.target.value }
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  value={fields.date}
                  onChange={(e) => setFields((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
            </>
          )}

          {docType === "FACTURA" && (
            <div>
              <Label htmlFor="invoiceNumber">No. Factura</Label>
              <Input
                id="invoiceNumber"
                value={fields.invoiceNumber}
                onChange={(e) =>
                  setFields((f) => ({ ...f, invoiceNumber: e.target.value }))
                }
              />
            </div>
          )}

          {docType === "GUIA" && (
            <>
              <div>
                <Label htmlFor="guide">No. Guía / Producto</Label>
                <Input
                  id="guide"
                  value={fields.productOrGuideNumber}
                  onChange={(e) =>
                    setFields((f) => ({
                      ...f,
                      productOrGuideNumber: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="origin">Origen</Label>
                <Input
                  id="origin"
                  value={fields.origin}
                  onChange={(e) =>
                    setFields((f) => ({ ...f, origin: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="destination">Destino</Label>
                <Input
                  id="destination"
                  value={fields.destination}
                  onChange={(e) =>
                    setFields((f) => ({ ...f, destination: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="client">Empresa / Cliente</Label>
                <Input
                  id="client"
                  value={fields.clientNameOrCompany}
                  onChange={(e) =>
                    setFields((f) => ({
                      ...f,
                      clientNameOrCompany: e.target.value,
                    }))
                  }
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="notes">Novedades</Label>
            <Input
              id="notes"
              value={fields.notes}
              onChange={(e) => setFields((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 flex gap-3 border-t bg-background p-4">
          <Button variant="outline" size="lg" className="flex-1" onClick={reset}>
            Cancelar
          </Button>
          <Button size="lg" className="flex-1" onClick={saveToTrip}>
            Guardar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-green-700">¡Guardado!</h1>
        <p className="mt-2 text-muted-foreground">
          Los datos se agregaron a su bitácora
        </p>
      </div>
      <Button size="xl" className="w-full max-w-md" onClick={reset}>
        Capturar otro documento
      </Button>
    </div>
  );
}
