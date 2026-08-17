import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { getSignedDownloadUrl } from "@/lib/storage";
import { notFound } from "next/navigation";
import { DocumentReviewForm } from "@/components/admin/DocumentReviewForm";
import { DocumentStatusBadge } from "@/components/admin/DocumentStatusBadge";

interface PageProps {
  params: { id: string };
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const session = await requireRole([Role.ADMIN]);

  const document = await prisma.document.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
    include: {
      trip: { include: { driver: true, vehicle: true } },
    },
  });

  if (!document) notFound();

  const imageUrl = await getSignedDownloadUrl(document.storagePath);

  const trips = await prisma.trip.findMany({
    where: { companyId: session.user.companyId },
    include: { driver: true, vehicle: true },
    orderBy: { date: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Revisión de documento</h1>
          <p className="text-muted-foreground">
            {document.type} — <DocumentStatusBadge status={document.status} />
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">Imagen capturada</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Documento"
            className="max-h-[600px] w-full rounded object-contain"
          />
        </div>

        <DocumentReviewForm
          document={{
            id: document.id,
            status: document.status,
            rawOcrText: document.rawOcrText,
            extractedData: document.extractedData as Record<string, unknown> | null,
            tripId: document.tripId,
          }}
          trips={trips.map((t) => ({
            id: t.id,
            label: `${t.date.toLocaleDateString("es-EC")} — ${t.driver.fullName} — ${t.vehicle.plate}`,
          }))}
        />
      </div>
    </div>
  );
}
