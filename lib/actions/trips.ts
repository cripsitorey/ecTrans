"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role, DocumentType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { processDocument } from "@/lib/ocr/process-document";

export async function confirmDocumentToTrip(input: {
  documentId: string;
  vehicleId: string;
  fields: {
    amount?: number;
    date?: string;
    invoiceNumber?: string;
    origin?: string;
    destination?: string;
    productOrGuideNumber?: string;
    clientNameOrCompany?: string;
    viaticos?: number;
    diesel?: number;
    advance?: number;
    notes?: string;
  };
}) {
  const session = await requireRole([Role.CHOFER]);

  const document = await prisma.document.findFirst({
    where: {
      id: input.documentId,
      companyId: session.user.companyId,
    },
  });

  if (!document) throw new Error("Documento no encontrado");

  const tripDate = input.fields.date
    ? new Date(input.fields.date.split("/").reverse().join("-"))
    : new Date();

  tripDate.setHours(0, 0, 0, 0);

  let trip = await prisma.trip.findFirst({
    where: {
      companyId: session.user.companyId,
      driverId: session.user.id,
      vehicleId: input.vehicleId,
      date: tripDate,
    },
  });

  const tripData = buildTripMerge(document.type, input.fields);

  if (trip) {
    trip = await prisma.trip.update({
      where: { id: trip.id },
      data: tripData,
    });
  } else {
    trip = await prisma.trip.create({
      data: {
        companyId: session.user.companyId,
        driverId: session.user.id,
        vehicleId: input.vehicleId,
        date: tripDate,
        ...tripData,
      },
    });
  }

  await prisma.document.update({
    where: { id: document.id },
    data: {
      tripId: trip.id,
      extractedData: input.fields as Prisma.InputJsonValue,
      status: "VALIDATED",
    },
  });

  revalidatePath("/trips");
  revalidatePath("/dashboard");
  revalidatePath("/admin/trips");

  return { tripId: trip.id };
}

function buildTripMerge(
  type: DocumentType,
  fields: {
    amount?: number;
    invoiceNumber?: string;
    origin?: string;
    destination?: string;
    productOrGuideNumber?: string;
    clientNameOrCompany?: string;
    viaticos?: number;
    diesel?: number;
    advance?: number;
    notes?: string;
  }
) {
  const data: Record<string, unknown> = {};

  if (fields.origin) data.origin = fields.origin;
  if (fields.destination) data.destination = fields.destination;
  if (fields.productOrGuideNumber)
    data.productOrGuideNumber = fields.productOrGuideNumber;
  if (fields.clientNameOrCompany)
    data.clientNameOrCompany = fields.clientNameOrCompany;
  if (fields.notes) data.notes = fields.notes;
  if (fields.advance !== undefined) data.advance = fields.advance;

  switch (type) {
    case "FACTURA":
      if (fields.diesel !== undefined) data.diesel = fields.diesel;
      else if (fields.amount !== undefined) data.diesel = fields.amount;
      if (fields.invoiceNumber) data.invoiceNumber = fields.invoiceNumber;
      break;
    case "VOUCHER":
      if (fields.viaticos !== undefined) data.viaticos = fields.viaticos;
      else if (fields.amount !== undefined) data.viaticos = fields.amount;
      break;
    case "GUIA":
      if (fields.productOrGuideNumber)
        data.productOrGuideNumber = fields.productOrGuideNumber;
      if (fields.clientNameOrCompany)
        data.clientNameOrCompany = fields.clientNameOrCompany;
      break;
    default:
      break;
  }

  return data;
}

export async function reprocessDocument(documentId: string) {
  const session = await requireRole([Role.ADMIN]);
  const document = await prisma.document.findFirst({
    where: { id: documentId, companyId: session.user.companyId },
  });
  if (!document) throw new Error("Documento no encontrado");

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "PENDING" },
  });

  const result = await processDocument(documentId);

  revalidatePath("/admin/documents");
  revalidatePath(`/admin/documents/${documentId}`);

  return result;
}

export async function validateDocument(
  documentId: string,
  extractedData: Record<string, unknown>
) {
  const session = await requireRole([Role.ADMIN]);

  await prisma.document.update({
    where: {
      id: documentId,
      companyId: session.user.companyId,
    },
    data: {
      extractedData: extractedData as Prisma.InputJsonValue,
      status: "VALIDATED",
    },
  });

  revalidatePath("/admin/documents");
  revalidatePath(`/admin/documents/${documentId}`);
}

export async function linkDocumentToTrip(documentId: string, tripId: string) {
  const session = await requireRole([Role.ADMIN]);

  await prisma.document.update({
    where: {
      id: documentId,
      companyId: session.user.companyId,
    },
    data: { tripId },
  });

  revalidatePath("/admin/documents");
}

export async function getDriverVehicle() {
  const session = await requireRole([Role.CHOFER]);

  const vehicle = await prisma.vehicle.findFirst({
    where: { companyId: session.user.companyId },
    orderBy: { plate: "asc" },
  });

  return vehicle;
}

export async function getDriverTrips() {
  const session = await requireRole([Role.CHOFER]);

  return prisma.trip.findMany({
    where: {
      companyId: session.user.companyId,
      driverId: session.user.id,
    },
    include: { vehicle: true },
    orderBy: { date: "desc" },
    take: 30,
  });
}

export async function getAdminTrips(filters: {
  vehicleId?: string;
  driverId?: string;
  year: number;
  month: number;
}) {
  const session = await requireRole([Role.ADMIN]);

  const start = new Date(filters.year, filters.month - 1, 1);
  const end = new Date(filters.year, filters.month, 0, 23, 59, 59, 999);

  return prisma.trip.findMany({
    where: {
      companyId: session.user.companyId,
      ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      ...(filters.driverId ? { driverId: filters.driverId } : {}),
      date: { gte: start, lte: end },
    },
    include: {
      driver: true,
      vehicle: true,
    },
    orderBy: { date: "asc" },
  });
}

export async function getAdminDocuments() {
  const session = await requireRole([Role.ADMIN]);

  const documents = await prisma.document.findMany({
    where: { companyId: session.user.companyId },
    include: {
      trip: { include: { driver: true, vehicle: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const statusOrder = {
    NEEDS_REVIEW: 0,
    ERROR: 1,
    PENDING: 2,
    EXTRACTED: 3,
    VALIDATED: 4,
  };

  return documents.sort(
    (a, b) => statusOrder[a.status] - statusOrder[b.status]
  );
}

export async function getDashboardStats(year: number, month: number) {
  const session = await requireRole([Role.ADMIN]);

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const trips = await prisma.trip.findMany({
    where: {
      companyId: session.user.companyId,
      date: { gte: start, lte: end },
    },
    include: { driver: true, vehicle: true },
  });

  const needsReview = await prisma.document.count({
    where: {
      companyId: session.user.companyId,
      status: { in: ["NEEDS_REVIEW", "ERROR"] },
    },
  });

  const incompleteTrips = trips.filter(
    (t) =>
      !t.origin ||
      !t.destination ||
      t.diesel === null ||
      t.viaticos === null
  ).length;

  const totals = trips.reduce(
    (acc, t) => ({
      diesel: acc.diesel + Number(t.diesel ?? 0),
      viaticos: acc.viaticos + Number(t.viaticos ?? 0),
      advance: acc.advance + Number(t.advance ?? 0),
    }),
    { diesel: 0, viaticos: 0, advance: 0 }
  );

  const byDriver = Object.values(
    trips.reduce<
      Record<
        string,
        { name: string; diesel: number; viaticos: number; advance: number }
      >
    >((acc, t) => {
      const key = t.driverId;
      if (!acc[key]) {
        acc[key] = {
          name: t.driver.fullName,
          diesel: 0,
          viaticos: 0,
          advance: 0,
        };
      }
      acc[key].diesel += Number(t.diesel ?? 0);
      acc[key].viaticos += Number(t.viaticos ?? 0);
      acc[key].advance += Number(t.advance ?? 0);
      return acc;
    }, {})
  );

  const byVehicle = Object.values(
    trips.reduce<
      Record<
        string,
        { plate: string; diesel: number; viaticos: number; advance: number }
      >
    >((acc, t) => {
      const key = t.vehicleId;
      if (!acc[key]) {
        acc[key] = {
          plate: t.vehicle.plate,
          diesel: 0,
          viaticos: 0,
          advance: 0,
        };
      }
      acc[key].diesel += Number(t.diesel ?? 0);
      acc[key].viaticos += Number(t.viaticos ?? 0);
      acc[key].advance += Number(t.advance ?? 0);
      return acc;
    }, {})
  );

  return { totals, byDriver, byVehicle, needsReview, incompleteTrips, tripCount: trips.length };
}

export async function getFilterOptions() {
  const session = await requireRole([Role.ADMIN]);

  const [vehicles, drivers] = await Promise.all([
    prisma.vehicle.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { plate: "asc" },
    }),
    prisma.user.findMany({
      where: { companyId: session.user.companyId, role: Role.CHOFER },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return { vehicles, drivers };
}
