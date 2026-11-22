"""Data minimization and redaction utilities (B3).

Masks sensitive enterprise patterns:
- IPv4 / IPv6 addresses -> [REDACTED_IP]
- Emails -> [REDACTED_EMAIL]
- Internal hostnames/domains -> [REDACTED_HOST]
- Account numbers / SSNs -> [REDACTED_ACCOUNT]
- Secrets / Tokens / Keys -> [REDACTED_SECRET]
- COBOL sequence numbers in cols 1-6 -> whitespace
"""

from __future__ import annotations

import re
from typing import NamedTuple


class RedactionStats(NamedTuple):
    total_redacted: int
    by_category: dict[str, int]


IP_REGEX = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
HOST_REGEX = re.compile(r"\b(?:[a-zA-Z0-9-]+\.)+(?:internal|corp|local|lan|priv)\b", re.IGNORECASE)
ACCOUNT_REGEX = re.compile(r"\b(?:\d{4}[- ]?){2,3}\d{4}\b|\b\d{9,16}\b")
SECRET_REGEX = re.compile(
    r"(?:api[_-]?key|secret|password|passwd|token|auth[_-]?token)\s*(?:=|:|\bis\b)\s*['\"]?([A-Za-z0-9_\-\.]{8,})['\"]?"
    r"|move\s+['\"]([A-Za-z0-9_\-\.]{8,})['\"]\s+to\s+[A-Za-z0-9_\-]*?(?:key|secret|password|passwd|token)"
    r"|\b(?:sk_live_|ghp_|gho_|xoxb-|Bearer\s+)[A-Za-z0-9_\-\.]{10,}\b",
    re.IGNORECASE,
)


def redact_cobol_sequence_numbers(line: str) -> str:
    """Mask COBOL sequence numbers in columns 1-6 if they are digits."""
    if len(line) >= 6 and line[:6].isdigit():
        return "      " + line[6:]
    return line


def redact_text(text: str, mask_cobol_sequences: bool = True) -> tuple[str, RedactionStats]:
    """Redact sensitive patterns from source snippets.

    Returns the redacted text and a count of redactions by category.
    """
    counts = {
        "ip": 0,
        "email": 0,
        "host": 0,
        "account": 0,
        "secret": 0,
        "cobol_sequence": 0,
    }

    # Line-by-line COBOL sequence numbers
    lines = text.splitlines(keepends=True)
    processed_lines = []
    for line in lines:
        if mask_cobol_sequences and len(line) >= 6 and line[:6].isdigit():
            counts["cobol_sequence"] += 1
            processed_lines.append("      " + line[6:])
        else:
            processed_lines.append(line)
    text = "".join(processed_lines)

    # Secrets
    def _sub_secret(match: re.Match) -> str:
        counts["secret"] += 1
        full = match.group(0)
        for g in match.groups():
            if g:
                return full.replace(g, "[REDACTED_SECRET]")
        return "[REDACTED_SECRET]"

    text = SECRET_REGEX.sub(_sub_secret, text)

    # Emails
    def _sub_email(match: re.Match) -> str:
        counts["email"] += 1
        return "[REDACTED_EMAIL]"

    text = EMAIL_REGEX.sub(_sub_email, text)

    # IPs
    def _sub_ip(match: re.Match) -> str:
        counts["ip"] += 1
        return "[REDACTED_IP]"

    text = IP_REGEX.sub(_sub_ip, text)

    # Hosts
    def _sub_host(match: re.Match) -> str:
        counts["host"] += 1
        return "[REDACTED_HOST]"

    text = HOST_REGEX.sub(_sub_host, text)

    # Account numbers
    def _sub_account(match: re.Match) -> str:
        counts["account"] += 1
        return "[REDACTED_ACCOUNT]"

    text = ACCOUNT_REGEX.sub(_sub_account, text)

    total = sum(counts.values())
    return text, RedactionStats(total_redacted=total, by_category=counts)
