"""Ruleset Validator for ReFrameX Assessment Engine.

Validates condition syntax, identifiers, and scope consistency across all rules.
Prevents unresolvable references (e.g., bare 'count', 'value') and ensures
comparison safety against optional detected properties.
"""

from __future__ import annotations

import re
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Known builtins / keywords allowed in rule conditions
ALLOWED_KEYWORDS = {
    "and", "or", "not", "in", "present", "contains",
    "True", "False", "None", "ctx",
}

# Known application-level context keys
KNOWN_APP_KEYS = {
    "has_jcl",
    "has_ddl",
    "has_bms",
    "has_cobol",
    "has_assembler",
    "has_cics_transactions",
    "has_copybooks",
    "has_unknown_copybooks",
    "no_unknown_copybooks",
    "has_embedded_sql",
    "has_security_components",
    "has_config_artifacts",
    "unsupported_count",
    "unresolved_dependencies",
    "dependency_count",
    "circular_count",
    "single_points",
    "dependency_graph.circular_count",
    "dependency_graph.single_points",
    "dependency_graph.total_edges",
    "dependency_summary.unresolved_targets",
    "dependency_summary.total_dependencies",
    "embedded_SQL_detected_but_no_DDL",
    "application.id",
    "application.name",
    "application.business_domain",
    "application.owner",
    "application.technology_stack",
}

# Known component-level context keys
KNOWN_COMPONENT_KEYS = {
    "component_type",
    "technology",
    "name",
    "evidence_class",
    "component.evidence_class",
    "source_filename",
    "line_start",
    "line_end",
}

# Known artifact-level context keys
KNOWN_ARTIFACT_KEYS = {
    "artifact_category",
    "artifact.category",
    "artifact.support_level",
    "artifact.parse_status",
    "artifact.extension",
    "artifact.original_filename",
}

# Known dependency-level context keys
KNOWN_DEPENDENCY_KEYS = {
    "dependency.evidence_class",
    "dependency.relationship_type",
}

ALL_KNOWN_ROOT_KEYS = (
    KNOWN_APP_KEYS
    | KNOWN_COMPONENT_KEYS
    | KNOWN_ARTIFACT_KEYS
    | KNOWN_DEPENDENCY_KEYS
)


def extract_condition_identifiers(condition: str) -> list[str]:
    """Extract all identifier tokens from a condition string, ignoring strings."""
    # Strip quoted strings
    clean = re.sub(r"'[^']*'|\"[^\"]*\"", "", condition)
    # Strip operators and punctuation
    tokens = re.findall(r"\b[A-Za-z_][A-Za-z0-9_.]*\b", clean)
    return [t for t in tokens if t not in ALLOWED_KEYWORDS]


def validate_rule_condition(rule: dict[str, Any]) -> list[str]:
    """Validate a single rule condition. Returns a list of error messages."""
    rule_id = rule.get("rule_id", "UNKNOWN")
    condition = rule.get("detection_condition", "")
    if not condition or not isinstance(condition, str):
        return [f"Rule {rule_id}: detection_condition is empty or not a string"]

    errors: list[str] = []
    identifiers = extract_condition_identifiers(condition)

    for ident in identifiers:
        # Check detected_properties.* pattern
        if ident.startswith("detected_properties."):
            prop_name = ident.split(".", 1)[1]
            if not prop_name:
                errors.append(f"Rule {rule_id}: invalid empty property reference in '{ident}'")
            continue

        # Check known keys
        if ident in ALL_KNOWN_ROOT_KEYS:
            continue

        # Known direct lookups like component.xyz
        if ident.startswith("component.") or ident.startswith("artifact.") or ident.startswith("dependency.") or ident.startswith("application."):
            continue

        # If it reaches here, it's an unrecognized identifier
        errors.append(
            f"Rule {rule_id}: Unrecognized identifier '{ident}' in condition: '{condition}'. "
            f"Expected a known context key or 'detected_properties.<property>'."
        )

    # Check for fragile numeric comparisons: e.g. 'detected_properties.foo >= N' without 'detected_properties.foo present'
    fragile_matches = re.finditer(r"(detected_properties\.\w+)\s*(?:>=|<=|>|<)\s*\d+", condition)
    for m in fragile_matches:
        prop = m.group(1)
        # Check if condition tests presence of this property
        presence_pattern = rf"{re.escape(prop)}\s+present"
        if not re.search(presence_pattern, condition):
            errors.append(
                f"Rule {rule_id}: Numeric comparison '{m.group(0)}' without prior '{prop} present' "
                f"will raise TypeError when property is absent."
            )

    return errors


def validate_ruleset(ruleset: dict[str, Any], raise_on_error: bool = True) -> list[str]:
    """Validate all rule conditions in a ruleset.

    Args:
        ruleset: The loaded ruleset dict.
        raise_on_error: If True, raises ValueError when any errors are found.

    Returns:
        List of all validation error messages.
    """
    all_errors: list[str] = []
    for rule in ruleset.get("rules", []):
        errs = validate_rule_condition(rule)
        all_errors.extend(errs)

    if all_errors and raise_on_error:
        raise ValueError(
            f"Ruleset condition validation failed with {len(all_errors)} error(s):\n"
            + "\n".join(f"  - {e}" for e in all_errors)
        )

    return all_errors
