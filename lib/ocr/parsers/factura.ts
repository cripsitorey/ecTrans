import facturaPatterns from "@/lib/ocr/patterns/factura.ec.json";
import type { FacturaExtracted } from "@/lib/schemas";
import {
  cleanFieldValue,
  firstMatch,
  isRide,
  normalize,
  normalizeDate,
  parseAmount,
  parseRideHeader,
  findPlate,
  RUC_CI,
} from "@/lib/ocr/sri/ride";

function matchFromStrings(
  text: string,
  patterns: string[] | undefined
): string | undefined {
  return firstMatch(text, (patterns ?? []).map((p) => new RegExp(p, "i")));
}

/**
 * Factura electrónica (RIDE), ya sea leída de un PDF o fotografiada desde una
 * impresión. El total viene rotulado de forma estable como "Valor Total".
 */
function parseFacturaRide(rawText: string): FacturaExtracted {
  const text = normalize(rawText);
  const header = parseRideHeader(text);

  const amount = parseAmount(
    firstMatch(text, [
      /Valor\s+Total[:\s]*\$?\s*([\d.,]+)/i,
      /Total\s+a\s+Pagar[:\s]*\$?\s*([\d.,]+)/i,
      /Importe\s+Total[:\s]*\$?\s*([\d.,]+)/i,
    ])
  );

  const subtotal = parseAmount(
    firstMatch(text, [
      /Subtotal\s+Sin\s+Impuestos[:\s]*\$?\s*([\d.,]+)/i,
      /Subtotal[:\s]*\$?\s*([\d.,]+)/i,
    ])
  );

  // El RIDE lista una línea de IVA por cada tarifa (0%, 5%, 15%); la que
  // aplica es la que trae un valor distinto de cero.
  const ivaRegex = /IVA\s*\d*\s*%?[:\s]*\$?\s*([\d.,]+)/gi;
  const ivaValues: number[] = [];
  let ivaMatch: RegExpExecArray | null;
  while ((ivaMatch = ivaRegex.exec(text)) !== null) {
    const value = parseAmount(ivaMatch[1]);
    if (value !== undefined) ivaValues.push(value);
  }
  const iva = ivaValues.find((v) => v > 0) ?? ivaValues[0];

  const clientName = cleanFieldValue(
    firstMatch(text, [/Razon\s+Social[:\s]*([^\n]+)/i])
  );
  const clientRuc = firstMatch(text, [
    new RegExp(String.raw`${RUC_CI}[:\s]*(\d{10,13})`, "i"),
  ]);

  // "Descripción" aparece también como cabecera de la tabla de ítems, así que
  // anclamos en el bloque de Información Adicional, que trae el texto libre.
  const description = cleanFieldValue(
    firstMatch(text, [
      /Informacion\s+Adicional[\s\S]{0,400}?Descripcion[:\s]{2,}([^\n]{4,90})/i,
      /Descripcion[:\s]{2,}([^\n]{4,90})/i,
    ])
  );

  return {
    claveAcceso: header.clave?.raw,
    claveAccesoValida: header.clave?.valid,
    ambiente: header.clave?.ambiente,
    amount,
    date: header.fechaEmision,
    invoiceNumber: header.numeroComprobante,
    ruc: header.ruc,
    issuerName: header.issuerName,
    subtotal,
    iva,
    clientName,
    clientRuc,
    description,
    plate: findPlate(text),
  };
}

/**
 * Facturas que no son RIDE del SRI: tickets de combustible, peajes y demás
 * comprobantes con formato libre.
 */
function parseFacturaGenerica(rawText: string): FacturaExtracted {
  const text = normalize(rawText);
  const patterns = facturaPatterns as Record<string, string[]>;

  const amount = parseAmount(matchFromStrings(text, patterns.amountPatterns));
  const date = normalizeDate(matchFromStrings(text, patterns.datePatterns));
  const invoiceNumber = matchFromStrings(text, patterns.invoiceNumberPatterns);
  const ruc = matchFromStrings(text, patterns.rucPatterns);
  const dieselLiters = parseAmount(
    matchFromStrings(text, patterns.dieselPatterns)
  );
  const subtotal = parseAmount(matchFromStrings(text, patterns.subtotalPatterns));
  const iva = parseAmount(matchFromStrings(text, patterns.ivaPatterns));

  let issuerName: string | undefined;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    if (
      line.length > 5 &&
      !/factura|fecha|ruc|total|subtotal|iva/i.test(line) &&
      /[a-zA-ZaeiounAEIOUN]/.test(line)
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
    plate: findPlate(text),
  };
}

export function parseFactura(text: string): FacturaExtracted {
  return isRide(text) ? parseFacturaRide(text) : parseFacturaGenerica(text);
}
