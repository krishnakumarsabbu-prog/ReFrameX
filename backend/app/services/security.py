"""Security checks for file uploads: executables, path traversal, zip bombs, symlinks."""

from __future__ import annotations

import os
import zipfile
from pathlib import Path

from app.core.config import settings


class SecurityError(Exception):
    """Raised when a file or archive fails a security check."""

    def __init__(self, reason: str, filename: str = ""):
        self.reason = reason
        self.filename = filename
        super().__init__(f"{reason}: {filename}" if filename else reason)


# Magic bytes for known executable/binary formats
_EXEC_MAGIC_BYTES: list[tuple[bytes, str]] = [
    (b"\x4d\x5a", "DOS/Windows executable (MZ header)"),
    (b"\x7f\x45\x4c\x46", "ELF binary"),
    (b"\xca\xfe\xba\xbe", "Java class / Mach-O fat binary"),
    (b"\xfe\xed\xfa\xce", "Mach-O binary"),
    (b"\xfe\xed\xfa\xcf", "Mach-O 64 binary"),
    (b"\xce\xfa\xed\xfe", "Mach-O binary (swapped)"),
]


def reject_executable(filename: str, data: bytes) -> None:
    """Raise SecurityError if the file is an executable by extension or magic bytes."""
    ext = Path(filename).suffix.lower()
    if ext in settings.executable_extensions:
        raise SecurityError(f"executable extension rejected", filename)

    if len(data) >= 4:
        for magic, label in _EXEC_MAGIC_BYTES:
            if data[:len(magic)] == magic:
                raise SecurityError(f"binary executable detected ({label})", filename)


def safe_relative_path(rel: str) -> str:
    """Sanitize a relative path. Rejects absolute paths, traversal, and null bytes."""
    if not rel:
        return ""
    # Normalize separators
    rel = rel.replace("\\", "/")
    # Reject null bytes
    if "\x00" in rel:
        raise SecurityError("null byte in path", rel)
    # Reject absolute paths
    if rel.startswith("/"):
        raise SecurityError("absolute path rejected", rel)
    # Reject drive letters (Windows)
    if len(rel) >= 2 and rel[1] == ":":
        raise SecurityError("drive-letter path rejected", rel)
    # Resolve and check for traversal
    parts: list[str] = []
    for part in rel.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            raise SecurityError("path traversal rejected", rel)
        parts.append(part)
    return "/".join(parts)


def check_symlink(path: Path) -> None:
    """Raise SecurityError if path is a symlink that escapes the base directory."""
    if not path.is_symlink():
        return
    # Symlinks are only allowed if they resolve within the upload root
    try:
        resolved = path.resolve(strict=False)
        upload_resolved = settings.upload_dir.resolve(strict=False)
        try:
            resolved.relative_to(upload_resolved)
        except ValueError:
            raise SecurityError("symlink escapes upload directory", str(path))
    except OSError:
        raise SecurityError("symlink resolution failed", str(path))


def validate_zip(zip_path: Path) -> None:
    """Validate a ZIP archive against zip-bomb limits. Raises SecurityError on violation."""
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            infos = zf.infolist()
    except zipfile.BadZipFile as e:
        raise SecurityError(f"corrupt ZIP: {e}")
    except Exception as e:
        raise SecurityError(f"cannot read ZIP: {e}")

    if len(infos) > settings.zip_max_files:
        raise SecurityError(
            f"ZIP contains {len(infos)} files (limit {settings.zip_max_files})"
        )

    total_uncompressed = 0
    for info in infos:
        # Path traversal check on each entry
        safe_relative_path(info.filename)
        # Skip directories
        if info.is_dir():
            continue
        total_uncompressed += info.file_size
        if total_uncompressed > settings.zip_max_total_uncompressed:
            raise SecurityError(
                f"ZIP uncompressed size exceeds limit ({total_uncompressed} bytes)"
            )
        # Compression ratio check
        if info.compress_size > 0:
            ratio = info.file_size / info.compress_size
            if ratio > settings.zip_max_ratio:
                raise SecurityError(
                    f"ZIP entry '{info.filename}' has suspicious compression ratio {ratio:.0f}:1"
                )
        # Nesting depth check
        depth = info.filename.count("/")
        if depth > settings.zip_max_nesting:
            raise SecurityError(
                f"ZIP entry '{info.filename}' nesting depth {depth} exceeds limit"
            )


def is_within_upload(path: Path) -> bool:
    """Return True if path is within the upload directory."""
    try:
        resolved = path.resolve(strict=False)
        upload_resolved = settings.upload_dir.resolve(strict=False)
        resolved.relative_to(upload_resolved)
        return True
    except (ValueError, OSError):
        return False
