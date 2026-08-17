import { DocumentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; variant: "default" | "secondary" | "warning" | "error" | "success" }
> = {
  PENDING: { label: "Pendiente", variant: "secondary" },
  EXTRACTED: { label: "Extraído", variant: "default" },
  NEEDS_REVIEW: { label: "Revisión", variant: "warning" },
  VALIDATED: { label: "Validado", variant: "success" },
  ERROR: { label: "Error", variant: "error" },
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
