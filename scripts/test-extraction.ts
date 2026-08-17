/**
 * Verifica los parsers contra documentos reales, sin tocar la base ni MinIO.
 *
 *   npx tsx scripts/test-extraction.ts <archivo> [<archivo>...]
 *
 * Acepta imágenes (se procesan por OCR, igual que una foto del chofer) y PDFs
 * (se leen de la capa de texto, igual que una carga del admin).
 */
import { readFile } from "fs/promises";
import { basename, extname } from "path";
import { DocumentType } from "@prisma/client";
import { extractText } from "../lib/ocr/extract-text";
import { detectDocumentType } from "../lib/ocr/detect-type";
import { parseByType } from "../lib/ocr/parsers";
import { hasMinimumFields } from "../lib/schemas";
import { extractWithVision, isVisionEnabled } from "../lib/ocr/vision/extract-vision";

function mimeFor(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  return "image/jpeg";
}

async function run(path: string, forcedType?: DocumentType) {
  console.log(`\n${"=".repeat(70)}\n  ${basename(path)}\n${"=".repeat(70)}`);

  const buffer = await readFile(path);
  const { text, confidence, source } = await extractText(buffer, mimeFor(path));
  const detection = detectDocumentType(text);

  console.log(`fuente: ${source}   confianza: ${confidence}`);
  console.log(`tipo detectado: ${detection.type ?? "(ninguno)"} (via ${detection.basis})`);

  const type = forcedType ?? detection.type;
  if (!type) {
    console.log("\nNo se pudo determinar el tipo. Primeras líneas del texto:");
    console.log(text.split("\n").slice(0, 6).join("\n"));
    return;
  }
  if (forcedType) console.log(`tipo forzado: ${forcedType}`);

  let extracted = parseByType(type, text) as Record<string, unknown>;

  if (!hasMinimumFields(type, extracted) && source !== "PDF_TEXT") {
    if (isVisionEnabled()) {
      console.log("\nOCR sin campos mínimos: consultando modelo de visión...");
      const vision = await extractWithVision(buffer, mimeFor(path), type);
      if (vision) {
        console.log(`modelo: ${vision.model}`);
        extracted = { ...vision.extracted, ...extracted };
      } else {
        console.log("el modelo de visión no devolvió resultado");
      }
    } else {
      console.log(
        "\nOCR sin campos mínimos y visión no configurada " +
          "(falta AI_GATEWAY_API_KEY): el documento iría a captura manual."
      );
    }
  }

  console.log("\ncampos extraídos:");
  const entries = Object.entries(extracted).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) {
    console.log("  (ninguno)");
  }
  for (const [key, value] of entries) {
    console.log(`  ${key.padEnd(18)} ${String(value)}`);
  }

  const missing = Object.entries(extracted)
    .filter(([, v]) => v === undefined)
    .map(([k]) => k);
  if (missing.length) console.log(`\nsin valor: ${missing.join(", ")}`);
}

async function main() {
  const args = process.argv.slice(2);

  // --type=GUIA fuerza el parser, igual que cuando el chofer elige el tipo en
  // la pantalla de captura.
  const typeArg = args.find((a) => a.startsWith("--type="));
  const forcedType = typeArg
    ? (typeArg.split("=")[1].toUpperCase() as DocumentType)
    : undefined;

  const files = args.filter((a) => !a.startsWith("--"));
  if (files.length === 0) {
    console.error(
      "Uso: npx tsx scripts/test-extraction.ts [--type=GUIA] <archivo>..."
    );
    process.exit(1);
  }

  for (const file of files) {
    await run(file, forcedType);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
