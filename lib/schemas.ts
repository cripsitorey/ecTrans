import { z } from "zod";
import { DocumentType } from "@prisma/client";

/**
 * Campos comunes a los comprobantes electrónicos del SRI. Se llenan a partir de
 * la clave de acceso cuando está disponible, que es la fuente más confiable.
 */
const SriFieldsSchema = {
  /** Clave de acceso de 49 dígitos. */
  claveAcceso: z.string().optional(),
  /** true si la clave pasó la verificación módulo 11. */
  claveAccesoValida: z.boolean().optional(),
  ambiente: z.enum(["PRUEBAS", "PRODUCCION"]).optional(),
};

export const FacturaExtractedSchema = z.object({
  ...SriFieldsSchema,
  amount: z.number().optional(),
  date: z.string().optional(),
  invoiceNumber: z.string().optional(),
  ruc: z.string().optional(),
  issuerName: z.string().optional(),
  dieselLiters: z.number().optional(),
  subtotal: z.number().optional(),
  iva: z.number().optional(),
  /** Razón social y RUC de quien recibe la factura. */
  clientName: z.string().optional(),
  clientRuc: z.string().optional(),
  description: z.string().optional(),
  plate: z.string().optional(),
});

export const VoucherExtractedSchema = z.object({
  amount: z.number().optional(),
  date: z.string().optional(),
  merchantName: z.string().optional(),
  description: z.string().optional(),
});

export const GuiaExtractedSchema = z.object({
  ...SriFieldsSchema,
  guideNumber: z.string().optional(),
  date: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  product: z.string().optional(),
  clientName: z.string().optional(),
  clientRuc: z.string().optional(),
  /** Emisor de la guía (electrónica) o remitente (manual). */
  issuerName: z.string().optional(),
  ruc: z.string().optional(),
  carrierName: z.string().optional(),
  carrierRuc: z.string().optional(),
  plate: z.string().optional(),
  /** Motivo del traslado: IMPORTACION, EXPORTACION, VENTA, etc. */
  motivo: z.string().optional(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
});

export const PeajeExtractedSchema = z.object({
  amount: z.number().optional(),
  date: z.string().optional(),
  tollName: z.string().optional(),
  plate: z.string().optional(),
});

export type FacturaExtracted = z.infer<typeof FacturaExtractedSchema>;
export type VoucherExtracted = z.infer<typeof VoucherExtractedSchema>;
export type GuiaExtracted = z.infer<typeof GuiaExtractedSchema>;
export type PeajeExtracted = z.infer<typeof PeajeExtractedSchema>;

export type ExtractedData =
  | FacturaExtracted
  | VoucherExtracted
  | GuiaExtracted
  | PeajeExtracted;

export const EXTRACTED_SCHEMAS: Record<DocumentType, z.ZodType<ExtractedData>> = {
  FACTURA: FacturaExtractedSchema,
  VOUCHER: VoucherExtractedSchema,
  GUIA: GuiaExtractedSchema,
  PEAJE: PeajeExtractedSchema,
};

export const MINIMUM_FIELDS: Record<DocumentType, string[]> = {
  FACTURA: ["amount", "date", "invoiceNumber"],
  VOUCHER: ["amount", "date"],
  GUIA: ["guideNumber", "date"],
  PEAJE: ["amount", "date"],
};

export function validateExtractedData(
  type: DocumentType,
  data: unknown
): ExtractedData {
  const schema = EXTRACTED_SCHEMAS[type];
  return schema.parse(data);
}

export function hasMinimumFields(
  type: DocumentType,
  data: Record<string, unknown>
): boolean {
  const required = MINIMUM_FIELDS[type];
  return required.every((field) => {
    const value = data[field];
    return value !== undefined && value !== null && value !== "";
  });
}
