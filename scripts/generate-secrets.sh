#!/bin/sh
# Generates the FY Medical production secrets into a file as NAME=value lines.
# Usage: sh generate-secrets.sh [output file]   (default: fymedical-secrets.env)
set -eu
out="${1:-fymedical-secrets.env}"
if [ -e "$out" ]; then
  echo "$out already exists; not overwriting it (the old keys may already be in use)." >&2
  exit 1
fi
umask 077   # only you can read the file
{
  echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"
  echo "BLIND_INDEX_KEY=$(openssl rand -base64 32)"
  echo "CRON_SECRET=$(openssl rand -hex 32)"
  echo "DB_PASSWORD=$(openssl rand -hex 32)"
  echo "APP_DB_PASSWORD=$(openssl rand -hex 32)"
} > "$out"
echo "Wrote $out. Copy it into your password manager, keep two offline copies of ENCRYPTION_KEY, then delete the file."
