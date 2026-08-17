#!/bin/sh
# Verifica usuarios demo en Postgres
set -e

echo "=== Usuarios en la base de datos ==="
docker compose exec postgres psql -U ectrans -d ectrans -c \
  'SELECT email, role, "fullName" FROM "User" ORDER BY email;'

echo ""
echo "=== Conteo de tablas ==="
docker compose exec postgres psql -U ectrans -d ectrans -c \
  "SELECT
    (SELECT COUNT(*) FROM \"User\") AS users,
    (SELECT COUNT(*) FROM \"Company\") AS companies,
    (SELECT COUNT(*) FROM \"Trip\") AS trips;"
