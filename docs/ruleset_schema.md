# ReFrameX Declarative Ruleset Specification (v2.1)

ReFrameX assessments evaluate mainframe inventory against a declarative, deterministic ruleset stored in JSON format (e.g., `backend/app/assessment/rulesets/default_ruleset_v2.json`). No heuristic weights are hardcoded in application logic; all scoring criteria, domains, scopes, and conditions are fully defined in the schema.

---

## 1. Top-Level Ruleset Schema

A ruleset document conforms to the following schema:

```json
{
  "ruleset_id": "default_ruleset_v2",
  "version": "2.1.0",
  "effective_date": "2026-11-23",
  "owner": "ReFrameX Architecture Review Board",
  "baselines": {
    "complexity": 0.0,
    "confidence": 0.0,
    "readiness": 0.0
  },
  "hyperbolic_k": 20.0,
  "coverage_cap": {
    "type": "linear",
    "multiplier": 100.0
  },
  "changelog": [
    {
      "version": "2.1.0",
      "date": "2026-11-23",
      "author": "Antigravity Engineering",
      "summary": "v2.1 ruleset..."
    }
  ],
  "domain_weights": {
    "application_business_logic": 0.18,
    "data_structures": 0.12,
    "database_persistence": 0.15,
    "jobs_batch_orchestration": 0.12,
    "online_transactions_ui": 0.15,
    "integration_external_dependencies": 0.12,
    "security_controls": 0.08,
    "operational_nonfunctional": 0.08
  },
  "thresholds": {
    "complexity": { "low": 35, "medium": 65 },
    "confidence": { "low": 40, "medium": 70 },
    "readiness": { "low": 40, "medium": 70 }
  },
  "rules": [ ... ]
}
```

### Key Parameters:
- **`baselines`**: Base scores for unevidenced states (0.0 across all measures).
- **`hyperbolic_k`**: The saturation constant ($K = 20.0$) in the hyperbolic curve:
  $$\text{Score} = \frac{100 \times \text{raw}}{\text{raw} + K}$$
- **`domain_weights`**: Sums to 1.00 across the 8 architecture domains.
- **`thresholds`**: Classifies numeric scores into `Low`, `Medium`, `High` (complexity) or `Low`, `Medium`, `High / Ready` (confidence/readiness).

---

## 2. Rule Definition Schema

Each rule in the `"rules"` array contains:

| Field | Type | Description |
|---|---|---|
| `rule_id` | string | Unique identifier, e.g. `CX-AB-001`, `CO-DS-001`, `RD-JB-001`. Prefix indicates measure (`CX`=complexity, `CO`=confidence, `RD`=readiness). |
| `name` | string | Human-readable title of the architectural rule. |
| `domain` | enum | One of the 8 canonical architecture domains. |
| `measure` | enum | `complexity`, `confidence`, or `readiness`. |
| `evaluation_scope` | enum | `application`, `artifact`, `component`, or `dependency`. |
| `condition` | string | Boolean expression evaluated against scope context. |
| `condition_type` | string | `boolean_expression` or `graph_metric`. |
| `impact` | enum | `negative` (increases complexity) or `positive` (increases confidence/readiness). |
| `weight` | float | Impact weight added upon firing. |
| `description` | string | Architectural rationale for why this rule is checked. |
| `rationale` | string | Deep-dive explanation for mainframe modernization. |
| `recommendation` | string | Actionable modernization remediation or target pattern. |
| `severity` | enum | `high`, `medium`, `low`, or `info`. |

---

## 3. Evaluation Scopes & Available Context Keys

The engine passes a structured dictionary context (`ctx`) into condition evaluation depending on `evaluation_scope`:

### 1. `component` Scope
Evaluated once for every normalized component in the application:
- `component_type`: `PROGRAM`, `PARAGRAPH`, `MODULE`, `COPYBOOK`, `DATABASE_TABLE`, `MAPSET`, `VSAM_CLUSTER`, etc.
- `technology`: `COBOL`, `JCL`, `SQL`, `BMS`, `HLASM`, `VSAM`, `RACF`.
- `name`: Component identifier.
- `detected_properties`: Dictionary of properties extracted by parsers:
  - `paragraph_count`: String/integer count of paragraphs in a COBOL program.
  - `occurs_max`: Maximum OCCURS dimension for arrays/tables.
  - `perform_nesting_depth`: Maximum depth of nested PERFORM statements.
  - `has_exec_sql`, `has_exec_cics`, `call_type`, `has_goto`, etc.

### 2. `artifact` Scope
Evaluated once per ingested artifact:
- `artifact_category`: `COBOL`, `JCL`, `COPYBOOK`, `SQL`, `BMS`, `ASSEMBLER`, `SECURITY`, `CONFIG`, `DATA`.
- `support_level`: `FULL_EXTRACT`, `DETECT_ONLY`, `UNSUPPORTED`.
- `parse_status`: `parsed`, `detected`, `error`, `unsupported`.
- `line_count`: Total lines of code.

### 3. `dependency` Scope
Evaluated once per graph edge:
- `dependency_type`: `calls_static`, `calls_dynamic`, `includes_copybook`, `executes_job_step`, `accesses_table`, `sends_bms_map`, etc.
- `source_type`, `target_type`: Component types of endpoints.
- `confidence`: Confidence class (`Evidence-based`, `Inferred`, `Assumed`).

### 4. `application` Scope
Evaluated once across the aggregated application inventory:
- `has_cobol`, `has_jcl`, `has_bms`, `has_ddl`, `has_assembler`, `has_copybooks`, `has_security_components`: Booleans indicating evidence presence.
- `unresolved_dependencies`: Count of missing dependency targets.
- `unsupported_count`: Count of opaque/unsupported files.
- `artifacts_total`, `components_total`, `dependencies_total`.
- `has_open_high_findings`, `unparsed_artifacts_count`, `pending_review_findings_count`.

---

## 4. Condition Syntax & Operators

Rule conditions are rewritten and evaluated in a restricted, sandboxed Python environment (`{"__builtins__": {}}`):

| Syntax | Example | Description |
|---|---|---|
| `X present` | `detected_properties.paragraph_count present` | Checks key existence and not None. |
| `X contains Y` | `detected_properties.cics_commands contains 'SYNCPOINT'` | Substring or collection membership. |
| `X in [...]` | `component_type in ['MODULE', 'PROGRAM']` | Value in literal list. |
| `==`, `!=` | `technology == 'COBOL'` | Equality checks. |
| `>`, `<`, `>=`, `<=` | `detected_properties.paragraph_count > 10` | Numeric comparison (with type safety). |
| `and`, `or`, `not` | `has_cobol and not has_jcl` | Logical operators. |

---

## 5. Adding and Testing a New Rule

### Step 1: Add the Rule to `default_ruleset_v2.json`
Append a new entry in `backend/app/assessment/rulesets/default_ruleset_v2.json`:
```json
{
  "rule_id": "CX-AB-010",
  "name": "Heavy Assembler Macros in Critical Path",
  "domain": "application_business_logic",
  "measure": "complexity",
  "evaluation_scope": "component",
  "condition": "component_type == 'MODULE' and technology == 'HLASM' and detected_properties.macro_count present and detected_properties.macro_count > 5",
  "condition_type": "boolean_expression",
  "impact": "negative",
  "weight": 3.0,
  "description": "High macro invocations in assembler routines complicate decompilation.",
  "rationale": "Custom macros obscure machine instruction sequences and register conventions.",
  "recommendation": "Expand macro definitions prior to code translation or port to C/Java.",
  "severity": "medium"
}
```

### Step 2: Validate Against Schema and Grammar
Run the built-in validator to verify schema compliance and condition compile safety:
```bash
py -c "from app.assessment.scoring_engine import load_ruleset; from app.assessment.ruleset_validator import validate_ruleset; r = load_ruleset(); errs = validate_ruleset(r); print('Errors:', errs)"
```

### Step 3: Run Engine Unit Tests
```bash
cd backend
py -m pytest tests/test_rule_condition_integrity.py -k test_ruleset_validator_zero_errors
```

### Step 4: Audit Trace Verification
Run the application assessment and query the audit endpoint:
```http
GET /api/applications/{app_id}/rules/audit?rule_id=CX-AB-010
```
Inspect the returned clauses, matched status, and audit reason.
