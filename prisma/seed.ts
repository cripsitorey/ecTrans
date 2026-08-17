import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 12);

  const company = await prisma.company.upsert({
    where: { id: "seed-company" },
    update: {},
    create: {
      id: "seed-company",
      name: "Transportes Demo Ecuador",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@ectrans.demo" },
    update: {
      passwordHash,
      fullName: "Administrador Demo",
      name: "Administrador Demo",
      role: Role.ADMIN,
      companyId: company.id,
    },
    create: {
      email: "admin@ectrans.demo",
      fullName: "Administrador Demo",
      name: "Administrador Demo",
      passwordHash,
      role: Role.ADMIN,
      companyId: company.id,
    },
  });

  const driver = await prisma.user.upsert({
    where: { email: "chofer@ectrans.demo" },
    update: {},
    create: {
      email: "chofer@ectrans.demo",
      fullName: "Carlos Mendoza",
      name: "Carlos Mendoza",
      passwordHash,
      role: Role.CHOFER,
      companyId: company.id,
    },
  });

  const vehicle = await prisma.vehicle.upsert({
    where: {
      companyId_plate: {
        companyId: company.id,
        plate: "ABC-1234",
      },
    },
    update: {},
    create: {
      companyId: company.id,
      plate: "ABC-1234",
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  await prisma.trip.deleteMany({ where: { companyId: company.id } });

  await prisma.trip.createMany({
    data: [
      {
        companyId: company.id,
        vehicleId: vehicle.id,
        driverId: driver.id,
        date: twoDaysAgo,
        origin: "Quito",
        destination: "Guayaquil",
        productOrGuideNumber: "GR-001234",
        clientNameOrCompany: "Distribuidora Andina",
        viaticos: 45.0,
        diesel: 120.5,
        invoiceNumber: "001-001-000123456",
        advance: 200.0,
        notes: "Entrega sin novedad",
      },
      {
        companyId: company.id,
        vehicleId: vehicle.id,
        driverId: driver.id,
        date: yesterday,
        origin: "Guayaquil",
        destination: "Cuenca",
        productOrGuideNumber: "GR-001235",
        clientNameOrCompany: "Comercial del Sur",
        viaticos: 35.0,
        diesel: 95.0,
        invoiceNumber: "001-001-000123457",
        advance: 150.0,
        notes: null,
      },
      {
        companyId: company.id,
        vehicleId: vehicle.id,
        driverId: driver.id,
        date: today,
        origin: "Cuenca",
        destination: "Quito",
        productOrGuideNumber: null,
        clientNameOrCompany: null,
        viaticos: null,
        diesel: null,
        invoiceNumber: null,
        advance: null,
        notes: "Viaje en curso",
      },
    ],
  });

  console.log("Seed completado:");
  console.log(`  Admin:  ${admin.email} / demo1234`);
  console.log(`  Chofer: ${driver.email} / demo1234`);
  console.log(`  Vehículo: ${vehicle.plate}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
