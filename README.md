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

## Procesamiento de documentos

### Cómo se obtiene el texto

`lib/ocr/extract-text.ts` elige el camino más fiable según el archivo:

| Entrada | Camino | Precisión |
|---|---|---|
| Foto (chofer) | Tesseract sobre imagen preprocesada | alta en documentos impresos |
| PDF electrónico (admin) | capa de texto vía `pdftotext` | exacta, sin OCR |
| PDF escaneado (admin) | rasterizado + Tesseract | como una foto |

### Clave de acceso del SRI

`lib/ocr/sri/clave-acceso.ts` decodifica los 49 dígitos que identifican a todo
comprobante electrónico ecuatoriano. De ahí salen, de una sola lectura, la fecha
de emisión, el tipo de comprobante, el RUC del emisor y el número completo. El
dígito verificador módulo 11 confirma que la lectura es correcta.

Como el tipo va codificado (`01` factura, `06` guía de remisión), el documento se
clasifica solo: lo que el chofer eligió en pantalla queda como respaldo.

Ese dígito verificador sirve para **detectar** errores, no para corregirlos: entre
las sustituciones de un dígito, aproximadamente 1 de cada 11 vuelve a validar por
azar. Cuando la clave no cuadra, se reconstruye a partir de los campos que el RIDE
imprime por separado (`reconstructFromHints`).

### Parsers

- `lib/ocr/parsers/factura.ts` — RIDE del SRI y, como respaldo, comprobantes de
  formato libre con los patrones de `lib/ocr/patterns/factura.ec.json`
- `lib/ocr/parsers/guia.ts` — guía de remisión electrónica y guía manual
- `lib/ocr/parsers/voucher.ts` — pendiente, a la espera de ejemplos reales

Al leer un RIDE, los espacios consecutivos se conservan a propósito: son lo único
que separa una columna de la siguiente, y sin ellos el valor de un campo se vuelve
indistinguible del rótulo vecino.

### Documentos manuscritos

Tesseract reconoce texto impreso, no escritura a mano: sobre una guía de remisión
manual recupera los rótulos del formulario pero ninguno de los valores escritos a
bolígrafo. Para esos casos, `lib/ocr/vision/extract-vision.ts` consulta un modelo
de visión. Es opcional: sin `AI_GATEWAY_API_KEY` el documento sigue su curso hacia
captura manual asistida en lugar de fallar. Todo lo que resuelve la visión pasa
siempre por revisión humana.

### Probar los parsers

Sin base de datos ni MinIO, contra archivos reales:

```bash
npx tsx scripts/test-extraction.ts factura.pdf foto-guia.jpg
npx tsx scripts/test-extraction.ts --type=GUIA guia-manual.jpg
```

### Estados de documento

- `PENDING` → en cola
- `EXTRACTED` → campos mínimos OK
- `NEEDS_REVIEW` → se leyó texto pero los campos están incompletos, o los resolvió el modelo de visión
- `ERROR` → no se obtuvo texto usable
- `VALIDATED` → revisado por humano
