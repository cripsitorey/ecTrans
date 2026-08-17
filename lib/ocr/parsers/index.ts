import { DocumentType } from "@prisma/client";
import type { ExtractedData } from "@/lib/schemas";
import { parseFactura } from "./factura";
import { parseVoucher } from "./voucher";
import { parseGuia } from "./guia";
import { parsePeaje } from "./peaje";

type ParserFn = (text: string) => ExtractedData;

export const PARSERS_BY_TYPE: Record<DocumentType, ParserFn> = {
  FACTURA: parseFactura,
  VOUCHER: parseVoucher,
  GUIA: parseGuia,
  PEAJE: parsePeaje,
};

export function parseByType(type: DocumentType, text: string): ExtractedData {
  return PARSERS_BY_TYPE[type](text);
}
