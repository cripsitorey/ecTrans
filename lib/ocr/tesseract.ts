import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const execFileAsync = promisify(execFile);

export interface TesseractResult {
  text: string;
  /** Confianza media por palabra que reporta Tesseract (0-100). */
  confidence: number;
}

/**
 * Modo de segmentación de página. El 6 ("bloque uniforme de texto") es el que
 * mejor se porta con los RIDE impresos, donde el contenido viene en columnas
 * bien definidas.
 */
const DEFAULT_PSM = "6";

export async function runTesseract(
  imageBuffer: Buffer,
  psm: string = DEFAULT_PSM
): Promise<TesseractResult> {
  const dir = await mkdtemp(join(tmpdir(), "ectrans-ocr-"));
  const inputPath = join(dir, "input.png");
  const outputBase = join(dir, "output");

  try {
    await writeFile(inputPath, imageBuffer);

    // Una sola pasada produce el texto y el TSV con las confianzas por palabra.
    await execFileAsync("tesseract", [
      inputPath,
      outputBase,
      "-l",
      "spa",
      "--psm",
      psm,
      "-c",
      "preserve_interword_spaces=1",
      "txt",
      "tsv",
    ]);

    const text = await readFile(`${outputBase}.txt`, "utf-8").catch(() => "");
    const tsv = await readFile(`${outputBase}.tsv`, "utf-8").catch(() => "");

    return {
      text: text.trim(),
      confidence: meanWordConfidence(tsv),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Promedia la columna `conf` del TSV sobre las palabras reconocidas. Tesseract
 * emite -1 en las filas que describen bloques o líneas en lugar de palabras.
 */
function meanWordConfidence(tsv: string): number {
  const lines = tsv.split("\n").slice(1);
  let sum = 0;
  let count = 0;

  for (const line of lines) {
    const cols = line.split("\t");
    if (cols.length < 12) continue;

    const conf = parseFloat(cols[10]);
    const word = cols[11]?.trim();
    if (!word || Number.isNaN(conf) || conf < 0) continue;

    sum += conf;
    count++;
  }

  if (count === 0) return 0;
  return Math.round((sum / count) * 10) / 10;
}
