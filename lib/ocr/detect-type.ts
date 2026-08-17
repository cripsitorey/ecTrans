import { DocumentType } from "@prisma/client";
import { findClaveAcceso } from "@/lib/ocr/sri/clave-acceso";
import { normalize } from "@/lib/ocr/sri/ride";

export interface TypeDetection {
  type: DocumentType | null;
  /** "CLAVE_ACCESO" es determinístico; "TEXTO" es heurístico por rótulos. */
  basis: "CLAVE_ACCESO" | "TEXTO" | "NINGUNO";
}

const KEYWORDS: Array<[DocumentType, RegExp[]]> = [
  [
    DocumentType.GUIA,
    [/Guia\s+de\s+Remision/i, /Destinatario/i, /Motivo\s+del\s+Traslado/i],
  ],
  [
    DocumentType.FACTURA,
    [/\bFACTURA\b/i, /Valor\s+Total/i, /Subtotal\s+Sin\s+Impuestos/i],
  ],
  [
    DocumentType.PEAJE,
    [/\bPEAJE\b/i, /\bPEAJES\b/i, /Concesionaria/i],
  ],
  [
    DocumentType.VOUCHER,
    [/\bVOUCHER\b/i, /Comprobante\s+de\s+Pago/i, /Tarjeta\s+de\s+Credito/i],
  ],
];

/**
 * Deduce el tipo de documento a partir de su contenido.
 *
 * El tipo de comprobante viene codificado en la clave de acceso (01 factura,
 * 06 guía de remisión), así que en los documentos electrónicos la detección es
 * exacta. Para el resto se cuentan rótulos característicos.
 */
export function detectDocumentType(rawText: string): TypeDetection {
  const text = normalize(rawText);

  const clave = findClaveAcceso(text);
  if (clave?.documentType) {
    return { type: clave.documentType, basis: "CLAVE_ACCESO" };
  }

  let best: DocumentType | null = null;
  let bestScore = 0;

  for (const [type, patterns] of KEYWORDS) {
    const score = patterns.filter((re) => re.test(text)).length;
    if (score > bestScore) {
      best = type;
      bestScore = score;
    }
  }

  if (!best) return { type: null, basis: "NINGUNO" };
  return { type: best, basis: "TEXTO" };
}
