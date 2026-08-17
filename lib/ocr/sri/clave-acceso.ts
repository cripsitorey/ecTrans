import { DocumentType } from "@prisma/client";

/**
 * La clave de acceso del SRI concentra, en 49 dígitos, la identidad completa de
 * un comprobante electrónico. En un RIDE impreso aparece dos veces (como
 * "Número de Autorización" y como "Clave de Acceso") y además viene en el código
 * de barras, así que es el dato más redundante y confiable de la página.
 *
 * Estructura:
 *   ddmmaaaa | tipo(2) | ruc(13) | ambiente(1) | estab(3) | ptoEmi(3)
 *   | secuencial(9) | códigoNumérico(8) | tipoEmisión(1) | verificador(1)
 */
export const CLAVE_ACCESO_LENGTH = 49;

const SEGMENTS = {
  fecha: [0, 8],
  tipoComprobante: [8, 10],
  ruc: [10, 23],
  ambiente: [23, 24],
  establecimiento: [24, 27],
  puntoEmision: [27, 30],
  secuencial: [30, 39],
  codigoNumerico: [39, 47],
  tipoEmision: [47, 48],
  digitoVerificador: [48, 49],
} as const;

/** Códigos de tipo de comprobante del SRI que nos interesan. */
export const TIPO_COMPROBANTE: Record<string, DocumentType | "OTRO"> = {
  "01": DocumentType.FACTURA,
  "04": "OTRO", // Nota de crédito
  "05": "OTRO", // Nota de débito
  "06": DocumentType.GUIA, // Guía de remisión
  "07": "OTRO", // Comprobante de retención
};

export interface ClaveAcceso {
  raw: string;
  fechaEmision: string; // dd/mm/aaaa
  tipoComprobante: string;
  documentType: DocumentType | null;
  ruc: string;
  ambiente: "PRUEBAS" | "PRODUCCION";
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;
  /** Número de comprobante legible: 001-005-000000704 */
  numeroComprobante: string;
  /** true si el dígito verificador módulo 11 cuadra. */
  valid: boolean;
  /** true si se reconstruyó a partir de una lectura OCR imperfecta. */
  corrected: boolean;
}

function slice(clave: string, key: keyof typeof SEGMENTS): string {
  const [start, end] = SEGMENTS[key];
  return clave.slice(start, end);
}

/**
 * Dígito verificador módulo 11 sobre los primeros 48 dígitos, con pesos
 * cíclicos 2..7 aplicados de derecha a izquierda.
 */
export function computeCheckDigit(first48: string): number {
  let sum = 0;
  let weight = 2;

  for (let i = first48.length - 1; i >= 0; i--) {
    sum += Number(first48[i]) * weight;
    weight = weight === 7 ? 2 : weight + 1;
  }

  const remainder = 11 - (sum % 11);
  if (remainder === 11) return 0;
  if (remainder === 10) return 1;
  return remainder;
}

export function isValidClaveAcceso(clave: string): boolean {
  if (!/^\d{49}$/.test(clave)) return false;
  return computeCheckDigit(clave.slice(0, 48)) === Number(clave[48]);
}

function build(clave: string, corrected: boolean): ClaveAcceso {
  const fecha = slice(clave, "fecha");
  const tipo = slice(clave, "tipoComprobante");
  const mapped = TIPO_COMPROBANTE[tipo];
  const establecimiento = slice(clave, "establecimiento");
  const puntoEmision = slice(clave, "puntoEmision");
  const secuencial = slice(clave, "secuencial");

  return {
    raw: clave,
    fechaEmision: `${fecha.slice(0, 2)}/${fecha.slice(2, 4)}/${fecha.slice(4, 8)}`,
    tipoComprobante: tipo,
    documentType: mapped && mapped !== "OTRO" ? mapped : null,
    ruc: slice(clave, "ruc"),
    ambiente: slice(clave, "ambiente") === "1" ? "PRUEBAS" : "PRODUCCION",
    establecimiento,
    puntoEmision,
    secuencial,
    numeroComprobante: `${establecimiento}-${puntoEmision}-${secuencial}`,
    valid: isValidClaveAcceso(clave),
    corrected,
  };
}

export function parseClaveAcceso(clave: string): ClaveAcceso | null {
  const digits = clave.replace(/\D/g, "");
  if (digits.length !== CLAVE_ACCESO_LENGTH) return null;
  return build(digits, false);
}

/**
 * Extrae todas las tiras de 49 dígitos del texto. En un RIDE la clave aparece
 * al menos dos veces (Número de Autorización y Clave de Acceso), lo que nos da
 * lecturas independientes que podemos contrastar entre sí.
 */
function candidateClaves(text: string): string[] {
  const compact = text.replace(/[\s.\-]/g, "");
  const found: string[] = [];

  for (const match of compact.match(/\d{49,}/g) ?? []) {
    // Una tira más larga de 49 puede traer dígitos pegados de un campo vecino.
    for (let i = 0; i + CLAVE_ACCESO_LENGTH <= match.length; i++) {
      found.push(match.slice(i, i + CLAVE_ACCESO_LENGTH));
    }
  }

  return found;
}

/**
 * Campos que el RIDE imprime por separado y que duplican segmentos de la clave.
 * Sirven para reconstruirla cuando el OCR la lee mal.
 */
export interface ClaveAccesoHints {
  /** Número de comprobante legible, p. ej. "001-005-000000704". */
  numeroComprobante?: string;
  ruc?: string;
  /** Fecha de emisión en dd/mm/aaaa. */
  fechaEmision?: string;
  tipoComprobante?: string;
}

function matchesHints(clave: ClaveAcceso, hints: ClaveAccesoHints): boolean {
  const checks: Array<[string | undefined, string]> = [
    [hints.ruc, clave.ruc],
    [hints.numeroComprobante, clave.numeroComprobante],
    [hints.fechaEmision, clave.fechaEmision],
    [hints.tipoComprobante, clave.tipoComprobante],
  ];

  return checks.every(([hint, actual]) => !hint || hint === actual);
}

/**
 * Elige la mejor clave de acceso del texto.
 *
 * El dígito verificador módulo 11 detecta errores de lectura pero no alcanza
 * para corregirlos: entre las ~144 sustituciones de un dígito, cerca de 1 de
 * cada 11 vuelve a validar por azar, así que "reparar" a ciegas es adivinar.
 * En vez de eso nos apoyamos en la redundancia real del documento: preferimos
 * una clave que valide y que además concuerde con los campos impresos aparte.
 */
export function findClaveAcceso(
  text: string,
  hints: ClaveAccesoHints = {}
): ClaveAcceso | null {
  const candidates = candidateClaves(text);
  if (candidates.length === 0) return null;

  const valid = candidates.filter(isValidClaveAcceso).map((c) => build(c, false));

  const consistent = valid.find((c) => matchesHints(c, hints));
  if (consistent) return consistent;
  if (valid.length > 0) return valid[0];

  // Ninguna lectura pasó el módulo 11. Si los campos impresos por separado
  // alcanzan para reconstruir la clave, la damos por corregida.
  return reconstructFromHints(candidates[0], hints);
}

/**
 * Reconstruye la clave reemplazando los segmentos que el RIDE imprime aparte.
 * Solo devuelve un resultado si la reconstrucción pasa el módulo 11, lo que
 * confirma que los campos leídos por separado son coherentes entre sí.
 */
export function reconstructFromHints(
  clave: string,
  hints: ClaveAccesoHints
): ClaveAcceso | null {
  const digits = clave.replace(/\D/g, "");
  if (digits.length !== CLAVE_ACCESO_LENGTH) return null;

  let rebuilt = digits;

  const replaceSegment = (key: keyof typeof SEGMENTS, value: string) => {
    const [start, end] = SEGMENTS[key];
    if (value.length !== end - start) return;
    rebuilt = rebuilt.slice(0, start) + value + rebuilt.slice(end);
  };

  if (hints.fechaEmision) {
    const [d, m, y] = hints.fechaEmision.split("/");
    if (d && m && y) replaceSegment("fecha", `${d}${m}${y}`);
  }
  if (hints.tipoComprobante) {
    replaceSegment("tipoComprobante", hints.tipoComprobante);
  }
  if (hints.ruc) replaceSegment("ruc", hints.ruc);

  if (hints.numeroComprobante) {
    const [estab, pto, sec] = hints.numeroComprobante.split("-");
    if (estab && pto && sec) {
      replaceSegment("establecimiento", estab);
      replaceSegment("puntoEmision", pto);
      replaceSegment("secuencial", sec);
    }
  }

  if (rebuilt === digits) return null;
  if (!isValidClaveAcceso(rebuilt)) return null;

  return build(rebuilt, true);
}
