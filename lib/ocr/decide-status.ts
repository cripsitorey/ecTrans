import { DocumentStatus, DocumentType } from "@prisma/client";
import { hasMinimumFields } from "@/lib/schemas";

interface DecideStatusInput {
  text: string;
  confidence: number;
  extracted: Record<string, unknown>;
  type: DocumentType;
}

export function decideStatus({
  text,
  confidence,
  extracted,
  type,
}: DecideStatusInput): DocumentStatus {
  const errorThreshold = parseFloat(
    process.env.OCR_CONFIDENCE_ERROR ?? "30"
  );
  const reviewThreshold = parseFloat(
    process.env.OCR_CONFIDENCE_REVIEW ?? "60"
  );

  if (!text || text.trim().length < 5 || confidence < errorThreshold) {
    return DocumentStatus.ERROR;
  }

  const hasMinimum = hasMinimumFields(type, extracted);

  if (!hasMinimum || confidence < reviewThreshold) {
    return DocumentStatus.NEEDS_REVIEW;
  }

  return DocumentStatus.EXTRACTED;
}
