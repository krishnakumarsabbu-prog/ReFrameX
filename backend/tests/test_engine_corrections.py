"""Comprehensive test suite for Engine Corrections A1–A10."""

import pytest
from app.assessment.scoring_engine import (
    load_ruleset,
    get_ruleset_info,
    DOMAINS,
    MEASURES,
)
from app.parsers.base import NormalizedComponent
from app.parsers.cobol_parser import CobolParser
from app.parsers.classifier import classify
from app.services.dependency_service import (
    find_cycles_tarjan,
    _is_choke_point,
)


def test_a2_max_achievable_points_per_domain():
    """A2: Sum of maximum achievable positive points per domain reaches ~100 for confidence & readiness."""
    ruleset = load_ruleset()
    rules = ruleset["rules"]

    for measure in ("confidence", "readiness"):
        for domain in DOMAINS:
            domain_pos_rules = [
                r for r in rules
                if r["domain"] == domain and r["measure"] == measure and r["impact"] == "positive"
            ]
            total_points = sum(r["weight"] for r in domain_pos_rules)
            assert total_points >= 95, (
                f"Domain '{domain}' measure '{measure}' achievable points ({total_points}) is below 95!"
            )


def test_a3_derived_rule_counts():
    """A3: Rule counts are derived at runtime from loaded ruleset, never hardcoded."""
    ruleset = load_ruleset()
    info = get_ruleset_info(ruleset)
    rule_counts = info["rule_counts"]

    total = rule_counts["total"]
    assert total == len(ruleset["rules"])
    assert total > 40  # Derived count should reflect v2 ruleset (e.g. 80)
    assert sum(rule_counts["by_measure"].values()) == total
    assert sum(rule_counts["by_domain"].values()) == total


def test_a5_dynamic_call_classification_and_move_resolution():
    """A5: Dynamic call classification:
    - unresolved -> Unknown with UNRESOLVED_TARGET
    - single literal MOVE -> Inferred with dynamic_resolved and both line references
    - multiple conflicting MOVEs -> Inferred with ambiguity
    - commented-out MOVE -> ignored
    """
    code = """
       IDENTIFICATION DIVISION.
       PROGRAM-ID. DYNTEST.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 TARGET-PGM-1 PIC X(8).
       01 TARGET-PGM-2 PIC X(8).
       01 TARGET-PGM-3 PIC X(8).
       PROCEDURE DIVISION.
      * This is a commented MOVE 'IGNORED' TO TARGET-PGM-1
           MOVE 'SUBPROG1' TO TARGET-PGM-1
           CALL TARGET-PGM-1.

           MOVE 'CANDIDATEA' TO TARGET-PGM-2
           MOVE 'CANDIDATEB' TO TARGET-PGM-2
           CALL TARGET-PGM-2.

           CALL TARGET-PGM-3.
    """
    parser = CobolParser()
    result = parser.parse("art-1", "DYNTEST.cbl", code.encode("utf-8"), "COBOL")

    calls = [c for c in result.components if "call_type" in c.detected_properties]
    assert len(calls) >= 3

    # Call 1: Resolved by single literal MOVE
    call1 = next(c for c in calls if c.detected_properties.get("target_variable") == "TARGET-PGM-1")
    assert call1.evidence_class == "Inferred"
    assert call1.detected_properties.get("call_type") == "dynamic_resolved"
    assert call1.name == "SUBPROG1"
    # Must reference both MOVE and CALL lines
    assert len(call1.evidence_refs) >= 2

    # Call 2: Conflicting multiple MOVEs -> Inferred with ambiguity flag
    call2 = next(c for c in calls if c.detected_properties.get("target_variable") == "TARGET-PGM-2")
    assert call2.evidence_class == "Inferred"
    assert call2.detected_properties.get("ambiguous") == "true"

    # Call 3: Unresolved -> Unknown
    call3 = next(c for c in calls if c.detected_properties.get("target_variable") == "TARGET-PGM-3")
    assert call3.evidence_class == "Unknown"
    assert call3.evidence_refs[0].rule == "UNRESOLVED_TARGET"


def test_a6_stable_deterministic_component_ids():
    """A6: Stable deterministic component IDs across line insertions and re-uploads."""
    # Blank lines at top should NOT alter deterministic id
    code1 = """
       IDENTIFICATION DIVISION.
       PROGRAM-ID. STABLEPROG.
       PROCEDURE DIVISION.
           STOP RUN.
    """
    code2 = """


       IDENTIFICATION DIVISION.
       PROGRAM-ID. STABLEPROG.
       PROCEDURE DIVISION.
           STOP RUN.
    """
    parser = CobolParser()
    res1 = parser.parse("art-1", "src/STABLEPROG.cbl", code1.encode("utf-8"), "COBOL")
    res2 = parser.parse("art-2", "src/STABLEPROG.cbl", code2.encode("utf-8"), "COBOL")

    prog1 = next(c for c in res1.components if c.component_type == "PROGRAM")
    prog2 = next(c for c in res2.components if c.component_type == "PROGRAM")

    id1 = prog1.deterministic_id("app-123", "src/STABLEPROG.cbl", 0)
    id2 = prog2.deterministic_id("app-123", "src/STABLEPROG.cbl", 0)

    assert id1 == id2
    assert len(id1) == 16


def test_a7_tarjan_cycle_detection_15_node_cycle():
    """A7: Cycle detection using Tarjan SCC on a 15-node cycle, self-loop, and overlapping cycles."""
    # 1. 15-node ring: 1 -> 2 -> ... -> 15 -> 1
    adj = {f"N{i}": [f"N{i+1}"] for i in range(1, 15)}
    adj["N15"] = ["N1"]

    cycles = find_cycles_tarjan(adj)
    assert len(cycles) == 1
    assert cycles[0]["size"] == 15
    assert len(cycles[0]["example_cycle_path"]) >= 15
    assert set(cycles[0]["members"]) == {f"N{i}" for i in range(1, 16)}

    # 2. Self-loop
    self_adj = {"SELF": ["SELF"]}
    self_cycles = find_cycles_tarjan(self_adj)
    assert len(self_cycles) == 1
    assert self_cycles[0]["size"] == 1
    assert "SELF" in self_cycles[0]["members"]

    # 3. Two overlapping cycles: 1 -> 2 -> 3 -> 1 and 2 -> 4 -> 2
    overlap_adj = {
        "A": ["B"],
        "B": ["C", "D"],
        "C": ["A"],
        "D": ["B"],
    }
    overlap_cycles = find_cycles_tarjan(overlap_adj)
    assert len(overlap_cycles) == 1  # Form one strongly connected component of 4 nodes
    assert overlap_cycles[0]["size"] == 4


def test_a8_choke_point_with_and_without_bypass():
    """A8: Choke point check (dominance-based) with dominance check and bypass handling."""
    # Topology 1: Linear chain U -> CHOKE -> W (CHOKE is a choke point)
    adj1 = {"U": ["CHOKE"], "CHOKE": ["W"], "W": []}
    rev1 = {"CHOKE": ["U"], "W": ["CHOKE"], "U": []}
    assert _is_choke_point("CHOKE", adj1, rev1) is True

    # Topology 2: Bypass path exists: U -> CHOKE -> W AND U -> BYPASS -> W
    # Removing CHOKE does NOT disconnect U from W, so CHOKE is NOT a choke point
    adj2 = {
        "U": ["CHOKE", "BYPASS"],
        "CHOKE": ["W"],
        "BYPASS": ["W"],
        "W": [],
    }
    rev2 = {
        "CHOKE": ["U"],
        "BYPASS": ["U"],
        "W": ["CHOKE", "BYPASS"],
        "U": [],
    }
    assert _is_choke_point("CHOKE", adj2, rev2) is False


def test_a9_ebcdic_cp037_heuristic_detection():
    """A9: EBCDIC cp037 detection with printable ratio and heuristic labeling."""
    cobol_text = "       IDENTIFICATION DIVISION. PROGRAM-ID. HELLO."
    ebcdic_bytes = cobol_text.encode("cp037")

    result = classify("HELLO.cbl", ebcdic_bytes)
    assert "EBCDIC (heuristic, cp037)" in result.encoding
    assert result.support_level == "SUPPORTED_PARSE"


def test_a9_binary_unknown_detect_only():
    """A9: Binary/unknown encoding is labeled as heuristic and set to DETECT_ONLY."""
    random_bytes = bytes([0x00, 0xFF, 0x01, 0xFE, 0x02, 0xFD] * 50)
    result = classify("UNKNOWN.bin", random_bytes)
    assert "heuristic" in result.encoding
    assert result.support_level == "DETECT_ONLY"
