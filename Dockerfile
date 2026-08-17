# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base

# Usa red del host durante build: evita fallos DNS en servidores
# donde el bridge de Docker no resuelve deb.debian.org
RUN --network=host sh -c '\
  for i in 1 2 3 4 5; do \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      tesseract-ocr \
      tesseract-ocr-spa \
      poppler-utils \
      openssl \
      ca-certificates && \
    rm -rf /var/lib/apt/lists/* && exit 0; \
    echo "Reintentando apt ($i/5)..."; sleep 5; \
  done; exit 1'

WORKDIR /app

FROM base AS development
COPY package.json package-lock.json ./
RUN --network=host npm ci --ignore-scripts
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS deps
COPY package.json package-lock.json ./
RUN --network=host npm ci --ignore-scripts

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN --network=host npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/lib/ocr/patterns ./lib/ocr/patterns

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
