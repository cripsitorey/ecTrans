import { prisma } from "@/lib/prisma";
import { downloadDocument } from "@/lib/storage";
import { preprocessImage } from "@/lib/ocr/preprocess";
import { runTesseract } from "@/lib/ocr/tesseract";
import { parseByType } from "@/lib/ocr/parsers";
import { decideStatus } from "@/lib/ocr/decide-status";
import { validateExtractedData } from "@/lib/schemas";

export async function processDocument(documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error("Documento no encontrado");
  }

  try {
    const rawBuffer = await downloadDocument(document.storagePath);
    const preprocessed = await preprocessImage(rawBuffer);
    const { text, confidence } = await runTesseract(preprocessed);
    const rawExtracted = parseByType(document.type, text);
    const extractedData = validateExtractedData(document.type, rawExtracted);

    const status = decideStatus({
      text,
      confidence,
      extracted: extractedData as Record<string, unknown>,
      type: document.type,
    });

    await prisma.document.update({
      where: { id: documentId },
      data: {
        rawOcrText: text,
        extractedData,
        ocrConfidence: confidence,
        status,
        processedAt: new Date(),
        errorMessage: status === "ERROR" ? "OCR no produjo texto usable" : null,
      },
    });

    return { text, confidence, extractedData, status };
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
