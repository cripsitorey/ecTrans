/**
 * Worker IMAP para facturas de peaje — INACTIVO por defecto.
 *
 * Activar con: docker compose --profile imap up worker
 *
 * Requiere variables de entorno:
 *   IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASSWORD, IMAP_PEAJE_SENDERS
 *
 * Flujo planificado:
 * 1. Conectar a bandeja IMAP cada N minutos (node-cron)
 * 2. Filtrar correos no leídos de remitentes de peajes
 * 3. Descargar adjuntos PDF/imagen
 * 4. Subir a MinIO y crear Document (type: PEAJE, source: IMAP_PEAJES)
 * 5. Invocar pipeline OCR (mismo que la PWA)
 * 6. Marcar correo como leído
 */

import cron from "node-cron";

const CRON = process.env.IMAP_POLL_CRON ?? "*/5 * * * *";

console.log("[ectrans-worker] Worker IMAP iniciado (modo stub)");
console.log(`[ectrans-worker] Cron configurado: ${CRON}`);
console.log("[ectrans-worker] Configure IMAP_* en .env y complete imap-poll.ts para activar");

cron.schedule(CRON, async () => {
  if (!process.env.IMAP_HOST || !process.env.IMAP_USER) {
    console.log("[ectrans-worker] IMAP no configurado — omitiendo ciclo");
    return;
  }

  // TODO: implementar con imapflow cuando se active en producción
  console.log("[ectrans-worker] Ciclo IMAP — pendiente de implementación");
});

// Mantener proceso vivo
process.stdin.resume();
