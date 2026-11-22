# 9. Presentation Kit

## Product Overview

ReframeX is an evidence-driven mainframe migration assessment accelerator. It analyzes application artifacts (COBOL, JCL, copybooks, SQL, BMS, VSAM) and produces three independent scores — Migration Complexity, Assessment Confidence, and Migration Readiness — with full evidence traceability from artifact line number to score contribution.

It does NOT convert, containerize, or migrate anything. It assesses readiness and complexity so teams can plan migration with confidence.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │Dashboard │  │Apps      │  │Artifacts │  │Intelligen││
│  │(mock)    │  │(API)     │  │(API)     │  │(API)     ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘│
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │Dependencies│ │Assessment│  │Evidence  │  │Risks     ││
│  │(API+Flow)│  │(API)     │  │(API)     │  │(API)     ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘│
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │Recommen- │  │Simulator │  │Reports   │  │Compare   ││
│  │dations   │  │(API)     │  │(API)     │  │(API)     ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘│
│                       │                                  │
│                  API Client (fetch)                      │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP REST
┌───────────────────────▼─────────────────────────────────┐
│                 Backend (FastAPI + SQLite)                │
│                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │Upload & │→ │Parsers  │→ │Dep.     │→ │Scoring  │    │
│  │Classify │  │Registry │  │Graph    │  │Engine   │    │
│  └─────────┘  └─────────┘  └─────────┘  └────┬────┘    │
│                                              │          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐      │          │
│  │Finding  │← │Recommen-│← │Report   │←─────┘          │
│  │Service  │  │dations  │  │Service  │                 │
│  └─────────┘  └─────────┘  └─────────┘                 │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Ruleset (JSON, 80 rules, 8 domains, versioned) │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  SQLite (9 tables, persistent, UUID keys)       │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## End-to-End Workflow

```
1. Create Application
       ↓
2. Upload Artifacts (files / ZIP / folder)
       ↓
3. Classify (extension + content signature + encoding)
       ↓
4. Parse (static extraction: components with line numbers + evidence)
       ↓
5. Discover Dependencies (CALL, COPY, EXEC SQL, JCL refs)
       ↓
6. Build Graph (adjacency, cycles, single points)
       ↓
7. Evaluate Rules (80 rules × 8 domains × 3 measures)
       ↓
8. Normalize & Aggregate (hyperbolic for complexity, baseline 0 for confidence/readiness)
       ↓
9. Classify (Low/Medium/High or Not Ready/Partially/Ready)
       ↓
10. Generate Findings (material conclusions with evidence class)
       ↓
11. Generate Recommendations (prioritized, evidence-linked)
       ↓
12. Human Review (validate, override, add context)
       ↓
13. Generate Report (19 sections, JSON/HTML/PDF)
```

## Assessment Model Explanation

Three independent measures, each 0-100:

**Complexity** — How hard will the migration be?
- 34 complexity rules detect patterns: GOTOs, ALTERs, dynamic calls, PERFORM nesting, embedded SQL, JCL complexity, CICS transactions, circular deps, assembler, unsupported tech
- Hyperbolic normalization: `100 * raw / (raw + 20)` ($K=20.0$) — soft cap prevents any single rule from dominating
- Higher = more complex

**Confidence** — How much can you trust this assessment?
- 23 confidence rules: +points for parsed artifacts, -points for missing/unresolved/unsupported
- Linear: `clamp(0.0 + raw, 0, 100)` — starts at baseline 0.0 (non-inflated) and capped by evidence coverage ratio (`coverage_ratio * 100`)
- Higher = more trustworthy

**Readiness** — Is the application ready for migration planning?
- 23 readiness rules: +points for documented owner/domain/tech, available DDL/JCL/BMS, completed graph; -points for missing docs, unresolved deps, no security docs
- Linear: `clamp(0.0 + raw, 0, 100)` — starts at baseline 0.0
- Higher = more ready

Key independence: adding a missing JCL artifact raises confidence (CF-JB-001: +3) but does NOT change complexity (JCL adds complexity via CX-JB rules, but the confidence evidence itself is separate). Adding GOTOs raises complexity but does not directly change confidence or readiness.

## Dependency Graph Demo

- Navigate to Dependency Intelligence
- The graph shows components as nodes and relationships as directed edges
- Edge types: static CALL, dynamic CALL, COPY, EXEC SQL table reference, JCL EXEC
- Click a node to see its impact radius (what depends on it, what it depends on)
- Circular dependencies are flagged in the assessment

## Impact Simulator Demo

- Navigate to Impact Simulator
- Select a component and a scenario (e.g., "Decompose into microservices")
- Run the simulation to see projected complexity/readiness changes
- View the blast radius across the dependency graph

## Second-Application Reuse Demo

- Create a new application (e.g., "LOAN-SERV")
- Upload its artifacts
- Run analysis and assessment — same pipeline, different results
- Use the Comparison page to compare CLAIMS-MGR vs LOAN-SERV side by side

## Limitations and Enterprise Considerations

- Static extraction only, not full semantic compilation
- DETECT_ONLY for HLASM, IMS, scheduler, security — specialist review needed
- No authentication (prototype), no multi-user
- SQLite local DB (prototype) — PostgreSQL for enterprise
- Default ruleset weights are expert-set, not empirically calibrated
- No outbound network calls by default (enterprise: allowlisted fetch only)

## Five-Minute Demo Script

See `docs/04_DEMONSTRATION_SCRIPT.md` for the full script.

**Centerpiece**: ONE finding (CX-AB-002: GOTO) traced end to end:
1. Artifact: CLAIMCTL.cbl
2. Line: 45
3. Rule: CX-AB-002 (GOTO statements indicate unstructured control flow)
4. Classification: Evidence-based
5. Score impact: +10 to complexity
6. Recommendation: "Restructure GOTO logic into structured PERFORM/IF-THEN-ELSE"
7. Reviewer override: Mark as "Accepted" with note "Legacy pattern, approved by architect"

Then: a missing JCL artifact is added → confidence rises (CF-JB-001 fires) while complexity stays correctly unchanged (proving measure independence).

## Likely Technical Judge Questions

**Q: What about false positives?**
A: All parsers use comment detection, string-aware parsing, and continuation-line merging. Parser accuracy is measured against 16 synthetic benchmark samples with self-authored ground truth (99.36% precision & recall: 155 TP / 1 FP / 1 FN). The confidence score explicitly signals when the assessment should not be fully trusted. Every finding is reviewable by a human.

**Q: Why not use an LLM for analysis?**
A: Three reasons: (1) The no-outbound-calls rule prohibits sending source code to public AI services. (2) Deterministic scoring requires reproducibility — LLMs are non-deterministic. (3) Evidence traceability requires that every conclusion cites a specific rule, artifact, and line number. An optional AI assistant extension point exists but is disabled by default and classifies all output as Inferred, never changing scores without human confirmation.

**Q: Who owns the ruleset?**
A: The ruleset is a versioned JSON file (`default_ruleset_v2.json`) validated against a JSON schema. Domain experts edit it; the scoring engine loads it at runtime. No code changes needed to add or modify rules.

**Q: How do you add a new language?**
A: Create a parser class with the `@register_parser` decorator, add the extension mapping in the classifier, and write tests. See the Reuse Guide (doc 06).

**Q: How do you handle Endevor source?**
A: Export from Endevor to a local directory or Git, then upload or use the folder import feature. The tool does not connect to Endevor directly, aligning with the Endevor-to-Git replication requirement.

**Q: Why does confidence differ from readiness?**
A: Confidence measures how much you can trust the assessment (are artifacts complete? are dependencies resolved?). Readiness measures whether the application is documented and understood (is the owner known? is the tech stack documented? are DDL/JCL/BMS available?). An application can have high confidence (all artifacts present) but low readiness (no documented owner). They are computed by completely separate rule sets.

**Q: How are the three measures kept independent?**
A: Each measure has its own set of rules (34 complexity, 23 confidence, 23 readiness, 80 total). Each measure has its own normalization formula (hyperbolic for complexity, linear baseline-0 for confidence and readiness). Aggregation uses the same domain weights but only over domains with evidence for that specific measure. Tests prove that changing a complexity weight does not change confidence or readiness scores.
