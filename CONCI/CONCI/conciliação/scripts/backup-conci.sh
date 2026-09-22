#!/bin/bash
# Copia o banco CONCI para fora da pasta do sistema.
# Um deploy que substitui o código não apaga estes arquivos.
set -euo pipefail
DEST="${CONCI_BACKUP_DIR:-/root/PROJETOS/exito/backups/conci}"
mkdir -p "$DEST"
STAMP="$(date +%Y%m%d-%H%M)"
docker exec dashboards-nova-pg pg_dump -U postgres --no-owner --no-acl -d CONCI | gzip > "$DEST/CONCI-$STAMP.sql.gz"
find "$DEST" -name 'CONCI-*.sql.gz' -mtime +30 -delete
echo "backup $DEST/CONCI-$STAMP.sql.gz"
