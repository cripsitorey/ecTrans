import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { preprocessImage } from "@/lib/ocr/preprocess";
import { runTesseract } from "@/lib/ocr/tesseract";

const execFileAsync = promisify(execFile);

export type TextSource = "PDF_TEXT" | "OCR" | "PDF_OCR";

export interface ExtractedText {
  text: string;
  /** 0-100. Los PDF con capa de texto no pasan por OCR, así que valen 100. */
  confidence: number;
  source: TextSource;
}

/**
 * Un RIDE con capa de texto rinde varios cientos de caracteres. Por debajo de
 * este umbral asumimos que el PDF es un escaneo y hay que rasterizar y pasarlo
 * por OCR.
 */
const MIN_PDF_TEXT_LENGTH = 120;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ectrans-pdf-"));
  const pdfPath = join(dir, "in.pdf");

  try {
    await writeFile(pdfPath, buffer);
    // -layout mantiene cada valor en la misma línea que su rótulo, igual que
    // hace Tesseract con preserve_interword_spaces. Así un solo juego de
    // patrones sirve tanto para el PDF como para la foto.
    const { stdout } = await execFileAsync("pdftotext", [
      "-layout",
      pdfPath,
      "-",
    ]);
    return stdout.trim();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Rasteriza la primera página para poder aplicarle OCR. */
async function rasterizePdf(buffer: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "ectrans-raster-"));
  const pdfPath = join(dir, "in.pdf");
  const outBase = join(dir, "page");

  try {
    await writeFile(pdfPath, buffer);
    await execFileAsync("pdftoppm", [
      "-png",
      "-r",
      "200",
      "-f",
      "1",
      "-l",
      "1",
      pdfPath,
      outBase,
    ]);
    return await readFile(`${outBase}-1.png`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function ocrImage(buffer: Buffer): Promise<ExtractedText> {
  const preprocessed = await preprocessImage(buffer);
  const { text, confidence } = await runTesseract(preprocessed);
  return { text, confidence, source: "OCR" };
}

/**
 * Obtiene el texto de un documento por el camino más fiable disponible.
 *
 * Los PDF electrónicos del SRI traen capa de texto, así que se leen sin pérdida
 * y sin OCR. Las fotos del chofer siempre pasan por Tesseract.
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractedText> {
  if (mimeType !== "application/pdf") {
    return ocrImage(buffer);
  }

  const pdfText = await extractPdfText(buffer);
  if (pdfText.length >= MIN_PDF_TEXT_LENGTH) {
    return { text: pdfText, confidence: 100, source: "PDF_TEXT" };
  }

  const page = await rasterizePdf(buffer);
  const ocr = await ocrImage(page);
  return { ...ocr, source: "PDF_OCR" };
}
