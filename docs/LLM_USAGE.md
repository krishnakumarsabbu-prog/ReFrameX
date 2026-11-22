# ReFrameX M2O Intelligence — LLM Evaluation Layer Usage Guide

## Overview

The ReFrameX LLM Evaluation Layer provides an independent, advisory evaluation capability for mainframe-to-OpenShift modernization analysis. It operates as an **advisory layer only** — it does not alter deterministic engine scores, classifications, or ruleset evaluation. All LLM-generated insights are explicitly classified as **"AI-assisted (Inferred)"** and require human confirmation.

---

## 1. Safety & Offline-by-Default Architecture

1. **Zero External Network Calls by Default**: `LLM_ENABLED` is `false` by default. When disabled, the entire LLM evaluation subsystem is dormant, and zero network calls are initiated.
2. **Provider Allowlist & Host Validation**: External calls are strictly restricted to domains listed in `LLM_ALLOWED_HOSTS`. Requests targeting any other host are immediately blocked before transmission.
3. **Data Minimization & Automated PII Redaction**:
   - Only code snippets (capped at ±20 lines around the cited line) are sent — full source files are never transmitted.
   - All payloads pass through regex-based sanitization before leaving the environment:
     - IPv4/IPv6 addresses are masked as `[REDACTED_IP]`.
     - Email addresses are masked as `[REDACTED_EMAIL]`.
     - Hostnames/FQDNs are masked as `[REDACTED_HOST]`.
     - Account/card numbers (12-19 digits) are masked as `[REDACTED_ACCOUNT]`.
     - COBOL literal secrets (`MOVE 'password' TO ...`) are masked as `[REDACTED_SECRET]`.
     - COBOL 6-digit sequence numbers in columns 1-6 are stripped.
4. **Consent Preview Gate**: Every evaluation supports a pre-flight preview call (`POST /api/llm/preview`) allowing humans to inspect the exact redacted prompt and verify no proprietary data leaks before sending.
5. **Prompt Injection Defense**: All user-derived inputs and code snippets are fenced inside strict delimiters (`<<<SOURCE_SNIPPET>>>`), accompanied by instructions directing the model to treat input text solely as mainframe code, ignoring any embedded instructions or prompt injections.

---

## 2. Configuration & Environment Variables

Create or update your `.env` file based on `.env.example`:

| Environment Variable | Type | Default | Description |
|---|---|---|---|
| `LLM_ENABLED` | bool | `false` | Enable or disable the LLM evaluation layer. When `false`, zero network calls occur. |
| `LLM_PROVIDER` | str | `mock` | LLM backend: `mock`, `openai`, `groq`, `anthropic`, `ollama`, or `custom`. |
| `LLM_BASE_URL` | str | `https://api.groq.com/openai/v1` | Base URL for OpenAI-compatible endpoint. |
| `LLM_API_KEY` | str | `""` | API key for the LLM provider. |
| `LLM_MODEL` | str | `llama-3.3-70b-versatile` | Model name / deployment tag. |
| `LLM_ALLOWED_HOSTS` | str | `api.groq.com,api.openai.com,localhost,127.0.0.1` | Comma-separated list of permitted network hosts. |
| `LLM_SEND_MODE` | str | `snippets` | Data transmission mode (`snippets` or `metadata_only`). Full files are never sent. |
| `LLM_REDACT` | bool | `true` | Apply automated PII/account/secret redaction. |
| `LLM_TIMEOUT_SECONDS` | int | `30` | Request timeout in seconds. |
| `LLM_MAX_RETRIES` | int | `3` | Maximum retry attempts with exponential backoff on transient errors. |

---

## 3. Evaluation Tasks (T1, T2, T3)

The LLM evaluation layer supports three targeted tasks:

### Task T1: Finding Review
- **Purpose**: Evaluates a deterministic rule firing against the raw source snippet.
- **Output**:
  - `agrees_with_rule` (bool): Whether the LLM concurs with the engine's finding.
  - `ai_confidence` (float 0.0–1.0): Model certainty.
  - `suggested_classification` (Verified, Inferred, Assumed, Unknown).
  - `rationale` (str): Technical explanation citing mainframe semantics.
  - `cited_lines` (list[int]): Lines within the snippet supporting the conclusion.

### Task T2: Component Review
- **Purpose**: Verifies component boundaries, complexity attributes, and legacy indicators (e.g. EXEC CICS, embedded SQL, GOTO spaghetti).
- **Output**:
  - `verified_type` (str): Validated component type.
  - `complexity_assessment` (Low, Medium, High).
  - `suggested_classification` (Verified, Inferred, Assumed, Unknown).
  - `maintainability_concerns` (list[str]): Key modernization risks.
  - `rationale` (str): Detailed evaluation.
  - `cited_lines` (list[int]): Supporting lines.

### Task T3: Recommendation Critique
- **Purpose**: Critiques candidate modernization considerations (e.g., containerization on OpenShift vs. refactoring vs. mainframe retention).
- **Output**:
  - `feasibility` (High, Medium, Low).
  - `risks` (list[str]): Technical and operational hurdles.
  - `alternatives` (list[str]): Alternative target runtime or refactoring patterns.
  - `prerequisites` (list[str]): Required precursor steps (e.g., database normalization).
  - `rationale` (str): Comprehensive architectural critique.

---

## 4. REST API Endpoints

All endpoints are rooted at `/api/llm`:

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/llm/status` | Current configuration, provider, enabled status, and host allowlist. |
| `POST` | `/api/llm/test` | Test provider connectivity using a minimal ping prompt. |
| `POST` | `/api/llm/preview` | **Consent Preview Gate**: Returns the exact redacted payload without calling external LLM. |
| `POST` | `/api/llm/evaluate` | Execute evaluation on a finding, component, or recommendation. |
| `GET` | `/api/llm/evaluations/{app_id}` | Retrieve stored evaluations for an application. |
| `POST` | `/api/llm/review/{eval_id}` | Human-in-the-loop review action (`accept` or `dismiss`). |
| `GET` | `/api/llm/metrics/{app_id}` | Evaluation quality metrics (validity, citation accuracy, agreement). |

---

## 5. UI Integration

- **Settings > AI Assistance**: Real-time status badge, host allowlist view, and one-click provider connection tests.
- **Evidence Explorer > Finding Drawer**: "AI Second Opinion (Task T1)" section with:
  - "Preview Redacted Payload" modal (Consent Preview Gate).
  - "Request AI Opinion" button.
  - AI verdict, rationale, and cited lines with line-range validation.
  - One-click "Accept Suggestion" / "Dismiss" buttons.
- **Evidence Explorer > LLM Evaluation Harness Tab**:
  - 6 KPI metric tiles: Total Evaluations, Pending Review, Validity %, Citation Accuracy %, Engine Agreement %, Consistency Score.
  - Batch evaluation trigger button.
  - Interactive table of evaluations with search, filtering, and review actions.
