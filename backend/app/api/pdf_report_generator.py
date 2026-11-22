"""Genuine PDF export.

The executive report is designed once, as HTML, and printed to PDF by a
headless Chromium build (Chrome or Edge). That keeps the browser document and
the PDF pixel-identical and avoids a second, drifting layout implementation.

No network access is used: the HTML is written to a temporary file and loaded
over ``file://``. If no Chromium binary is found, the caller receives a clear
``PdfRendererUnavailable`` rather than a silently empty or HTML-typed file.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from app.api.html_report_generator import build_modern_html_report

BROWSER_ENV_VARS = ("REFRAMEX_BROWSER", "CHROME_PATH", "EDGE_PATH")

_WINDOWS_CANDIDATES = (
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
)

_POSIX_CANDIDATES = (
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
)


class PdfRendererUnavailable(RuntimeError):
    """Raised when no headless Chromium build can be located."""


class PdfRenderFailed(RuntimeError):
    """Raised when the browser was found but did not produce a PDF."""


def find_browser() -> str | None:
    """Locate a Chromium-family browser without touching the network."""
    for var in BROWSER_ENV_VARS:
        candidate = os.environ.get(var)
        if candidate and Path(candidate).exists():
            return candidate

    candidates = _WINDOWS_CANDIDATES if os.name == "nt" else _POSIX_CANDIDATES
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate

    for name in ("google-chrome", "chrome", "chromium", "microsoft-edge", "msedge"):
        found = shutil.which(name)
        if found:
            return found
    return None


def render_pdf(report: dict, timeout: int = 120) -> bytes:
    """Render the executive report to PDF bytes.

    Raises:
        PdfRendererUnavailable: no Chromium binary could be located.
        PdfRenderFailed: the browser ran but produced no usable PDF.
    """
    browser = find_browser()
    if not browser:
        raise PdfRendererUnavailable(
            "No headless Chromium browser found. Install Chrome/Edge or set REFRAMEX_BROWSER "
            "to its executable path."
        )

    html = build_modern_html_report(report, auto_print=False)

    with tempfile.TemporaryDirectory(prefix="reframex-pdf-") as tmp:
        tmp_path = Path(tmp)
        html_path = tmp_path / "report.html"
        pdf_path = tmp_path / "report.pdf"
        profile_path = tmp_path / "profile"
        html_path.write_text(html, encoding="utf-8")

        command = [
            browser,
            "--headless=new",
            "--disable-gpu",
            "--disable-extensions",
            "--disable-dev-shm-usage",
            "--hide-scrollbars",
            "--no-first-run",
            "--no-default-browser-check",
            "--no-pdf-header-footer",
            "--print-to-pdf-no-header",
            "--run-all-compositor-stages-before-draw",
            "--virtual-time-budget=10000",
            f"--user-data-dir={profile_path}",
            f"--print-to-pdf={pdf_path}",
            html_path.resolve().as_uri(),
        ]

        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:  # pragma: no cover - defensive
            raise PdfRenderFailed("PDF rendering timed out.") from exc

        if not pdf_path.exists() or pdf_path.stat().st_size == 0:
            detail = (completed.stderr or b"").decode("utf-8", "replace").strip()
            raise PdfRenderFailed(
                "Headless browser produced no PDF"
                + (f": {detail[-600:]}" if detail else f" (exit code {completed.returncode}).")
            )

        data = pdf_path.read_bytes()

    if not data.startswith(b"%PDF"):
        raise PdfRenderFailed("Rendered output is not a PDF document.")
    return data


def pdf_filename(app_name: str, timestamp: str) -> str:
    """Stable, filesystem-safe attachment name."""
    safe = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in app_name).strip("_")
    return f"reframex_report_{safe or 'application'}_{timestamp}.pdf"


__all__ = [
    "BROWSER_ENV_VARS",
    "PdfRenderFailed",
    "PdfRendererUnavailable",
    "find_browser",
    "pdf_filename",
    "render_pdf",
]
