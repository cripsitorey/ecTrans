import { DocumentStatus, DocumentType } from "@prisma/client";
import { hasMinimumFields } from "@/lib/schemas";
import type { TextSource } from "@/lib/ocr/extract-text";

interface DecideStatusInput {
  text: string;
  confidence: number;
  extracted: Record<string, unknown>;
  type: DocumentType;
  source?: TextSource;
  /** true si los campos vienen de un modelo de visión y no del OCR. */
  usedVision?: boolean;
}

export function decideStatus({
  text,
  confidence,
  extracted,
  type,
  source = "OCR",
  usedVision = false,
}: DecideStatusInput): DocumentStatus {
  const errorThreshold = parseFloat(process.env.OCR_CONFIDENCE_ERROR ?? "30");
  const reviewThreshold = parseFloat(process.env.OCR_CONFIDENCE_REVIEW ?? "60");

  if (!text || text.trim().length < 5) {
    return DocumentStatus.ERROR;
  }

  const hasMinimum = hasMinimumFields(type, extracted);

  // Una clave de acceso que pasa el módulo 11 confirma fecha, RUC y número de
  // comprobante por sí sola, así que no depende del puntaje del OCR.
  if (extracted.claveAccesoValida === true && hasMinimum) {
    return DocumentStatus.EXTRACTED;
  }

  // El texto embebido de un PDF no es una lectura óptica: no tiene sentido
  // aplicarle umbrales de confianza.
  if (source === "PDF_TEXT") {
    return hasMinimum ? DocumentStatus.EXTRACTED : DocumentStatus.NEEDS_REVIEW;
  }

  // La confianza del OCR no dice nada sobre lo que leyó el modelo de visión, y
  // un documento manuscrito siempre merece que una persona lo confirme.
  if (usedVision) {
    return DocumentStatus.NEEDS_REVIEW;
  }

  if (confidence < errorThreshold) {
    return DocumentStatus.ERROR;
  }

  if (!hasMinimum || confidence < reviewThreshold) {
    return DocumentStatus.NEEDS_REVIEW;
  }

  return DocumentStatus.EXTRACTED;
}
