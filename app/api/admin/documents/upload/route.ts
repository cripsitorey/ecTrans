import { NextRequest, NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { Role, DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { uploadDocument, validateUpload } from "@/lib/storage";
import { processDocument } from "@/lib/ocr/process-document";

/**
 * Carga de documentos desde el panel de administración.
 *
 * A diferencia de la app del chofer, que solo envía fotos, aquí se aceptan
 * también los PDF originales de los comprobantes electrónicos, que se leen de
 * su capa de texto sin pasar por OCR.
 */
export async function POST(req: NextRequest) {
  try {
    await requireRole([Role.ADMIN]);
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

    const declaredType = formData.get("type");
    const type =
      typeof declaredType === "string" &&
      Object.keys(DocumentType).includes(declaredType)
        ? (declaredType as DocumentType)
        : DocumentType.FACTURA;

    const document = await prisma.document.create({
      data: {
        companyId: session.user.companyId,
        type,
        storagePath,
        status: "PENDING",
        source: "PWA_CAMERA",
      },
    });

    // Sin un tipo declarado por el usuario, dejamos que el contenido lo decida.
    const result = await processDocument(document.id, {
      autoDetectType: typeof declaredType !== "string",
    });

    return NextResponse.json({
      documentId: document.id,
      type: result.type,
      status: result.status,
      extractedData: result.extractedData,
      confidence: result.confidence,
      source: result.source,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al subir documento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
