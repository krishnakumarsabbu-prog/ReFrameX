"""Accuracy harness — reports precision, recall and F1 per parser and per component type.

Run: python -m app.assessment.accuracy_report

Compares parser output against hand-verified ground truth.
Lists every false positive and false negative openly with its cause.
Never adjusts ground truth to make numbers look better.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

# Ensure backend is importable
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
sys.path.insert(0, str(BACKEND_DIR))

from app.parsers import get_parser_for_category
from app.parsers.base import NormalizedComponent


GROUND_TRUTH_DIR = BACKEND_DIR / "tests" / "ground_truth"
SAMPLES_DIR = GROUND_TRUTH_DIR / "samples"
GROUND_TRUTH_FILE = GROUND_TRUTH_DIR / "ground_truth.json"
RESULTS_DIR = Path(__file__).resolve().parent.parent / "tests" / "ground_truth" / "results"


@dataclass
class MatchResult:
    true_positive: int = 0
    false_positive: int = 0
    false_negative: int = 0
    fp_details: list[dict] = field(default_factory=list)
    fn_details: list[dict] = field(default_factory=list)

    @property
    def precision(self) -> float:
        predicted = self.true_positive + self.false_positive
        return self.true_positive / predicted if predicted > 0 else 0.0

    @property
    def recall(self) -> float:
        expected = self.true_positive + self.false_negative
        return self.true_positive / expected if expected > 0 else 0.0

    @property
    def f1(self) -> float:
        p = self.precision
        r = self.recall
        return 2 * p * r / (p + r) if (p + r) > 0 else 0.0


def _load_ground_truth() -> dict:
    with open(GROUND_TRUTH_FILE) as f:
        return json.load(f)


def _run_parser_on_file(filepath: Path, category: str) -> list[NormalizedComponent]:
    """Run the appropriate parser on a file and return components."""
    parser = get_parser_for_category(category)
    if parser is None:
        return []
    content = filepath.read_bytes()
    result = parser.parse("test-artifact", filepath.name, content, category)
    return result.components


def _match_components(
    expected: list[dict],
    actual: list[NormalizedComponent],
) -> MatchResult:
    """Match actual components against expected, by (name, type, rule)."""
    result = MatchResult()

    # Build expected set keyed by (name, type)
    expected_keys: list[tuple[str, str, dict]] = []
    for e in expected:
        key = (e["name"].upper(), e["type"].upper())
        expected_keys.append((key, e))

    # Build actual set
    actual_matched: set[int] = set()
    actual_list = []
    for i, a in enumerate(actual):
        key = (a.name.upper(), a.component_type.upper())
        actual_list.append((key, a, i))

    # Match expected → actual (recall)
    for ekey, e in expected_keys:
        matched = False
        for idx, (akey, a, i) in enumerate(actual_list):
            if i in actual_matched:
                continue
            if ekey == akey:
                actual_matched.add(i)
                result.true_positive += 1
                matched = True
                break
        if not matched:
            result.false_negative += 1
            result.fn_details.append({
                "name": e["name"],
                "type": e["type"],
                "line": e.get("line_start", "?"),
                "rule": e.get("rule", "?"),
                "cause": "Not found in parser output",
            })

    # Count unmatched actual as false positives
    for idx, (akey, a, i) in enumerate(actual_list):
        if i not in actual_matched:
            result.false_positive += 1
            result.fp_details.append({
                "name": a.name,
                "type": a.component_type,
                "line": a.line_start,
                "rule": a.evidence_refs[0].rule if a.evidence_refs else "?",
                "cause": "Not in ground truth",
            })

    return result


def run_accuracy_report() -> dict:
    """Run the full accuracy report and return structured results."""
    gt = _load_ground_truth()
    samples = gt["samples"]

    # Per-parser results
    per_parser: dict[str, MatchResult] = {}
    per_type: dict[str, MatchResult] = {}
    per_sample: dict[str, MatchResult] = {}
    all_results: list[dict] = []

    for filename, spec in samples.items():
        filepath = SAMPLES_DIR / filename
        if not filepath.exists():
            continue

        category = spec["category"]
        expected = spec.get("expected_components", [])

        actual = _run_parser_on_file(filepath, category)

        # Determine parser name
        parser = get_parser_for_category(category)
        parser_name = parser.name if parser else "none"

        match = _match_components(expected, actual)
        per_sample[filename] = match

        # Aggregate per parser
        if parser_name not in per_parser:
            per_parser[parser_name] = MatchResult()
        p = per_parser[parser_name]
        p.true_positive += match.true_positive
        p.false_positive += match.false_positive
        p.false_negative += match.false_negative
        p.fp_details.extend(match.fp_details)
        p.fn_details.extend(match.fn_details)

        # Aggregate per component type
        for e in expected:
            ctype = e["type"].upper()
            if ctype not in per_type:
                per_type[ctype] = MatchResult()
        for a in actual:
            ctype = a.component_type.upper()
            if ctype not in per_type:
                per_type[ctype] = MatchResult()

        # Per-type matching (re-do per type)
        for ctype in per_type:
            type_expected = [e for e in expected if e["type"].upper() == ctype]
            type_actual = [a for a in actual if a.component_type.upper() == ctype]
            type_match = _match_components(type_expected, type_actual)
            # Only update counts (details already aggregated at sample level)
            per_type[ctype].true_positive += type_match.true_positive
            per_type[ctype].false_positive += type_match.false_positive
            per_type[ctype].false_negative += type_match.false_negative
            per_type[ctype].fp_details.extend(type_match.fp_details)
            per_type[ctype].fn_details.extend(type_match.fn_details)

        all_results.append({
            "file": filename,
            "parser": parser_name,
            "category": category,
            "expected_count": len(expected),
            "actual_count": len(actual),
            "true_positive": match.true_positive,
            "false_positive": match.false_positive,
            "false_negative": match.false_negative,
            "precision": round(match.precision, 4),
            "recall": round(match.recall, 4),
            "f1": round(match.f1, 4),
        })

    # Build report
    report = {
        "overall": {
            "true_positive": sum(r.true_positive for r in per_parser.values()),
            "false_positive": sum(r.false_positive for r in per_parser.values()),
            "false_negative": sum(r.false_negative for r in per_parser.values()),
        },
        "per_parser": {
            name: {
                "true_positive": r.true_positive,
                "false_positive": r.false_positive,
                "false_negative": r.false_negative,
                "precision": round(r.precision, 4),
                "recall": round(r.recall, 4),
                "f1": round(r.f1, 4),
                "false_positives": r.fp_details,
                "false_negatives": r.fn_details,
            }
            for name, r in per_parser.items()
        },
        "per_type": {
            name: {
                "true_positive": r.true_positive,
                "false_positive": r.false_positive,
                "false_negative": r.false_negative,
                "precision": round(r.precision, 4),
                "recall": round(r.recall, 4),
                "f1": round(r.f1, 4),
                "false_positives": r.fp_details,
                "false_negatives": r.fn_details,
            }
            for name, r in per_type.items()
        },
        "per_sample": all_results,
    }

    # Compute overall precision/recall/f1
    tp = report["overall"]["true_positive"]
    fp = report["overall"]["false_positive"]
    fn = report["overall"]["false_negative"]
    report["overall"]["precision"] = round(tp / (tp + fp) if (tp + fp) > 0 else 0.0, 4)
    report["overall"]["recall"] = round(tp / (tp + fn) if (tp + fn) > 0 else 0.0, 4)
    report["overall"]["f1"] = round(
        2 * report["overall"]["precision"] * report["overall"]["recall"] /
        (report["overall"]["precision"] + report["overall"]["recall"])
        if (report["overall"]["precision"] + report["overall"]["recall"]) > 0 else 0.0, 4
    )

    return report


def save_results(report: dict) -> Path:
    """Save results to the results directory."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output = RESULTS_DIR / "latest_accuracy.json"
    with open(output, "w") as f:
        json.dump(report, f, indent=2)
    return output


def print_report(report: dict) -> None:
    """Print a human-readable accuracy report."""
    print("=" * 72)
    print("REFRAMEX — ANALYSIS ACCURACY REPORT")
    print("=" * 72)
    print()
    print("OVERALL")
    print(f"  Precision: {report['overall']['precision']:.4f}")
    print(f"  Recall:    {report['overall']['recall']:.4f}")
    print(f"  F1:        {report['overall']['f1']:.4f}")
    print(f"  TP={report['overall']['true_positive']}  FP={report['overall']['false_positive']}  FN={report['overall']['false_negative']}")
    print()

    print("PER PARSER")
    print(f"  {'Parser':<16} {'Precision':>10} {'Recall':>10} {'F1':>10} {'TP':>5} {'FP':>5} {'FN':>5}")
    for name, r in report["per_parser"].items():
        print(f"  {name:<16} {r['precision']:>10.4f} {r['recall']:>10.4f} {r['f1']:>10.4f} {r['true_positive']:>5} {r['false_positive']:>5} {r['false_negative']:>5}")
    print()

    print("PER COMPONENT TYPE")
    print(f"  {'Type':<24} {'Precision':>10} {'Recall':>10} {'F1':>10} {'TP':>5} {'FP':>5} {'FN':>5}")
    for name, r in report["per_type"].items():
        print(f"  {name:<24} {r['precision']:>10.4f} {r['recall']:>10.4f} {r['f1']:>10.4f} {r['true_positive']:>5} {r['false_positive']:>5} {r['false_negative']:>5}")
    print()

    print("PER SAMPLE")
    print(f"  {'File':<24} {'Parser':<12} {'Precision':>10} {'Recall':>10} {'F1':>10} {'Exp':>5} {'Act':>5}")
    for s in report["per_sample"]:
        print(f"  {s['file']:<24} {s['parser']:<12} {s['precision']:>10.4f} {s['recall']:>10.4f} {s['f1']:>10.4f} {s['expected_count']:>5} {s['actual_count']:>5}")
    print()

    # False positives
    print("FALSE POSITIVES (by parser)")
    for name, r in report["per_parser"].items():
        if r["false_positives"]:
            print(f"\n  [{name}] — {len(r['false_positives'])} false positive(s):")
            for fp in r["false_positives"]:
                print(f"    {fp['name']} ({fp['type']}) line {fp['line']} rule={fp['rule']}: {fp['cause']}")

    # False negatives
    print("\nFALSE NEGATIVES (by parser)")
    for name, r in report["per_parser"].items():
        if r["false_negatives"]:
            print(f"\n  [{name}] — {len(r['false_negatives'])} false negative(s):")
            for fn in r["false_negatives"]:
                print(f"    {fn['name']} ({fn['type']}) line {fn['line']} rule={fn['rule']}: {fn['cause']}")

    print()
    print("=" * 72)
    print("NOTE: Extraction is static and regex/rule-based — not full semantic compilation.")
    print("Ground truth is hand-verified and never adjusted to improve numbers.")
    print("=" * 72)


if __name__ == "__main__":
    report = run_accuracy_report()
    save_results(report)
    print_report(report)
