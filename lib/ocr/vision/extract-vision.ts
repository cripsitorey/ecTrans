import { generateText, Output } from "ai";
import { z } from "zod";
import { DocumentType } from "@prisma/client";
import type { ExtractedData } from "@/lib/schemas";

/**
 * Lectura de documentos manuscritos mediante un modelo de visión.
 *
 * Tesseract reconoce texto impreso, no escritura a mano: sobre una guía de
 * remisión manual recupera los rótulos del formulario pero ninguno de los
 * valores escritos a bolígrafo. Para esos casos delegamos en un modelo
 * multimodal, y si no está configurado el flujo sigue con captura manual.
 */

const DEFAULT_MODEL = "google/gemini-3.7-flash";

/** Los modelos rinden mejor devolviendo null que omitiendo la clave. */
const nullableString = z.string().nullable();

const GuiaVisionSchema = z.object({
  guideNumber: nullableString.describe(
    "Número de la guía de remisión, incluida la serie preimpresa"
  ),
  date: nullableString.describe("Fecha de inicio del traslado, en dd/mm/aaaa"),
  dateEnd: nullableString.describe(
    "Fecha de terminación del traslado, en dd/mm/aaaa"
  ),
  origin: nullableString.describe("Punto de partida"),
  destination: nullableString.describe("Punto de llegada"),
  product: nullableString.describe("Descripción de la mercadería transportada"),
  clientName: nullableString.describe("Razón social del destinatario"),
  clientRuc: nullableString.describe("RUC o cédula del destinatario"),
  carrierName: nullableString.describe("Nombre del transportista o chofer"),
  carrierRuc: nullableString.describe("RUC o cédula del transportista"),
  plate: nullableString.describe("Placa del vehículo"),
  motivo: nullableString.describe(
    "Motivo del traslado, por ejemplo IMPORTACION o VENTA"
  ),
});

const FacturaVisionSchema = z.object({
  invoiceNumber: nullableString.describe("Número de factura"),
  date: nullableString.describe("Fecha de emisión, en dd/mm/aaaa"),
  amount: z.number().nullable().describe("Valor total"),
  ruc: nullableString.describe("RUC del emisor"),
  issuerName: nullableString.describe("Razón social del emisor"),
  description: nullableString.describe("Concepto o detalle"),
  plate: nullableString.describe("Placa del vehículo, si aparece"),
});

const VoucherVisionSchema = z.object({
  amount: z.number().nullable().describe("Valor del comprobante"),
  date: nullableString.describe("Fecha, en dd/mm/aaaa"),
  merchantName: nullableString.describe("Nombre del establecimiento"),
  description: nullableString.describe("Concepto del gasto"),
});

/**
 * Cada tipo pide un schema distinto, así que el registro se tipa de forma
 * uniforme. La salida del modelo se vuelve a validar más adelante contra los
 * schemas del pipeline, que son los que mandan.
 */
const SCHEMAS: Record<DocumentType, z.ZodTypeAny> = {
  [DocumentType.GUIA]: GuiaVisionSchema,
  [DocumentType.FACTURA]: FacturaVisionSchema,
  [DocumentType.VOUCHER]: VoucherVisionSchema,
  [DocumentType.PEAJE]: VoucherVisionSchema,
};

const DOCUMENT_LABEL: Record<DocumentType, string> = {
  [DocumentType.GUIA]: "una guía de remisión",
  [DocumentType.FACTURA]: "una factura",
  [DocumentType.VOUCHER]: "un voucher o comprobante de pago",
  [DocumentType.PEAJE]: "un comprobante de peaje",
};

function buildPrompt(type: DocumentType): string {
  return [
    `Esta imagen es ${DOCUMENT_LABEL[type]} de transporte de carga en Ecuador.`,
    "El documento puede estar lleno a mano; lee la escritura manuscrita con cuidado.",
    "",
    "Reglas:",
    "- Devuelve null en los campos que no aparezcan o sean ilegibles. No inventes datos.",
    "- Las fechas van en formato dd/mm/aaaa.",
    "- Las placas ecuatorianas son tres letras seguidas de tres o cuatro dígitos.",
    "- El RUC tiene 13 dígitos y la cédula 10.",
    "- Transcribe los nombres tal como están escritos, sin corregirlos ni completarlos.",
  ].join("\n");
}

export function isVisionEnabled(): boolean {
  if (process.env.VISION_ENABLED === "false") return false;
  return Boolean(process.env.AI_GATEWAY_API_KEY);
}

/** Descarta los null del modelo para que encajen con los schemas del pipeline. */
function stripNulls(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== null && value !== "")
  );
}

export interface VisionResult {
  extracted: Partial<ExtractedData>;
  model: string;
}

/**
 * Extrae campos de un documento fotografiado usando un modelo de visión.
 * Devuelve null si la función no está configurada o si el modelo falla, para
 * que el pipeline continúe con lo que haya logrado el OCR.
 */
export async function extractWithVision(
  image: Buffer,
  mediaType: string,
  type: DocumentType
): Promise<VisionResult | null> {
  if (!isVisionEnabled()) return null;

  const model = process.env.VISION_MODEL ?? DEFAULT_MODEL;

  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: SCHEMAS[type] }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildPrompt(type) },
            { type: "file", mediaType, data: image },
          ],
        },
      ],
    });

    return {
      extracted: stripNulls(output as Record<string, unknown>) as Partial<ExtractedData>,
      model,
    };
  } catch (error) {
    // La visión es un refuerzo opcional: si falla, el documento sigue su curso
    // hacia revisión manual en lugar de quedar en error.
    console.error("Extracción por visión fallida:", error);
    return null;
  }
}
