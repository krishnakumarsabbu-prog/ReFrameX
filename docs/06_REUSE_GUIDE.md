# 6. Reuse Guide

## Assessing a Different Application

### Step 1: Create an Application
```
POST /api/applications
{
  "name": "MY-APP",
  "business_domain": "Banking",
  "owner": "Application Team",
  "technology_stack": "COBOL, DB2, CICS"
}
```

### Step 2: Upload Artifacts
Upload files via the Artifact Explorer UI, or via API:
```
POST /api/applications/{app_id}/artifacts
  files: (multipart upload)
```
Or import from a folder:
```
POST /api/applications/{app_id}/artifacts/import-folder
```
Set the folder path via the `M2O_METADATA_DIR` environment variable before starting the backend.

### Step 3: Run Analysis
```
POST /api/applications/{app_id}/analyze
```
This runs all parsers and extracts components with evidence references.

### Step 4: Discover Dependencies
```
POST /api/applications/{app_id}/discover-dependencies
```
This builds the dependency graph from extracted components.

### Step 5: Run Assessment
```
POST /api/applications/{app_id}/assess
```
This evaluates all 80 rules (34 complexity, 23 confidence, 23 readiness) against the evidence and computes complexity, confidence, and readiness.

### Step 6: Review Findings
Navigate to the Evidence Explorer or Unknowns and Risks page. Review each finding, override evidence classifications if needed, and add reviewer notes.

### Step 7: Generate Report
Navigate to Assessment Reports, select sections, and export as JSON or HTML.

## Adding a New Parser

### Step 1: Create the Parser File
Create `backend/app/parsers/mylang_parser.py`:

```python
from app.parsers.base import BaseParser, Component, register_parser, CapabilityLevel

@register_parser
class MyLangParser(BaseParser):
    name = "mylang"
    version = "1.0.0"
    supported_categories = ["MYLANG"]
    capability = CapabilityLevel.FULL_EXTRACT

    def parse(self, artifact_id: str, filename: str, content: str) -> list[Component]:
        components = []
        for line_num, line in enumerate(content.splitlines(), 1):
            # Extract components using regex/rule-based patterns
            if line.strip().startswith("FUNCTION "):
                name = line.strip().split()[1]
                components.append(Component(
                    name=name,
                    component_type="PROGRAM",
                    technology="MYLANG",
                    line_start=line_num,
                    line_end=line_num,
                    evidence_class="Evidence-based",
                    evidence_refs=[{
                        "artifact_id": artifact_id,
                        "line_start": line_num,
                        "line_end": line_num,
                        "rule": "MYLANG_FUNCTION",
                        "snippet": line.strip(),
                    }],
                ))
        return components
```

### Step 2: Register the Parser
Add an import in `backend/app/parsers/__init__.py`:
```python
from app.parsers.mylang_parser import MyLangParser  # noqa
```

### Step 3: Add Classification
Edit `backend/app/parsers/classifier.py` to add the extension mapping:
```python
EXTENSION_MAP[".myl"] = ("MYLANG", "SUPPORTED_PARSE")
```

### Step 4: Add Component Type (if needed)
Edit `backend/app/parsers/base.py` to add the component type if it doesn't exist.

### Step 5: Write Tests
Create test cases in `backend/tests/test_parsers.py` following the existing pattern.

### Step 6: Add Ground Truth
Add sample files to `backend/tests/ground_truth/samples/` and update `ground_truth.json`.

## Adding a New Artifact Type

1. Add the extension mapping in `classifier.py`
2. Set the support level (SUPPORTED_PARSE, DETECT_ONLY, or UNSUPPORTED)
3. If SUPPORTED_PARSE, create a parser (see above)
4. If DETECT_ONLY, the detect-only parser will handle it automatically

## Adding a New Rule

### Step 1: Edit the Ruleset
Open `backend/app/assessment/rulesets/default_ruleset_v2.json` and add a rule:

```json
{
  "rule_id": "CX-AB-010",
  "domain": "application_business_logic",
  "measure": "complexity",
  "description": "New pattern detected",
  "detection_condition": "component_type == 'PROGRAM' and detected_properties.my_indicator == 'yes'",
  "weight": 8,
  "impact": "negative",
  "severity": "medium",
  "evidence_requirement": "component with my_indicator=yes",
  "explanation": "This pattern increases migration complexity because...",
  "recommendation": "Refactor to eliminate this pattern before migration.",
  "upgrade_guidance": "See migration pattern guide section X."
}
```

### Step 2: Validate the Schema
```bash
python -c "from app.assessment.scoring_engine import load_ruleset; load_ruleset()"
```

### Step 3: Ensure the Parser Extracts the Required Property
The parser must set `detected_properties.my_indicator = "yes"` in the component's `detected_properties` JSON.

### Step 4: Write a Test
Add a test in `backend/tests/test_scoring.py` or `test_phase9_validation.py` that creates a component with the property and verifies the rule fires.

### Step 5: Run Tests
```bash
cd backend && python -m pytest tests/test_scoring.py tests/test_phase9_validation.py -q
```
