"""Preprocessing for COBOL fixed-format, JCL, SQL, and generic text.

Handles:
- COBOL fixed-format: sequence area (1-6), indicator col 7, Area A/B (8-72), ignore 73-80
- Continuation lines (- in col 7)
- Free-format (>>SOURCE FORMAT FREE)
- Comment lines (*, /, D in col 7 for COBOL; // and //* for JCL; -- and /* */ for SQL)
- Blank lines
- Preserves ORIGINAL line numbers for every finding
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class PreprocessedLine:
    """A single preprocessed line with original line number."""
    line_no: int          # 1-indexed original line number
    text: str             # cleaned, de-continued text
    is_comment: bool
    is_blank: bool
    is_continuation: bool  # was this a continuation of the previous line?
    area: str             # 'A', 'B', or '' for non-COBOL


def preprocess_text(raw_text: str, language: str = "generic") -> list[PreprocessedLine]:
    """Preprocess raw text into a list of PreprocessedLine objects.

    Args:
        raw_text: The raw file content as a string.
        language: 'cobol', 'jcl', 'sql', 'asm', or 'generic'.

    Returns:
        List of PreprocessedLine, one per original line, with de-continued text
        merged into the first line of each continuation group.
    """
    raw_lines = raw_text.splitlines()
    if language == "cobol":
        return _preprocess_cobol(raw_lines)
    elif language == "jcl":
        return _preprocess_jcl(raw_lines)
    elif language == "sql":
        return _preprocess_sql(raw_lines)
    elif language == "asm":
        return _preprocess_asm(raw_lines)
    else:
        return _preprocess_generic(raw_lines)


def _preprocess_generic(raw_lines: list[str]) -> list[PreprocessedLine]:
    result: list[PreprocessedLine] = []
    for i, line in enumerate(raw_lines, 1):
        stripped = line.strip()
        result.append(PreprocessedLine(
            line_no=i,
            text=line.rstrip(),
            is_comment=False,
            is_blank=(stripped == ""),
            is_continuation=False,
            area="",
        ))
    return result


def _preprocess_cobol(raw_lines: list[str]) -> list[PreprocessedLine]:
    """COBOL fixed-format preprocessing."""
    # Check for free-format directive
    is_free = False
    for line in raw_lines[:50]:
        if ">>SOURCE FORMAT FREE" in line.upper():
            is_free = True
            break

    if is_free:
        return _preprocess_cobol_free(raw_lines)

    result: list[PreprocessedLine] = []
    pending_continuation: PreprocessedLine | None = None

    for i, raw in enumerate(raw_lines, 1):
        # Truncate to 80 columns (ignore 73-80)
        if len(raw) > 80:
            raw = raw[:72]
        elif len(raw) > 72:
            raw = raw[:72]

        # Sequence area: cols 1-6 (index 0-5)
        # Indicator column: col 7 (index 6)
        # Area A: cols 8-11 (index 7-10)
        # Area B: cols 12-72 (index 11-71)

        if len(raw) < 7:
            # Short line — treat as blank if empty, else generic
            stripped = raw.strip()
            result.append(PreprocessedLine(
                line_no=i, text=raw, is_comment=(stripped == ""),
                is_blank=(stripped == ""), is_continuation=False, area="",
            ))
            pending_continuation = None
            continue

        indicator = raw[6] if len(raw) > 6 else " "
        content = raw[7:] if len(raw) > 7 else ""

        is_comment = indicator in ("*", "/")
        is_debug = indicator in ("D", "d")
        is_continuation = indicator == "-"

        if is_debug:
            # Debugging lines — treat as comments for extraction purposes
            is_comment = True

        # Determine area
        area = ""
        if not is_comment and content.strip():
            if len(raw) > 7:
                # Check if first non-blank char is in Area A (cols 8-11)
                area_a_end = min(len(raw), 11)
                area_b_start = 11
                first_nonblank = -1
                for idx in range(7, len(raw)):
                    if raw[idx] != " ":
                        first_nonblank = idx
                        break
                if first_nonblank >= 0:
                    area = "A" if first_nonblank < area_b_start else "B"

        text = content.rstrip()

        if is_continuation and pending_continuation is not None:
            # Merge continuation into previous line
            # Remove leading quotes from continuation content for string literals
            cont_content = content.lstrip()
            # Remove a leading quote if present (COBOL continuation convention)
            if cont_content.startswith("'") or cont_content.startswith('"'):
                cont_content = cont_content[1:]
            pending_continuation.text += cont_content.rstrip()
            # Mark this line as continuation (but don't add separately)
            # We still add a placeholder so line numbers are preserved
            result.append(PreprocessedLine(
                line_no=i, text="", is_comment=True, is_blank=True,
                is_continuation=True, area="",
            ))
            continue

        pl = PreprocessedLine(
            line_no=i, text=text, is_comment=is_comment,
            is_blank=(text.strip() == "" and not is_comment),
            is_continuation=False, area=area,
        )
        if not is_continuation:
            pending_continuation = pl
        result.append(pl)

    return result


def _preprocess_cobol_free(raw_lines: list[str]) -> list[PreprocessedLine]:
    """COBOL free-format preprocessing."""
    result: list[PreprocessedLine] = []
    for i, raw in enumerate(raw_lines, 1):
        stripped = raw.strip()
        is_comment = stripped.startswith("*") or stripped.startswith("/")
        result.append(PreprocessedLine(
            line_no=i, text=raw.rstrip(), is_comment=is_comment,
            is_blank=(stripped == "" and not is_comment),
            is_continuation=False, area="",
        ))
    return result


def _preprocess_jcl(raw_lines: list[str]) -> list[PreprocessedLine]:
    """JCL preprocessing: handle // and //* comments, continuation."""
    result: list[PreprocessedLine] = []
    pending: PreprocessedLine | None = None

    for i, raw in enumerate(raw_lines, 1):
        stripped = raw.strip()

        # Blank line
        if stripped == "":
            result.append(PreprocessedLine(
                line_no=i, text=raw, is_comment=False,
                is_blank=True, is_continuation=False, area="",
            ))
            pending = None
            continue

        # Comment line: //* or lines not starting with // in certain contexts
        is_comment = stripped.startswith("//*")

        # Continuation: starts with // but content after // is blank or just commas
        # JCL continuation: a line that starts with // and the previous line ended with comma
        is_continuation = False
        if stripped.startswith("//") and not is_comment:
            content_after = stripped[2:].strip()
            if pending is not None and not content_after.startswith(("EXEC", "JOB", "DD", "PROC", "PEND", "SET", "IF", "ELSE", "END")):
                # Check if previous line ended with comma or incomplete
                if pending.text.rstrip().endswith(",") or pending.text.rstrip().endswith("("):
                    is_continuation = True

        if is_continuation and pending is not None:
            pending.text += " " + stripped[2:].strip()
            result.append(PreprocessedLine(
                line_no=i, text="", is_comment=True,
                is_blank=True, is_continuation=True, area="",
            ))
            continue

        pl = PreprocessedLine(
            line_no=i, text=raw.rstrip(), is_comment=is_comment,
            is_blank=False, is_continuation=False, area="",
        )
        if not is_comment:
            pending = pl
        result.append(pl)

    return result


def _preprocess_sql(raw_lines: list[str]) -> list[PreprocessedLine]:
    """SQL preprocessing: handle -- comments, block comments, string literals."""
    result: list[PreprocessedLine] = []
    in_block_comment = False

    for i, raw in enumerate(raw_lines, 1):
        stripped = raw.strip()
        is_comment = False
        text = raw.rstrip()

        if in_block_comment:
            is_comment = True
            if "*/" in raw:
                in_block_comment = False
            result.append(PreprocessedLine(
                line_no=i, text=text, is_comment=True,
                is_blank=False, is_continuation=False, area="",
            ))
            continue

        if stripped.startswith("--"):
            is_comment = True
        elif stripped.startswith("/*"):
            is_comment = True
            if "*/" not in stripped[2:]:
                in_block_comment = True

        result.append(PreprocessedLine(
            line_no=i, text=text, is_comment=is_comment,
            is_blank=(stripped == ""), is_continuation=False, area="",
        ))

    return result


def _preprocess_asm(raw_lines: list[str]) -> list[PreprocessedLine]:
    """HLASM preprocessing: * or .* in col 1 = comment, col 72 non-blank = continuation."""
    result: list[PreprocessedLine] = []
    prev_continued = False
    for i, raw in enumerate(raw_lines, 1):
        stripped = raw.strip()
        is_comment = len(raw) > 0 and (raw[0] in ("*", "/") or raw.startswith(".*"))
        has_continuation_char = (not is_comment and len(raw) >= 72 and raw[71] not in (" ", "\t"))
        is_cont = prev_continued
        prev_continued = has_continuation_char

        clean_text = raw[:71].rstrip() if has_continuation_char else raw.rstrip()

        result.append(PreprocessedLine(
            line_no=i,
            text=clean_text,
            is_comment=is_comment,
            is_blank=(stripped == "" and not is_comment),
            is_continuation=is_cont,
            area="CONT" if is_cont else "",
        ))
    return result
