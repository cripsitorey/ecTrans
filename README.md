# ecTrans — Bitácora Digital de Transporte

MVP self-hosted para digitalizar hojas de ruta de transporte de carga en Ecuador.

## Stack

- **Next.js 14** (App Router, TypeScript, PWA)
- **PostgreSQL** + **Prisma**
- **MinIO** (storage S3-compatible)
- **Tesseract OCR** (español) + **sharp** (preprocesamiento)
- **Auth.js** (credenciales propias, bcrypt)
- **Docker Compose** (100% infraestructura propia)

## Inicio rápido

### 1. Configurar entorno

```bash
cp .env.example .env
# Editar .env con secretos reales en producción
```

### 2. Levantar con Docker

```bash
docker compose up --build
```

La app estará en http://localhost:3000 (local) o `http://<IP-del-servidor>:3000` en red.

> **Importante:** en el servidor, edita `.env` y pon `AUTH_URL` y `NEXTAUTH_URL` con la IP o dominio real (ej. `http://192.168.100.71:3000`). Luego reinicia: `docker compose restart app`.

### 3. Migraciones y seed (primera vez)

Las migraciones corren **automáticamente** al iniciar el contenedor `app`.

Para el seed demo (solo la primera vez):

```bash
docker compose exec app node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts
```

O reinicia con seed automático:

```bash
RUN_SEED=true docker compose up -d app
# Luego vuelve RUN_SEED=false en docker-compose o .env
```

Comandos manuales (si necesitas):

```bash
docker compose exec app node ./node_modules/prisma/build/index.js migrate deploy
docker compose exec app node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts
```

> No uses `npx` dentro del contenedor de producción — el usuario `nextjs` no tiene home válido para npm cache.

### Desarrollo local (sin Docker para la app)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up postgres minio minio-init -d
npm install
npm run db:push
npm run db:seed
npm run dev
```

## Usuarios demo (seed)

| Rol   | Email                 | Contraseña |
|-------|-----------------------|------------|
| Admin | admin@ectrans.demo    | demo1234   |
| Chofer| chofer@ectrans.demo   | demo1234   |

## Rutas principales

| Ruta | Rol | Descripción |
|------|-----|-------------|
| `/capture` | CHOFER | Cámara custom → OCR → bitácora |
| `/trips` | CHOFER | Bitácora del conductor |
| `/dashboard` | ADMIN | Stats y alertas |
| `/admin/trips` | ADMIN | Hoja de ruta completa |
| `/admin/documents` | ADMIN | Cola de revisión OCR |

## Worker IMAP (peajes) — INACTIVO

El servicio de polling IMAP está preparado pero **no arranca por defecto**.

Para activarlo cuando esté listo:

```bash
# Configurar variables IMAP_* en .env
docker compose --profile imap up worker
```

Ver [worker/README.md](worker/README.md) para detalles.

## Producción

- No exponer puertos de Postgres/MinIO a internet
- Colocar la app detrás de reverse proxy con TLS (Caddy/Nginx)
- Cambiar `AUTH_SECRET`, credenciales de Postgres y MinIO
- Bucket MinIO privado (configurado automáticamente por minio-init)

### Si el build falla con "Temporary failure resolving deb.debian.org"

El Dockerfile ya usa `network: host` durante `apt-get` y `npm`. Si persiste, configura DNS en Docker:

```json
// /etc/docker/daemon.json
{
  "dns": ["8.8.8.8", "1.1.1.1"]
}
```

Luego: `systemctl restart docker` y vuelve a ejecutar `docker compose up -d --build`.

## Estructura OCR

Los patrones de extracción por tipo de documento viven en `lib/ocr/patterns/`.
El parser de facturas ecuatorianas (`lib/ocr/parsers/factura.ts`) lee `factura.ec.json`.

Estados de documento:
- `PENDING` → en cola
- `EXTRACTED` → campos mínimos OK
- `NEEDS_REVIEW` → texto OCR pero campos incompletos
- `ERROR` → fallo técnico OCR
- `VALIDATED` → revisado por humano
