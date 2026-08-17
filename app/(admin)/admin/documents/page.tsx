import { getAdminDocuments } from "@/lib/actions/trips";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocumentStatusBadge } from "@/components/admin/DocumentStatusBadge";
import { DocumentUploadForm } from "@/components/admin/DocumentUploadForm";

export default async function AdminDocumentsPage() {
  const documents = await getAdminDocuments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Documentos</h1>
        <p className="text-muted-foreground">
          Cola de revisión — prioridad: Revisión → Error → Pendiente
        </p>
      </div>

      <DocumentUploadForm />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estado</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fuente</TableHead>
              <TableHead>Confianza OCR</TableHead>
              <TableHead>Viaje</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <DocumentStatusBadge status={doc.status} />
                </TableCell>
                <TableCell>{doc.type}</TableCell>
                <TableCell>{doc.source}</TableCell>
                <TableCell>
                  {doc.ocrConfidence != null
                    ? `${doc.ocrConfidence.toFixed(0)}%`
                    : "—"}
                </TableCell>
                <TableCell>
                  {doc.trip
                    ? `${doc.trip.driver.fullName} — ${doc.trip.vehicle.plate}`
                    : "Sin vincular"}
                </TableCell>
                <TableCell>{formatDate(doc.createdAt)}</TableCell>
                <TableCell>
                  <Link
                    href={`/admin/documents/${doc.id}`}
                    className="text-primary underline"
                  >
                    Revisar
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {documents.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No hay documentos
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
