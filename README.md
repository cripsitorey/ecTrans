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

> **Importante:** tras editar `.env`, **recrea** el contenedor (un `restart` no basta):
>
> ```bash
> docker compose up -d --force-recreate app
> docker compose exec app printenv AUTH_URL NEXTAUTH_URL AUTH_TRUST_HOST
> ```

### 3. Migraciones y seed (primera vez)

Usa los servicios `setup` (imagen builder con Prisma completo):

```bash
docker compose --profile setup run --rm migrate
docker compose --profile setup run --rm seed
docker compose up -d app
```

Orden completo de despliegue:

```bash
docker compose up -d --build postgres minio minio-init
docker compose --profile setup run --rm migrate
docker compose --profile setup run --rm seed
docker compose up -d --build app
```

Verificar que el seed cargó usuarios:

```bash
chmod +x scripts/check-db.sh
./scripts/check-db.sh
```

Deberías ver `admin@ectrans.demo` y `chofer@ectrans.demo`. Si la tabla está vacía, vuelve a correr el seed:

```bash
docker compose --profile setup run --rm seed
```

Credenciales demo: `demo1234` (ambos usuarios).

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
