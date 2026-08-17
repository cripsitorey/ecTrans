import {
  findClaveAcceso,
  type ClaveAcceso,
  type ClaveAccesoHints,
} from "./clave-acceso";

/**
 * Helpers para leer el RIDE (Representación Impresa del Documento Electrónico)
 * del SRI, que es el formato tanto de la factura como de la guía de remisión
 * electrónicas, ya sea en PDF o fotografiado desde una impresión.
 */

/**
 * Quita tildes para que los regex no dependan de la acentuación, que el OCR
 * pierde con frecuencia.
 *
 * Los espacios consecutivos se conservan a propósito: en el RIDE son lo único
 * que separa una columna de la siguiente, y sin ellos el valor de un campo se
 * vuelve indistinguible del rótulo que tiene al lado.
 */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\t/g, "  ")
    .replace(/\r/g, "");
}

export function firstMatch(
  text: string,
  patterns: RegExp[]
): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = match[1].trim();
      if (value) return value;
    }
  }
  return undefined;
}

/**
 * El rótulo "RUC/CI" tal como puede salir del OCR: la barra se confunde muy
 * seguido con I, l, 1 o |, produciendo lecturas como "RUCICI".
 */
export const RUC_CI = String.raw`RUC[\s\/I1l|]{0,3}CI`;

/** Campos de la columna derecha del RIDE que se cuelan al leer una línea. */
const INLINE_LABELS = new RegExp(
  String.raw`\s{2,}(?:${RUC_CI}|RUC|Telefonos?|Correo|Motivo|Ruta|Direccion|Fecha|Codigo|Placa|Autorizacion)\b\s*:?[^\n]*`,
  "gi"
);

/**
 * Limpia el valor de un campo.
 *
 * En el RIDE las columnas conviven en la misma línea, así que al capturar un
 * campo se arrastra el rótulo del vecino de la derecha; el bloque de espacios
 * que los separa es lo que permite distinguirlos. Los valores largos además se
 * parten en una línea de continuación que hay que volver a unir.
 */
export function cleanFieldValue(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const cleaned = value
    .replace(INLINE_LABELS, " ")
    .replace(/\s+/g, " ")
    // Puntuación suelta al final; un punto pegado se respeta porque suele ser
    // parte de la razón social ("S.A.").
    .replace(/\s+[.,;:|_-]+$/, "")
    .replace(/[|:;,]+$/, "")
    .trim();

  return cleaned.length > 1 ? cleaned : undefined;
}

/** Convierte "1.234,56" o "1,234.56" a número. */
export function parseAmount(raw: string | undefined): number | undefined {
  if (!raw) return undefined;

  let value = raw.replace(/[^\d.,]/g, "");
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");

  if (lastComma > lastDot) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else {
    value = value.replace(/,/g, "");
  }

  const num = parseFloat(value);
  return Number.isNaN(num) ? undefined : num;
}

/** Normaliza fechas a dd/mm/aaaa. */
export function normalizeDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  const match = raw.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (!match) return undefined;

  const [, d, m, y] = match;
  const year = y.length === 2 ? `20${y}` : y;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${year}`;
}

/** Número de comprobante del SRI: 001-005-000000704. */
const NUMERO_COMPROBANTE = /(\d{3}\s*-\s*\d{3}\s*-\s*\d{9})/;

export function findNumeroComprobante(text: string): string | undefined {
  const match = text.match(NUMERO_COMPROBANTE);
  return match?.[1].replace(/\s/g, "");
}

/**
 * Placas ecuatorianas: tres letras y tres o cuatro dígitos, con guion opcional.
 * En el RIDE suelen venir pegadas (XAI1131); en las guías manuales, con guion
 * (KAA-122).
 */
const PLACA = /\b([A-Z]{3})\s*-?\s*(\d{3,4})\b/;

export function findPlate(text: string): string | undefined {
  const match = normalize(text).toUpperCase().match(PLACA);
  if (!match) return undefined;
  return `${match[1]}${match[2]}`;
}

export interface RideHeader {
  clave: ClaveAcceso | null;
  numeroComprobante?: string;
  ruc?: string;
  issuerName?: string;
  fechaEmision?: string;
}

/**
 * Lee la cabecera común del RIDE. La clave de acceso manda cuando valida por
 * módulo 11, porque codifica fecha, RUC y número de comprobante de una sola vez;
 * los campos impresos aparte sirven para contrastarla y como respaldo.
 */
export function parseRideHeader(rawText: string): RideHeader {
  const text = normalize(rawText);

  const numeroComprobante = findNumeroComprobante(text);
  const ruc = firstMatch(text, [
    /RUC[:\s]*(\d{13})/i,
    /R\.?U\.?C\.?[:\s]*(\d{13})/i,
  ]);
  const fechaEmision = normalizeDate(
    firstMatch(text, [
      /Fecha\s+(?:y\s+hora\s+de\s+)?Emision[:\s]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
      /Fecha\s+Emision[:\s]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
    ])
  );

  const hints: ClaveAccesoHints = { numeroComprobante, ruc, fechaEmision };
  const clave = findClaveAcceso(text, hints);

  const issuerName = firstMatch(text, [
    /Emisor[:\s]*([^\n]+(?:\n[^\n:]+S\.?A\.?S?\.?)?)/i,
  ])?.replace(/\s+/g, " ");

  return {
    clave,
    numeroComprobante: clave?.numeroComprobante ?? numeroComprobante,
    ruc: clave?.ruc ?? ruc,
    issuerName,
    fechaEmision: clave?.fechaEmision ?? fechaEmision,
  };
}

/** true si el texto corresponde a un comprobante electrónico del SRI. */
export function isRide(rawText: string): boolean {
  const text = normalize(rawText);
  if (findClaveAcceso(text)) return true;

  const signals = [
    /Clave\s+de\s+Acceso/i,
    /Numero\s+de\s+Autorizacion/i,
    /Ambiente[:\s]*(PRODUCCION|PRUEBAS)/i,
  ];
  return signals.filter((re) => re.test(text)).length >= 2;
}
