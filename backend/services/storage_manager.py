from __future__ import annotations

import mimetypes
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import anyio
import aiofiles  # type: ignore
import requests

from config import settings


class StorageManagerError(Exception):
    """Raised when storage operations cannot be completed."""


@dataclass
class StoredFile:
    """Metadata returned after storing a file."""

    path: str
    public_url: str
    size: int
    mimetype: Optional[str] = None


class StorageManager:
    """Abstraction over local filesystem and Supabase Storage backends."""

    def __init__(self) -> None:
        self._use_supabase = settings.supabase_storage_enabled
        self._supabase_bucket: Optional[str] = None
        self._supabase_public_base: Optional[str] = None
        self._supabase_base_url: Optional[str] = None
        self._supabase_service_key: Optional[str] = None

        if self._use_supabase:
            if not settings.supabase_url or not settings.supabase_service_role_key:
                raise StorageManagerError(
                    "Supabase Storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
                )

            if not settings.supabase_storage_bucket:
                raise StorageManagerError(
                    "SUPABASE_STORAGE_BUCKET must be defined when using Supabase Storage."
                )

            base_url = settings.supabase_url.rstrip("/")
            self._supabase_bucket = settings.supabase_storage_bucket
            self._supabase_base_url = f"{base_url}/storage/v1"
            self._supabase_service_key = settings.supabase_service_role_key

            override_base = settings.supabase_public_bucket_base_url
            if override_base:
                self._supabase_public_base = override_base.rstrip("/")
            else:
                self._supabase_public_base = (
                    f"{base_url}/storage/v1/object/public/{self._supabase_bucket}"
                )
        else:
            fly_volume_path = Path("/app/attached_assets")
            local_dev_path = Path(__file__).parent.parent.parent / "attached_assets"

            is_deployed = bool(
                os.getenv("FLY_APP_NAME") or Path("/.dockerenv").exists() or fly_volume_path.exists()
            )

            if is_deployed and fly_volume_path.exists():
                self._local_base_path = fly_volume_path
            elif local_dev_path.exists():
                self._local_base_path = local_dev_path
            else:
                local_dev_path.mkdir(parents=True, exist_ok=True)
                self._local_base_path = local_dev_path

    @property
    def using_supabase(self) -> bool:
        return self._use_supabase

    async def upload(self, path: str, content: bytes, mimetype: Optional[str] = None) -> StoredFile:
        """Persist file content to the configured backend."""
        normalized_path = self._normalize_path(path)

        if self._use_supabase and self._supabase_bucket:
            url = f"{self._supabase_base_url}/object/{self._supabase_bucket}/{normalized_path}"
            headers = {
                "Authorization": f"Bearer {self._supabase_service_key}",
                "apikey": self._supabase_service_key,
                "Content-Type": mimetype or "application/octet-stream",
                "cache-control": "public, max-age=86400",
            }

            def _upload() -> None:
                response = requests.post(
                    url,
                    params={"upsert": "false"},
                    headers=headers,
                    data=content,
                    timeout=30,
                )
                if response.status_code >= 400:
                    raise StorageManagerError(
                        f"Supabase upload failed ({response.status_code}): {response.text}"
                    )

            await anyio.to_thread.run_sync(_upload)

            public_base = self._supabase_public_base or ""
            public_url = f"{public_base}/{normalized_path}" if public_base else normalized_path
            return StoredFile(
                path=normalized_path,
                public_url=public_url,
                size=len(content),
                mimetype=mimetype,
            )

        # Local filesystem fallback
        base_path = self._local_base_path  # type: ignore[attr-defined]
        target_path = base_path / normalized_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(target_path, "wb") as handle:
            await handle.write(content)

        public_url = f"/assets/{normalized_path}"
        return StoredFile(
            path=normalized_path,
            public_url=public_url,
            size=len(content),
            mimetype=mimetype,
        )

    async def delete_object(self, path: str) -> None:
        normalized_path = self._normalize_path(path)

        if self._use_supabase and self._supabase_bucket:
            url = f"{self._supabase_base_url}/object/{self._supabase_bucket}/{normalized_path}"

            def _delete() -> None:
                response = requests.delete(
                    url,
                    headers={
                        "Authorization": f"Bearer {self._supabase_service_key}",
                        "apikey": self._supabase_service_key,
                    },
                    timeout=30,
                )
                if response.status_code >= 400:
                    # Ignore 404s (already gone)
                    if response.status_code != 404:
                        raise StorageManagerError(
                            f"Supabase delete failed ({response.status_code}): {response.text}"
                        )

            await anyio.to_thread.run_sync(_delete)
            return

        base_path = self._local_base_path  # type: ignore[attr-defined]
        target_path = base_path / normalized_path
        if target_path.exists() and target_path.is_file():
            try:
                target_path.unlink()
            except OSError:
                pass

    async def delete_prefix(self, prefix: str) -> None:
        normalized_prefix = self._normalize_path(prefix).rstrip("/")

        objects = await self.list_objects(normalized_prefix)
        if not objects:
            return

        paths = [obj["path"] for obj in objects]

        if self._use_supabase and self._supabase_bucket:
            for obj_path in paths:
                try:
                    await self.delete_object(obj_path)
                except StorageManagerError:
                    pass
            return

        base_path = self._local_base_path  # type: ignore[attr-defined]
        for obj in paths:
            target_path = base_path / obj
            if target_path.exists():
                try:
                    if target_path.is_file():
                        target_path.unlink()
                    elif target_path.is_dir():
                        for child in target_path.rglob("*"):
                            if child.is_file():
                                child.unlink()
                        child_dirs = sorted(
                            [p for p in target_path.rglob("*") if p.is_dir()],
                            key=lambda p: len(str(p)),
                            reverse=True,
                        )
                        for directory in child_dirs:
                            directory.rmdir()
                        target_path.rmdir()
                except OSError:
                    pass

    async def list_objects(self, prefix: str = "") -> List[Dict[str, Any]]:
        normalized_prefix = self._normalize_path(prefix).rstrip("/")

        if self._use_supabase and self._supabase_bucket:
            url = f"{self._supabase_base_url}/object/list/{self._supabase_bucket}"
            payload = {
                "prefix": normalized_prefix,
                "limit": 1000,
                "offset": 0,
                "sortBy": {"column": "name", "order": "asc"},
            }

            def _list() -> List[Dict[str, Any]]:
                response = requests.post(
                    url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self._supabase_service_key}",
                        "apikey": self._supabase_service_key,
                        "Content-Type": "application/json",
                    },
                    timeout=30,
                )
                if response.status_code >= 400:
                    raise StorageManagerError(
                        f"Supabase list failed ({response.status_code}): {response.text}"
                    )
                return response.json()

            entries = await anyio.to_thread.run_sync(_list)

            results: List[Dict[str, Any]] = []
            for entry in entries:
                name = entry.get("name")
                if not name:
                    continue
                full_path = (
                    f"{normalized_prefix}/{name}" if normalized_prefix else name
                )
                results.append(
                    {
                        "path": self._normalize_path(full_path),
                        "name": name,
                        "size": entry.get("metadata", {}).get("size", 0),
                        "mimetype": entry.get("metadata", {}).get("mimetype"),
                    }
                )
            return results

        base_path = self._local_base_path  # type: ignore[attr-defined]
        start_dir = base_path / normalized_prefix if normalized_prefix else base_path
        if not start_dir.exists():
            return []

        results: List[Dict[str, Any]] = []
        for file_path in start_dir.rglob("*"):
            if file_path.is_file():
                relative = file_path.relative_to(base_path).as_posix()
                mimetype = mimetypes.guess_type(file_path.name)[0]
                results.append(
                    {
                        "path": relative,
                        "name": file_path.name,
                        "size": file_path.stat().st_size,
                        "mimetype": mimetype,
                    }
                )
        return results

    def build_public_url(self, path: str) -> str:
        normalized_path = self._normalize_path(path)
        if self._use_supabase:
            base = self._supabase_public_base or ""
            return f"{base}/{normalized_path}" if base else normalized_path
        return f"/assets/{normalized_path}"

    def path_from_public_url(self, url: str) -> Optional[str]:
        if not url:
            return None

        if self._use_supabase and self._supabase_public_base:
            base = f"{self._supabase_public_base}/"
            if url.startswith(base):
                return url[len(base) :]
            return None

        if url.startswith("/assets/"):
            return url[len("/assets/") :]
        return None

    @staticmethod
    def _normalize_path(path: str) -> str:
        sanitized = path.replace("\\", "/").lstrip("/")
        if sanitized.startswith(".."):
            raise StorageManagerError("Path traversal detected in storage path")
        return sanitized


_storage_manager: Optional[StorageManager] = None


def get_storage_manager() -> StorageManager:
    global _storage_manager
    if _storage_manager is None:
        _storage_manager = StorageManager()
    return _storage_manager
