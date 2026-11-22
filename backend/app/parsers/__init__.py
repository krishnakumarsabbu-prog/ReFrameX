"""Parser package — importing this module registers all parsers."""

from app.parsers.base import (
    BaseParser, CapabilityLevel, NormalizedComponent, EvidenceRef,
    ParseResult, ParseWarning, register_parser, get_parser_for_category,
    list_parsers, clear_registry, COMPONENT_TYPES, EVIDENCE_CLASSES,
)
from app.parsers.preprocessor import preprocess_text, PreprocessedLine

# Import all parser modules to trigger registration
from app.parsers import cobol_parser
from app.parsers import jcl_parser
from app.parsers import copybook_parser
from app.parsers import sql_parser
from app.parsers import bms_parser
from app.parsers import vsam_parser
from app.parsers import hlasm_parser
from app.parsers import detect_only_parsers

__all__ = [
    "BaseParser", "CapabilityLevel", "NormalizedComponent", "EvidenceRef",
    "ParseResult", "ParseWarning", "register_parser", "get_parser_for_category",
    "list_parsers", "clear_registry", "COMPONENT_TYPES", "EVIDENCE_CLASSES",
    "preprocess_text", "PreprocessedLine",
]
