# Worker IMAP — Facturas de Peaje

Este servicio está **documentado pero inactivo** en el MVP inicial.

## Por qué está inactivo

El flujo principal (PWA chofer → OCR → bitácora) debe validarse primero con documentos reales antes de activar la ingesta automática por correo.

## Cómo activar

1. Configurar variables en `.env`:

```env
IMAP_HOST=imap.ejemplo.com
IMAP_PORT=993
IMAP_USER=peajes@empresa.com
IMAP_PASSWORD=secret
IMAP_PEAJE_SENDERS=peajes@autopista.com,tol@via.com
IMAP_POLL_CRON=*/5 * * * *
```

2. Levantar el worker:

```bash
docker compose --profile imap up worker
```

## Flujo implementado (stub)

- `imap-poll.ts` corre con `node-cron` cada 5 minutos
- Si `IMAP_HOST` no está configurado, omite el ciclo
- La lógica completa con `imapflow` se implementará en la siguiente iteración

## Integración futura

El worker compartirá el mismo pipeline OCR que la app:
- Descargar adjunto → MinIO (`documents/{companyId}/{uuid}`)
- Crear `Document` con `type: PEAJE`, `source: IMAP_PEAJES`
- Llamar a `processDocument()` (mismo código en `lib/ocr/process-document.ts`)

Para PDFs, usar `poppler-utils` (pdftoppm) instalado en el contenedor de la app.
