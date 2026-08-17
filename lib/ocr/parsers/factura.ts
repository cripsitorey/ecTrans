import facturaPatterns from "@/lib/ocr/patterns/factura.ec.json";
import type { FacturaExtracted } from "@/lib/schemas";

function parseNumber(value: string): number {
  return parseFloat(value.replace(",", "."));
}

function firstMatch(text: string, patterns: string[]): string | undefined {
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, "i");
    const match = text.match(regex);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function firstMatchNumber(
  text: string,
  patterns: string[]
): number | undefined {
  const raw = firstMatch(text, patterns);
  if (!raw) return undefined;
  const num = parseNumber(raw);
  return Number.isNaN(num) ? undefined : num;
}

export function parseFactura(text: string): FacturaExtracted {
  const patterns = facturaPatterns as Record<string, string[]>;

  const amount = firstMatchNumber(text, patterns.amountPatterns ?? []);
  const date = firstMatch(text, patterns.datePatterns ?? []);
  const invoiceNumber = firstMatch(text, patterns.invoiceNumberPatterns ?? []);
  const ruc = firstMatch(text, patterns.rucPatterns ?? []);
  const dieselLiters = firstMatchNumber(text, patterns.dieselPatterns ?? []);
  const subtotal = firstMatchNumber(text, patterns.subtotalPatterns ?? []);
  const iva = firstMatchNumber(text, patterns.ivaPatterns ?? []);

  let issuerName: string | undefined;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    if (
      line.length > 5 &&
      !/factura|fecha|ruc|total|subtotal|iva/i.test(line) &&
      /[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(line)
    ) {
      issuerName = line;
      break;
    }
  }

  return {
    amount,
    date,
    invoiceNumber,
    ruc,
    issuerName,
    dieselLiters,
    subtotal,
    iva,
  };
}
