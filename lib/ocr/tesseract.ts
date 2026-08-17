import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const execFileAsync = promisify(execFile);

export interface TesseractResult {
  text: string;
  confidence: number;
}

export async function runTesseract(imageBuffer: Buffer): Promise<TesseractResult> {
  const tempDir = await mkdtemp(join(tmpdir(), "ectrans-ocr-"));
  const inputPath = join(tempDir, "input.png");
  const outputBase = join(tempDir, "output");

  try {
    await writeFile(inputPath, imageBuffer);

    const { stdout } = await execFileAsync("tesseract", [
      inputPath,
      outputBase,
      "-l",
      "spa",
      "--psm",
      "6",
      "-c",
      "preserve_interword_spaces=1",
    ]);

    const { readFile } = await import("fs/promises");
    let text = "";
    try {
      text = await readFile(`${outputBase}.txt`, "utf-8");
    } catch {
      text = stdout;
    }

    const confidence = estimateConfidence(text);

    return {
      text: text.trim(),
      confidence,
    };
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(join(tempDir, "output.txt")).catch(() => {});
  }
}

function estimateConfidence(text: string): number {
  if (!text || text.length < 5) return 0;

  let score = 50;

  if (/[0-9]{2}[/-][0-9]{2}[/-][0-9]{4}/.test(text)) score += 15;
  if (/\$?\s*[0-9]+[.,][0-9]{2}/.test(text)) score += 15;
  if (/[0-9]{13}/.test(text)) score += 10;
  if (text.length > 100) score += 10;

  const alphaRatio =
    (text.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/g)?.length ?? 0) / text.length;
  if (alphaRatio > 0.3 && alphaRatio < 0.9) score += 5;

  return Math.min(100, score);
}
