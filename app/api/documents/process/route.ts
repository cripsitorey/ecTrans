import { NextRequest, NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { Role, DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { processDocument } from "@/lib/ocr/process-document";

export async function POST(req: NextRequest) {
  try {
    await requireRole([Role.CHOFER]);
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const type = body.type as DocumentType;

    if (!["FACTURA", "VOUCHER", "GUIA"].includes(type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    const document = await prisma.document.findFirst({
      where: {
        companyId: session.user.companyId,
        status: "PENDING",
        source: "PWA_CAMERA",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!document) {
      return NextResponse.json(
        { error: "No hay documento pendiente. Suba una foto primero." },
        { status: 404 }
      );
    }

    await prisma.document.update({
      where: { id: document.id },
      data: { type },
    });

    const result = await processDocument(document.id);

    return NextResponse.json({
      documentId: document.id,
      status: result.status,
      extractedData: result.extractedData,
      confidence: result.confidence,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al procesar documento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
