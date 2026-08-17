import type { GuiaExtracted } from "@/lib/schemas";
import {
  cleanFieldValue as clean,
  firstMatch,
  findPlate,
  isRide,
  normalize,
  normalizeDate,
  parseRideHeader,
  RUC_CI,
} from "@/lib/ocr/sri/ride";

/**
 * Guía de remisión electrónica (RIDE). Los rótulos son fijos porque el formato
 * lo define el SRI, así que la extracción es directa y estable.
 */
function parseGuiaRide(rawText: string): GuiaExtracted {
  const text = normalize(rawText);
  const header = parseRideHeader(text);

  const carrierName = clean(
    firstMatch(text, [/Transportista[:\s]*([^\n]+)/i])
  );
  const carrierRuc = firstMatch(text, [
    new RegExp(String.raw`Transportista[^\n]*${RUC_CI}[:\s]*(\d{10,13})`, "i"),
    new RegExp(String.raw`Transportista[\s\S]{0,80}?${RUC_CI}[:\s]*(\d{10,13})`, "i"),
  ]);

  // La razón social suele desbordar a la línea siguiente (".. INABRAS\nS.A."),
  // así que admitimos una línea de continuación sin rótulo.
  const clientName = clean(
    firstMatch(text, [
      /Destinatario[:\s]*([^\n]+(?:\n[A-Z0-9][^\n:]{0,40})?)/i,
    ])
  );

  const clientRuc = firstMatch(text, [
    new RegExp(
      String.raw`Destinatario[\s\S]{0,160}?${RUC_CI}[:\s]*(\d{10,13})`,
      "i"
    ),
  ]);

  const motivo = clean(firstMatch(text, [/Motivo[:\s]*([^\n]{3,60})/i]));

  // La ruta ("CONTECON - QUITO") es la fuente más limpia de origen y destino.
  const ruta = clean(firstMatch(text, [/Ruta[:\s]*([^\n]{3,80})/i]));
  const rutaParts = ruta?.split(/\s*[-–]\s*/).filter(Boolean);

  const origin =
    (rutaParts && rutaParts.length >= 2 ? rutaParts[0] : undefined) ??
    clean(firstMatch(text, [/Direccion\s+Partida[:\s]*([^\n]{3,60}?)\s*(?:Telefono|$)/i]));

  const destination =
    rutaParts && rutaParts.length >= 2
      ? rutaParts[rutaParts.length - 1]
      : clean(firstMatch(text, [/Punto\s+de\s+Llegada[:\s]*([^\n]{3,60})/i]));

  const product = clean(
    firstMatch(text, [/Descripcion[:\s]*([^\n]{4,140})/i])
  );

  const dateStart = normalizeDate(
    firstMatch(text, [/Fecha\s+Inicio[:\s]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i])
  );
  const dateEnd = normalizeDate(
    firstMatch(text, [/Fecha\s+Fin[:\s]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i])
  );

  return {
    claveAcceso: header.clave?.raw,
    claveAccesoValida: header.clave?.valid,
    ambiente: header.clave?.ambiente,
    guideNumber: header.numeroComprobante,
    date: header.fechaEmision ?? dateStart,
    ruc: header.ruc,
    issuerName: header.issuerName,
    origin,
    destination,
    product,
    clientName,
    clientRuc,
    carrierName,
    carrierRuc,
    plate: findPlate(text),
    motivo,
    dateStart,
    dateEnd,
  };
}

/**
 * Guía de remisión manual (formulario preimpreso llenado a mano).
 *
 * Tesseract lee la plantilla impresa pero no la escritura a mano, así que aquí
 * solo recuperamos los datos preimpresos: la serie del formulario y el número
 * correlativo. El resto queda para captura asistida o para un modelo de visión.
 */
function parseGuiaManual(rawText: string): GuiaExtracted {
  const text = normalize(rawText);

  const serie = firstMatch(text, [
    /Guia\s+de\s+Remision\s+Manual\s*N[°ºo\W]{0,3}\s*(\d{3}\s*-?\s*\d{3})/i,
    /\b(\d{3}\s*-\s*\d{3})\b/,
  ])?.replace(/\s/g, "");

  const correlativo = firstMatch(text, [/\b(\d{9})\b/, /\b(0{2,}\d{4,7})\b/]);

  const guideNumber =
    serie && correlativo
      ? `${serie}-${correlativo}`
      : (serie ?? correlativo);

  return {
    guideNumber,
    date: normalizeDate(
      firstMatch(text, [
        /Fecha\s+Inicio\s+Traslado[:\s]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
      ])
    ),
    plate: findPlate(text),
  };
}

export function parseGuia(text: string): GuiaExtracted {
  return isRide(text) ? parseGuiaRide(text) : parseGuiaManual(text);
}
