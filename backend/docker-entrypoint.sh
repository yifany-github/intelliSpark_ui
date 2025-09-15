#!/usr/bin/env bash
set -euo pipefail

# Ensure attached_assets volume is writable by appuser when running on Fly
if [ -d "/app/attached_assets" ]; then
  # Initialize or backfill from bundled seed if present. Some volumes include 'lost+found',
  # so we cannot rely on emptiness; instead copy missing files only.
  if [ -d "/app/attached_assets_seed" ]; then
    echo "[entrypoint] Backfilling attached_assets from image seed (no overwrite)..."
    # Prefer rsync if available; otherwise cp -rn
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --ignore-existing /app/attached_assets_seed/ /app/attached_assets/ 2>/dev/null || true
    else
      cp -r -n /app/attached_assets_seed/. /app/attached_assets/ 2>/dev/null || true
    fi
  fi

  # Ensure expected subdirectories exist
  mkdir -p \
    /app/attached_assets/characters_img \
    /app/attached_assets/user_characters_img \
    /app/attached_assets/character_galleries

  # If we can't chown (read-only FS or lacking perms), ignore and continue
  chown -R appuser:appuser /app/attached_assets 2>/dev/null || true
fi

# Also ensure app directory is owned by appuser for caches/temp
chown -R appuser:appuser /app 2>/dev/null || true

# Drop privileges and exec the provided command
if command -v gosu >/dev/null 2>&1; then
  exec gosu appuser:appuser "$@"
else
  echo "[entrypoint] gosu not found; running as root"
  exec "$@"
fi
