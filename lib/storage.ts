import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const endpoint = process.env.MINIO_ENDPOINT ?? "localhost";
const port = process.env.MINIO_PORT ?? "9000";
const useSSL = process.env.MINIO_USE_SSL === "true";
const bucket = process.env.MINIO_BUCKET ?? "ectrans-documents";

export const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: `${useSSL ? "https" : "http"}://${endpoint}:${port}`,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY ?? "ectrans_minio",
    secretAccessKey: process.env.MINIO_SECRET_KEY ?? "ectrans_minio_secret",
  },
  forcePathStyle: true,
});

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

export const ALLOWED_MIME_TYPES = Object.keys(MIME_TO_EXT);
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
};

export function detectMimeType(buffer: Buffer): string | null {
  for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const sig of signatures) {
      if (sig.every((byte, i) => buffer[i] === byte)) {
        return mime;
      }
    }
  }
  return null;
}

export function validateUpload(buffer: Buffer, declaredMime?: string): string {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("El archivo excede el tamaño máximo de 10 MB");
  }

  const detected = detectMimeType(buffer);
  if (!detected) {
    throw new Error("Tipo de archivo no permitido. Use JPG, PNG o PDF.");
  }

  if (declaredMime && declaredMime !== detected) {
    throw new Error("El tipo declarado no coincide con el contenido del archivo");
  }

  return detected;
}

export async function uploadDocument(
  companyId: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const ext = MIME_TO_EXT[mimeType];
  if (!ext) throw new Error("Tipo MIME no soportado");

  const key = `documents/${companyId}/${randomUUID()}.${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  return key;
}

export async function downloadDocument(key: string): Promise<Buffer> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  const stream = response.Body;
  if (!stream) throw new Error("No se pudo descargar el archivo");

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 300
): Promise<string> {
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn }
  );
}
