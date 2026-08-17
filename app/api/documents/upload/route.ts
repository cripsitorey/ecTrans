import { NextRequest, NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { uploadDocument, validateUpload } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    await requireRole([Role.CHOFER]);
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = validateUpload(buffer, file.type || undefined);
    const storagePath = await uploadDocument(
      session.user.companyId,
      buffer,
      mimeType
    );

    const document = await prisma.document.create({
      data: {
        companyId: session.user.companyId,
        type: "FACTURA",
        storagePath,
        status: "PENDING",
        source: "PWA_CAMERA",
      },
    });

    return NextResponse.json({
      documentId: document.id,
      storagePath,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al subir documento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
