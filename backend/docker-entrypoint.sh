#!/usr/bin/env bash
set -euo pipefail

# Ensure app directory is owned by appuser for caches/temp
chown -R appuser:appuser /app 2>/dev/null || true

# Drop privileges and exec the provided command
if command -v gosu >/dev/null 2>&1; then
  exec gosu appuser:appuser "$@"
else
  echo "[entrypoint] gosu not found; running as root"
  exec "$@"
fi
