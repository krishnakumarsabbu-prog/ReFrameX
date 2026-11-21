# ReframeX — M2O Intelligence

A reusable, evidence-driven mainframe migration assessment accelerator for the Wells Fargo M2O Hackathon ("A Utility for Objective Refactoring").

ReframeX analyzes mainframe application artifacts and reports **Migration Complexity**, **Assessment Confidence**, and **Migration Readiness** separately, with traceable evidence, dependency graph, missing-information reporting, recommendations, and human review. It does NOT convert, containerize, or migrate anything.

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+

### Backend
```bash
cd backend
pip install -r requirements.txt
start_backend.bat
```

Or run `uvicorn app.main:app --reload --port 8000` directly.
API at http://127.0.0.1:8000 — Interactive docs at http://127.0.0.1:8000/docs

### Frontend
```bash
npm install
npm run dev
```
Open http://localhost:5173 (proxies `/api` to the backend)

### Run Tests
```bash
# Backend (107 tests)
cd backend
pip install pytest httpx
python -m pytest tests/ -v

# Frontend build
npm run build
```

## Architecture

- **Frontend**: React + TypeScript + Vite, Tailwind CSS, lucide-react, React Router, Recharts, React Flow
- **Backend**: Python FastAPI, SQLAlchemy, SQLite, Pydantic
- **No Docker, no paid services, no public AI, no outbound network calls**

## Modules (14)

| Module | Purpose |
|---|---|
| Executive Dashboard | Portfolio overview with clearly labeled illustrative demo metrics |
| Applications | CRUD for applications under assessment |
| Artifact Explorer | Upload, browse, and view source artifacts |
| Application Intelligence | Parser coverage, extracted components, evidence |
| Dependency Intelligence | Interactive dependency graph (React Flow) |
| Complexity Assessment | Three independent scores, 8 domains, 40 rules |
| Evidence Explorer | Trace findings to artifact lines and rules |
| Unknowns and Risks | Missing-information registry and risk register |
| Recommendations | Prioritized, evidence-linked refactoring actions |
| Impact Simulator | What-if refactoring scenarios |
| Assessment Reports | 19-section executive report, JSON/HTML export |
| Application Comparison | Side-by-side comparison of two applications |
| Evidence Improvement | Assessment history timeline with before/after |
| Settings | Cool slate and cyan wallpapers, custom image, reduce-transparency toggle |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET/POST | /api/applications | List / create applications |
| GET/PUT/DELETE | /api/applications/{id} | Application CRUD |
| GET/POST | /api/applications/{id}/artifacts | List / upload artifacts |
| POST | /api/applications/{id}/artifacts/import-folder | Import from M2O_METADATA_DIR |
| GET | /api/applications/{id}/artifacts/summary | Artifact summary |
| GET/DELETE | /api/artifacts/{id} | Artifact detail / delete |
| GET | /api/artifacts/{id}/content | Artifact content with highlights |
| POST | /api/applications/{id}/analyze | Run parsers |
| POST | /api/applications/{id}/reanalyze | Re-run parsers (no duplicates) |
| GET | /api/applications/{id}/components | Extracted components |
| GET | /api/applications/{id}/analysis-summary | Analysis summary |
| GET | /api/applications/{id}/parser-coverage | Parser coverage table |
| POST | /api/applications/{id}/discover-dependencies | Build dependency graph |
| GET | /api/applications/{id}/dependencies | List dependencies |
| GET | /api/applications/{id}/dependencies/summary | Dependency summary |
| GET | /api/applications/{id}/graph | Dependency graph data |
| GET | /api/components/{id}/dependencies | Component dependencies |
| GET | /api/components/{id}/impact | Component impact radius |
| POST | /api/applications/{id}/assess | Run assessment |
| GET | /api/applications/{id}/assessment | Get latest assessment |
| GET | /api/applications/{id}/assessment/domains | Domain breakdown |
| GET | /api/assessment/rules | Ruleset metadata and rules |
| POST | /api/applications/{id}/assess/what-if | What-if weight simulation |
| GET | /api/components/{id}/assessment | Component-level complexity |
| GET | /api/applications/{id}/findings | Findings with filters |
| GET | /api/applications/{id}/unknowns | Unknowns and missing info |
| GET | /api/applications/{id}/recommendations | Recommendations |
| GET | /api/applications/{id}/roadmap | Analysis roadmap |
| POST | /api/findings/{id}/review | Reviewer action on finding |
| GET | /api/applications/{id}/report | Full executive report |
| GET | /api/applications/compare | Compare two applications |
| GET | /api/applications/{id}/assessment-history | Assessment history |
| GET | /api/applications/{id}/export | Export report (JSON/HTML) |
| POST | /api/applications/{id}/simulate | Run impact simulation |
| GET | /api/applications/{id}/simulations | List simulations |
| GET | /api/applications/{id}/simulations/{sim_id} | Get simulation detail |
| GET | /api/assessment/ai-assistant/status | AI assistant status (disabled) |

## Documentation

| Document | Content |
|---|---|
| [Setup Guide](docs/SETUP.md) | Backend and frontend setup |
| [Problem Definition](docs/01_PROBLEM_DEFINITION.md) | Applications, artifacts, limitations |
| [Proposed Solution](docs/02_PROPOSED_SOLUTION.md) | Tool, inputs, methods, scoring, confidence |
| [Business Value](docs/03_EXPECTED_BUSINESS_VALUE.md) | Automatic vs human, consistency |
| [Demo Script](docs/04_DEMONSTRATION_SCRIPT.md) | 5-minute demo walkthrough |
| [Implementation](docs/05_IMPLEMENTATION_CONSIDERATIONS.md) | Supported types, security, accuracy |
| [Reuse Guide](docs/06_REUSE_GUIDE.md) | Assess a new app, add a parser/rule |
| [Limitations](docs/07_LIMITATIONS.md) | Unsupported, assumptions, gaps |
| [Traceability Matrix](docs/08_REQUIREMENT_TRACEABILITY.md) | Requirements to features and tests |
| [Presentation Kit](docs/09_PRESENTATION_KIT.md) | Architecture, demo, judge Q&A |
| [Parser Coverage](docs/PARSER_COVERAGE.md) | Parser accuracy table |
| [Scoring Methodology](docs/SCORING_METHODOLOGY.md) | Formulas, domains, thresholds |
| [Automation Model](docs/AUTOMATION_MODEL.md) | Automated vs rules-based vs AI vs human |
| [Data Profile](docs/DATA_PROFILE.md) | Expected file types and encodings |

## Scoring Model

- **Model version**: `reframex-scoring-v1`
- **Ruleset**: `default_ruleset_v1` (40 rules, 8 domains, 3 measures)
- **Complexity**: sigmoid `100 * raw / (raw + 20)`, 24 rules
- **Confidence**: `clamp(50 + raw, 0, 100)`, 11 rules
- **Readiness**: `clamp(50 + raw, 0, 100)`, 13 rules
- All three measures are computed independently

See [docs/SCORING_METHODOLOGY.md](docs/SCORING_METHODOLOGY.md) for full details.

## Test Results

- **107 tests passing** (90 original + 17 Phase 9 validation)
- **Parser accuracy**: 100% precision, 100% recall, 100% F1 (156 components, 16 samples)
- **Frontend build**: Passes with no errors

## Configuration

| Env Var | Default | Purpose |
|---|---|---|
| REFRAMEX_UPLOAD_DIR | backend/uploads | Upload storage |
| REFRAMEX_DB_PATH | backend/reframex.db | SQLite database |
| M2O_METADATA_DIR | (none) | Read-only folder import source |

No secrets, no API keys, no external URLs.
