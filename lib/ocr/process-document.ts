import { prisma } from "@/lib/prisma";
import { downloadDocument } from "@/lib/storage";
import { extractText } from "@/lib/ocr/extract-text";
import { parseByType } from "@/lib/ocr/parsers";
import { detectDocumentType } from "@/lib/ocr/detect-type";
import { decideStatus } from "@/lib/ocr/decide-status";
import { extractWithVision, isVisionEnabled } from "@/lib/ocr/vision/extract-vision";
import { hasMinimumFields, validateExtractedData } from "@/lib/schemas";

/** Deduce el MIME a partir de la extensión con la que se guardó en MinIO. */
function mimeFromStoragePath(path: string): string {
  if (path.endsWith(".pdf")) return "application/pdf";
  if (path.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

/** Quita las claves vacías para que no pisen un valor ya obtenido. */
function stripEmpty(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );
}

interface ProcessOptions {
  /**
   * Si es true, el tipo detectado en el contenido puede corregir el tipo
   * guardado. Útil cuando el documento se subió sin que el usuario lo declare.
   */
  autoDetectType?: boolean;
}

export async function processDocument(
  documentId: string,
  options: ProcessOptions = {}
) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error("Documento no encontrado");
  }

  try {
    const rawBuffer = await downloadDocument(document.storagePath);
    const mimeType = mimeFromStoragePath(document.storagePath);
    const { text, confidence, source } = await extractText(rawBuffer, mimeType);

    const detection = detectDocumentType(text);

    // La clave de acceso identifica el comprobante sin ambigüedad, así que
    // pesa más que lo que el chofer haya elegido en la pantalla de captura.
    const type =
      options.autoDetectType && detection.type
        ? detection.type
        : detection.basis === "CLAVE_ACCESO" && detection.type
          ? detection.type
          : document.type;

    const rawExtracted = parseByType(type, text);
    let extractedData = validateExtractedData(type, rawExtracted);
    let usedVision = false;

    // Un documento llenado a mano deja al OCR sin campos utilizables. Cuando
    // eso pasa recurrimos al modelo de visión, que sí lee manuscrito; lo que
    // ya se extrajo del texto tiene prioridad por ser determinístico.
    const needsVision = !hasMinimumFields(
      type,
      extractedData as Record<string, unknown>
    );

    if (needsVision && source !== "PDF_TEXT" && isVisionEnabled()) {
      const vision = await extractWithVision(rawBuffer, mimeType, type);
      if (vision) {
        extractedData = validateExtractedData(type, {
          ...vision.extracted,
          ...stripEmpty(extractedData as Record<string, unknown>),
        });
        usedVision = true;
      }
    }

    const status = decideStatus({
      text,
      confidence,
      extracted: extractedData as Record<string, unknown>,
      type,
      source,
      usedVision,
    });

    await prisma.document.update({
      where: { id: documentId },
      data: {
        type,
        rawOcrText: text,
        extractedData,
        ocrConfidence: confidence,
        status,
        processedAt: new Date(),
        errorMessage:
          status === "ERROR" ? "No se pudo leer texto usable del documento" : null,
      },
    });

    return { text, confidence, extractedData, status, type, source, usedVision };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido en OCR";

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "ERROR",
        errorMessage: message,
        processedAt: new Date(),
      },
    });

    throw error;
  }
}
