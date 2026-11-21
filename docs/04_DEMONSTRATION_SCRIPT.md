# 4. Demonstration Script and Evidence

## Demo Setup

1. Start the backend: `cd backend && uvicorn app.main:app --reload --port 8000`
2. Start the frontend: `npm run dev`
3. Open http://localhost:5173

## Demo Flow (5 minutes)

### Step 1: Application Setup (30 seconds)
- Navigate to Applications page
- Show the CLAIMS-MGR application already created
- Click to view its artifact inventory

### Step 2: Artifact Upload (30 seconds)
- Navigate to Artifact Explorer
- Show uploaded artifacts: COBOL program, copybook, JCL, BMS map, SQL DDL
- Click into the COBOL source viewer to show line-numbered content with highlights

### Step 3: Application Intelligence (30 seconds)
- Navigate to Application Intelligence
- Show the parser coverage table and extracted components
- Point out the evidence classifications (Evidence-based, Inferred)

### Step 4: Dependency Graph (30 seconds)
- Navigate to Dependency Intelligence
- Show the interactive React Flow graph
- Highlight a CALL dependency edge and its evidence reference

### Step 5: Complexity Assessment — THE CENTERPIECE (90 seconds)
- Navigate to Complexity Assessment
- Click "Run Assessment"
- Show the three independent score rings: Complexity, Confidence, Readiness
- **Trace ONE finding end to end**:
  - Click the Complexity ring to open the drill-down drawer
  - Find the CX-AB-002 (GOTO) rule firing
  - Expand the rule to show:
    - The rule ID and description
    - The explanation
    - The evidence reference: artifact name, line number, source snippet
  - Note the score contribution (+10 points to complexity)
  - Click the evidence reference to navigate to the source artifact at that line
- **Show the recommendation**:
  - Navigate to Recommendations
  - Find the recommendation linked to the GOTO finding
  - Note the effort estimate and priority

### Step 6: Missing Artifact → Confidence Rises (60 seconds)
- Navigate to Evidence Explorer or Unknowns and Risks
- Show the missing-information registry (e.g., "Missing JCL artifacts")
- Note the confidence impact (CF-JB-002: -10 to confidence)
- **Switch to the Evidence Improvement page**
- Show the assessment history timeline
- **Add the missing JCL artifact** (return to Artifact Explorer, upload JOB.jcl)
- **Re-run assessment**
- Show: Confidence score INCREASES while Complexity score stays CORRECTLY UNCHANGED
- This proves the three measures are independent

### Step 7: What-If Simulation (30 seconds)
- Open the Rule Studio modal
- Adjust CX-AB-002 weight from 10 to 50
- Click "Run What-If"
- Show the before/after comparison: complexity increases, confidence and readiness unchanged

### Step 8: Report (30 seconds)
- Navigate to Assessment Reports
- Show the 19-section executive report
- Export as JSON or HTML

## Evidence Artifacts

The following evidence is available for the demonstration:

| Evidence | Location |
|---|---|
| Ground truth data | `backend/tests/ground_truth/ground_truth.json` |
| Accuracy report output | `backend/app/tests/ground_truth/results/latest_accuracy.json` |
| Scoring methodology | `docs/SCORING_METHODOLOGY.md` |
| Ruleset | `backend/app/assessment/rulesets/default_ruleset_v1.json` |
| Test results | 107 tests passing (90 original + 17 Phase 9) |
| Parser coverage | `docs/PARSER_COVERAGE.md` |
