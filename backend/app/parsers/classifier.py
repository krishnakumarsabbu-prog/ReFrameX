"""Artifact classification: extension map, content sniffing, encoding detection."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

# ---- Extension map ----

EXTENSION_MAP: dict[str, tuple[str, str]] = {
    # extension: (category, support_level)
    ".cbl": ("COBOL", "SUPPORTED_PARSE"),
    ".cob": ("COBOL", "SUPPORTED_PARSE"),
    ".cobol": ("COBOL", "SUPPORTED_PARSE"),
    ".cpy": ("Copybook", "SUPPORTED_PARSE"),
    ".copy": ("Copybook", "SUPPORTED_PARSE"),
    ".jcl": ("JCL", "SUPPORTED_PARSE"),
    ".proc": ("JCL", "SUPPORTED_PARSE"),
    ".prc": ("JCL", "SUPPORTED_PARSE"),
    ".cntl": ("JCL", "SUPPORTED_PARSE"),
    ".sql": ("SQL", "SUPPORTED_PARSE"),
    ".ddl": ("SQL", "SUPPORTED_PARSE"),
    ".db2": ("SQL", "SUPPORTED_PARSE"),
    ".bms": ("BMS", "SUPPORTED_PARSE"),
    ".map": ("BMS", "SUPPORTED_PARSE"),
    ".asm": ("HLASM", "SUPPORTED_PARSE"),
    ".mac": ("HLASM", "SUPPORTED_PARSE"),
    ".idcams": ("VSAM", "SUPPORTED_PARSE"),
    ".vsam": ("VSAM", "SUPPORTED_PARSE"),
    ".def": ("VSAM", "SUPPORTED_PARSE"),
    ".psb": ("IMS", "DETECT_ONLY"),
    ".dbd": ("IMS", "DETECT_ONLY"),
    ".ims": ("IMS", "DETECT_ONLY"),
    ".ctm": ("Scheduler", "DETECT_ONLY"),
    ".sch": ("Scheduler", "DETECT_ONLY"),
    ".racf": ("Security", "DETECT_ONLY"),
    ".rcf": ("Security", "DETECT_ONLY"),
    ".json": ("Config", "DETECT_ONLY"),
    ".csv": ("Config", "DETECT_ONLY"),
    ".txt": ("Config", "DETECT_ONLY"),
    ".xml": ("Config", "DETECT_ONLY"),
    ".properties": ("Config", "DETECT_ONLY"),
    ".conf": ("Config", "DETECT_ONLY"),
    ".ini": ("Config", "DETECT_ONLY"),
    ".yaml": ("Config", "DETECT_ONLY"),
    ".yml": ("Config", "DETECT_ONLY"),
    ".md": ("Config", "DETECT_ONLY"),
    ".dat": ("Data", "UNSUPPORTED"),
    ".bin": ("Data", "UNSUPPORTED"),
    ".ebc": ("Data", "UNSUPPORTED"),
}


@dataclass
class Classification:
    category: str
    support_level: str
    encoding: str
    fixed_record_length_hint: int | None
    reason: str


# ---- Content signatures ----

_SIGNATURES: list[tuple[str, str, str]] = [
    # (substring, category, support_level)  — checked case-insensitively
    ("identification division", "COBOL", "SUPPORTED_PARSE"),
    ("data division", "COBOL", "SUPPORTED_PARSE"),
    ("procedure division", "COBOL", "SUPPORTED_PARSE"),
    ("//job", "JCL", "SUPPORTED_PARSE"),
    ("//exec", "JCL", "SUPPORTED_PARSE"),
    ("//dd ", "JCL", "SUPPORTED_PARSE"),
    ("dfhmsd", "BMS", "SUPPORTED_PARSE"),
    ("dfhmdi", "BMS", "SUPPORTED_PARSE"),
    ("define cluster", "VSAM", "SUPPORTED_PARSE"),
    ("idcams", "VSAM", "SUPPORTED_PARSE"),
    ("csect", "HLASM", "SUPPORTED_PARSE"),
    ("create table", "SQL", "SUPPORTED_PARSE"),
    ("select ", "SQL", "SUPPORTED_PARSE"),
    ("insert into", "SQL", "SUPPORTED_PARSE"),
    ("dbd name=", "IMS", "DETECT_ONLY"),
    ("psb ", "IMS", "DETECT_ONLY"),
]


def _detect_encoding(data: bytes) -> str:
    """Return 'UTF-8', 'ASCII', 'likely EBCDIC cp037', or 'binary'."""
    if b"\x00" in data:
        return "binary"
    # Try UTF-8 first
    try:
        data.decode("utf-8")
        # If pure ASCII, label as ASCII
        try:
            data.decode("ascii")
            return "ASCII"
        except UnicodeDecodeError:
            return "UTF-8"
    except UnicodeDecodeError:
        pass
    # Try EBCDIC cp037
    try:
        decoded = data.decode("cp037")
        printable = sum(1 for c in decoded if c.isprintable() or c in "\n\r\t ")
        ratio = printable / max(len(decoded), 1)
        if ratio > 0.80:
            return "likely EBCDIC cp037"
    except (UnicodeDecodeError, LookupError):
        pass
    return "binary"


def _sniff_content(data: bytes) -> tuple[str, str] | None:
    """Check content signatures. Returns (category, support_level) or None."""
    try:
        sample = data[:8192].decode("latin-1")
    except Exception:
        return None
    lower = sample.lower()
    for sig, cat, sup in _SIGNATURES:
        if sig in lower:
            return cat, sup
    return None


def classify(filename: str, data: bytes) -> Classification:
    """Classify an artifact by extension then content."""
    ext = Path(filename).suffix.lower()
    encoding = _detect_encoding(data)

    # Extension-based classification
    if ext in EXTENSION_MAP:
        cat, sup = EXTENSION_MAP[ext]
        reason = f"extension '{ext}'"
        return Classification(
            category=cat,
            support_level=sup,
            encoding=encoding,
            fixed_record_length_hint=_detect_fixed_record_length(data, encoding),
            reason=reason,
        )

    # Content sniffing for unknown extensions or no extension
    sniffed = _sniff_content(data)
    if sniffed:
        cat, sup = sniffed
        reason = f"content signature matched (extension was '{ext or '<none>'}')"
    else:
        cat = "UNKNOWN"
        sup = "UNSUPPORTED"
        reason = f"unrecognized content (extension was '{ext or '<none>'}')"

    return Classification(
        category=cat,
        support_level=sup,
        encoding=encoding,
        fixed_record_length_hint=_detect_fixed_record_length(data, encoding),
        reason=reason,
    )


def _detect_fixed_record_length(data: bytes, encoding: str) -> int | None:
    """Heuristic: if all lines have the same length (within first 20 lines), report it."""
    if encoding in ("binary", "likely EBCDIC cp037"):
        return None
    try:
        text = data[:4096].decode("utf-8", errors="replace")
    except Exception:
        return None
    lines = text.split("\n")
    # Remove last partial line
    if len(lines) > 1:
        lines = lines[:-1]
    if len(lines) < 3:
        return None
    lengths = [len(line.rstrip("\r")) for line in lines[:20]]
    if len(set(lengths)) == 1 and lengths[0] > 0:
        return lengths[0]
    return None
