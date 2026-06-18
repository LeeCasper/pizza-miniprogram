#!/bin/bash
# Pizza DB daily backup script
# Usage: crontab -e → 0 3 * * * /opt/pizza-server/scripts/backup-db.sh >> /var/log/pizza/backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load DB credentials from .env
if [ -f "$PROJECT_DIR/pizza-server/.env" ]; then
  export $(grep -E '^DB_(HOST|PORT|USER|PASSWORD|NAME)=' "$PROJECT_DIR/pizza-server/.env" | xargs)
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-pizza_app}"
DB_NAME="${DB_NAME:-pizza}"

BACKUP_DIR="${PROJECT_DIR}/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="pizza_${DATE}.sql.gz"

mkdir -p "$BACKUP_DIR"

mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --password="$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  "$DB_NAME" | gzip > "$BACKUP_DIR/$FILENAME"

echo "[Backup] $(date '+%Y-%m-%d %H:%M:%S') Created: $FILENAME ($(du -h "$BACKUP_DIR/$FILENAME" | cut -f1))"

# Retain last 7 days
find "$BACKUP_DIR" -name "pizza_*.sql.gz" -mtime +7 -delete
echo "[Backup] Cleaned up backups older than 7 days"
