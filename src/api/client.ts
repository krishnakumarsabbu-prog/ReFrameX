/**
 * ReframeX API client — talks to the FastAPI backend via Vite proxy (/api).
 */

export interface Application {
  id: string;
  name: string;
  description: string | null;
  business_domain: string | null;
  owner: string | null;
  technology_stack: string | null;
  environment: string | null;
  assessment_status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  artifact_count: number;
}

export interface ApplicationCreate {
  name: string;
  description?: string;
  business_domain?: string;
  owner?: string;
  technology_stack?: string;
  environment?: string;
  assessment_status?: string;
}

export interface ApplicationUpdate {
  name?: string;
  description?: string;
  business_domain?: string;
  owner?: string;
  technology_stack?: string;
  environment?: string;
  assessment_status?: string;
  is_active?: boolean;
}

export interface Artifact {
  id: string;
  application_id: string;
  original_filename: string;
  relative_path: string;
  extension: string | null;
  category: string;
  size_bytes: number;
  processing_status: string;
  sha256: string;
  parse_status: string;
  support_level: string;
  detected_encoding: string;
  fixed_record_length_hint: number | null;
  error_message: string | null;
  detection_reason: string | null;
}

export interface ArtifactSummary {
  total: number;
  by_category: Record<string, number>;
  by_support_level: Record<string, number>;
  by_encoding: Record<string, number>;
  total_size_bytes: number;
}

export interface ArtifactContent {
  id: string;
  original_filename: string;
  relative_path: string;
  category: string;
  size_bytes: number;
  encoding: string;
  content: string | null;
  is_text: boolean;
  highlight_ranges: HighlightRange[];
}

export interface HighlightRange {
  line_start: number;
  line_end: number;
  rule: string;
  finding_id: string;
  evidence_class: string;
  explanation: string;
}

export interface ImportFolderResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface HealthStatus {
  status: string;
  version: string;
  metadata_dir_configured: boolean;
}

// ---- Analysis types ----

export interface EvidenceRef {
  artifact_id: string;
  line_start: number;
  line_end: number;
  rule: string;
  snippet?: string;
}

export interface Component {
  id: string;
  application_id: string;
  name: string;
  component_type: string;
  technology: string;
  source_artifact_id: string;
  source_filename: string;
  line_start: number;
  line_end: number;
  detected_properties: Record<string, string>;
  evidence_class: string;
  evidence_refs: EvidenceRef[];
  warnings: string[];
  parser_name: string;
  parser_version: string;
}

export interface AnalyzeResponse {
  run_id: string;
  application_id: string;
  artifacts_processed: number;
  components_extracted: number;
  warnings_count: number;
  duration_ms: number;
  status: string;
}

export interface AnalysisSummary {
  application_id: string;
  last_run_id: string | null;
  last_run_at: string | null;
  duration_ms: number | null;
  artifacts_processed: number;
  components_extracted: number;
  warnings_count: number;
  by_type: Record<string, number>;
  by_technology: Record<string, number>;
  by_evidence_class: Record<string, number>;
  parser_versions: Record<string, string>;
  status: string;
}

export interface ParserInfo {
  name: string;
  version: string;
  capability: string;
  supported_categories: string;
}

export interface ParserCoverageEntry {
  artifact_id: string;
  filename: string;
  category: string;
  support_level: string;
  parser_name: string | null;
  parser_version: string | null;
  capability: string | null;
  parse_status: string;
  components_extracted: number;
  warnings: number;
  error: string | null;
}

export interface ParserCoverageReport {
  total_artifacts: number;
  by_capability: Record<string, number>;
  by_parse_status: Record<string, number>;
  by_category: Record<string, number>;
  parsers: ParserInfo[];
  entries: ParserCoverageEntry[];
  unsupported_artifacts: ParserCoverageEntry[];
}

// ---- Dependency types ----

export interface Dependency {
  id: string;
  application_id: string;
  source_component_id: string;
  target_component_id: string;
  relationship_type: string;
  detection_method: string;
  evidence_class: string;
  source_artifact_id: string;
  source_line_number: number;
  evidence_ref: {
    artifact_id: string;
    line_start: number;
    line_end: number;
    rule: string;
    snippet: string;
  };
  description: string | null;
}

export interface GraphNode {
  id: string;
  name: string;
  component_type: string;
  technology: string;
  evidence_class: string;
  source_filename: string;
  source_artifact_id: string;
  line_start: number;
  line_end: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship_type: string;
  evidence_class: string;
  detection_method: string;
  source_line_number: number;
  description: string | null;
}

export interface GraphData {
  application_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  total_nodes: number;
  total_edges: number;
}

export interface DependencySummary {
  application_id: string;
  total_dependencies: number;
  by_relationship_type: Record<string, number>;
  by_evidence_class: Record<string, number>;
  unresolved_targets: number;
  circular_dependencies: number;
  single_points: number;
}

export interface ComponentImpact {
  component_id: string;
  component_name: string;
  component_type: string;
  direct_dependencies: number;
  upstream_count: number;
  downstream_count: number;
  indirect_upstream: number;
  indirect_downstream: number;
  shared_components: number;
  dependency_depth: number;
  circular: boolean;
  circular_paths: string[][];
  single_point_of_dependency: boolean;
  incoming: Dependency[];
  outgoing: Dependency[];
  connected_components: { id: string }[];
  associated_artifacts: string[];
  risk_indicators: string[];
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}


// ---- Assessment types (Phase 5) ----

export interface RuleFiring {
  rule_id: string;
  domain: string;
  measure: string;
  description: string;
  weight: number;
  impact: string;
  severity: string;
  explanation: string;
  recommendation: string | null;
  upgrade_guidance: string | null;
  evidence_refs: Array<{ artifact_id: string; line_start: number; line_end: number; rule: string; snippet?: string }>;
  points: number;
}

export interface DomainScore {
  score: number | null;
  classification: string;
  has_evidence: boolean;
  fired_rule_count: number;
  positive_factors: string[];
  negative_factors: string[];
  not_evidenced_notes: string[];
}

export interface Assessment {
  application_id: string;
  model_version: string;
  ruleset_id: string;
  ruleset_version: string;
  computed_at: string;
  complexity_score: number;
  complexity_classification: string;
  confidence_score: number;
  confidence_classification: string;
  readiness_score: number;
  readiness_classification: string;
  domain_scores: Record<string, Record<string, DomainScore>>;
  fired_rules: RuleFiring[];
  positive_factors: string[];
  negative_factors: string[];
  missing_information: string[];
  assessment_limitations: string[];
  recommended_next_steps: string[];
  evidence_refs: Array<{ artifact_id: string; line_start: number; line_end: number; rule: string; snippet?: string }>;
  duration_ms: number;
}

export interface DomainBreakdown {
  label: string;
  scores: Record<string, {
    score: number | null;
    classification: string;
    has_evidence: boolean;
    fired_rules: RuleFiring[];
    positive_factors: string[];
    negative_factors: string[];
    evidence_refs: Array<{ artifact_id: string; line_start: number; line_end: number; rule: string; snippet?: string }>;
    not_evidenced_notes: string[];
  }>;
}

export interface RuleInfo {
  rule_id: string;
  domain: string;
  measure: string;
  description: string;
  detection_condition: string;
  weight: number;
  impact: string;
  severity: string;
  evidence_requirement: string;
  explanation: string;
  recommendation: string | null;
  upgrade_guidance: string | null;
}

export interface RulesetInfo {
  ruleset_id: string;
  version: string;
  effective_date: string;
  owner: string;
  changelog: Array<{ version: string; date: string; author: string; summary: string }>;
  domain_weights: Record<string, number>;
  thresholds: Record<string, { low: number; medium: number }>;
  model_version: string;
  rule_count: number;
}

export interface RulesResponse {
  ruleset_info: RulesetInfo;
  rules: RuleInfo[];
}

export interface WhatIfResponse {
  before: Assessment;
  after: Assessment;
  weight_overrides: Record<string, number>;
  human_reviewed: boolean;
}

export interface ComponentAssessment {
  component_id: string;
  component_name: string;
  component_type: string;
  technology: string;
  complexity_score: number;
  complexity_classification: string;
  raw_score: number;
  fired_rules: RuleFiring[];
  evidence_refs: Array<{ artifact_id: string; line_start: number; line_end: number; rule: string; snippet?: string }>;
  model_version: string;
  ruleset_version: string;
}

// ---- Phase 6: Findings, Reviews, Recommendations, Roadmap ----

export interface ReviewAction {
  id: string;
  finding_id: string;
  action: string;
  reviewer_name: string;
  reviewer_role: string;
  reason: string | null;
  notes: string | null;
  context: string | null;
  created_at: string;
}

export interface Finding {
  id: string;
  application_id: string;
  title: string;
  domain: string;
  severity: string;
  evidence_class: string;
  source_artifact_id: string | null;
  source_filename: string;
  line_start: number;
  line_end: number;
  has_line_ref: boolean;
  detection_rule: string;
  explanation: string;
  confidence: number;
  assessment_impact: string;
  recommended_action: string | null;
  review_status: string;
  finding_type: string;
  component_id: string | null;
  extra: Record<string, unknown>;
  created_at: string;
  review_actions: ReviewAction[];
  reviewer_status: string | null;
  reviewer_notes: string | null;
}

export interface ReviewRequest {
  action: string;
  reviewer_name?: string;
  reviewer_role?: string;
  reason?: string;
  notes?: string;
  context?: string;
}

export interface Recommendation {
  category: string;
  component: string;
  component_id: string | null;
  component_type: string;
  classification: string;
  reason: string;
  supporting_evidence: string[];
  dependencies: string[];
  complexity_score: number;
  complexity_classification: string;
  confidence_score: number;
  confidence_classification: string;
  readiness_score: number;
  readiness_classification: string;
  key_risks: string[];
  prerequisites: string[];
  next_action: string;
  candidate_considerations: string[];
}

export interface RecommendationSummary {
  application_id: string;
  total: number;
  by_category: Record<string, number>;
  recommendations: Recommendation[];
}

export interface RoadmapItem {
  group: string;
  priority: string;
  action: string;
  reason: string;
  related_components: string[];
  required_evidence: string[];
  expected_outcome: string;
}

export interface Roadmap {
  application_id: string;
  groups: Record<string, RoadmapItem[]>;
  total_items: number;
}

export interface UnknownsResponse {
  application_id: string;
  total: number;
  by_type: Record<string, number>;
  items: Finding[];
}

// ---- Phase 7: Reports, Comparison, History, Export ----

export interface ReportSection {
  [key: string]: any;
}

export interface Report {
  report_metadata: {
    generated_at: string;
    application_id: string;
    application_name: string;
    assessment_record_id: string | null;
    assessment_version: number | null;
    report_format: string;
    generator: string;
  };
  executive_summary: {
    application_name: string;
    has_assessment: boolean;
    complexity_score: number | null;
    complexity_classification: string;
    confidence_score: number | null;
    confidence_classification: string;
    readiness_score: number | null;
    readiness_classification: string;
    artifact_count: number;
    component_count: number;
    dependency_count: number;
    finding_count: number;
    unknown_evidence_count: number;
    high_severity_finding_count: number;
    assessment_version: number | null;
    computed_at: string | null;
    note: string;
  };
  application_overview: ReportSection;
  artifact_inventory: ReportSection;
  component_inventory: ReportSection;
  dependency_analysis: ReportSection;
  domain_assessments: Record<string, {
    label: string;
    complexity: { score: number | null; classification: string; has_evidence: boolean };
    confidence: { score: number | null; classification: string; has_evidence: boolean };
    readiness: { score: number | null; classification: string; has_evidence: boolean };
  }>;
  migration_complexity: ReportSection;
  assessment_confidence: ReportSection;
  migration_readiness: ReportSection;
  major_risks: ReportSection;
  evidence_gaps: ReportSection;
  component_recommendations: ReportSection;
  refactoring_considerations: ReportSection;
  prioritized_next_steps: ReportSection;
  parser_coverage_and_accuracy: ReportSection;
  automation_and_ai_statement: ReportSection;
  limitations_and_assumptions: ReportSection;
  versions: ReportSection;
  reviewer_changes: ReportSection;
  measured_metrics: ReportSection;
  [key: string]: any;
}

export interface ComparisonAppSummary {
  application_id: string;
  application_name: string;
  description: string | null;
  business_domain: string | null;
  has_assessment: boolean;
  model_version: string;
  ruleset_id: string;
  ruleset_version: string;
  complexity_score: number | null;
  complexity_classification: string;
  confidence_score: number | null;
  confidence_classification: string;
  readiness_score: number | null;
  readiness_classification: string;
  artifact_count: number;
  artifact_by_category: Record<string, number>;
  component_count: number;
  component_by_type: Record<string, number>;
  component_by_technology: Record<string, number>;
  dependency_count: number;
  dependency_by_type: Record<string, number>;
  dependency_unresolved: number;
  finding_count: number;
  risk_by_severity: Record<string, number>;
  risk_by_evidence_class: Record<string, number>;
  missing_evidence_count: number;
  missing_evidence_by_type: Record<string, number>;
  domain_complexity: Record<string, {
    label: string;
    complexity_score: number | null;
    confidence_score: number | null;
    readiness_score: number | null;
    has_evidence: boolean;
  }>;
  recommended_next_steps: string[];
  computed_at: string | null;
}

export interface Comparison {
  application_a: ComparisonAppSummary;
  application_b: ComparisonAppSummary;
  version_warning: {
    type: string;
    message: string;
    [key: string]: unknown;
  } | null;
  deltas: {
    artifact_count_delta: number;
    component_count_delta: number;
    dependency_count_delta: number;
    finding_count_delta: number;
    missing_evidence_delta: number;
    complexity_score_delta: number | null;
    confidence_score_delta: number | null;
    readiness_score_delta: number | null;
    domain_deltas: Record<string, {
      label: string;
      complexity_delta: number | null;
      confidence_delta: number | null;
      readiness_delta: number | null;
    }>;
  };
  comparison_note: string;
}

export interface AssessmentHistoryItem {
  id: string;
  version: number;
  application_id: string;
  model_version: string;
  ruleset_id: string;
  ruleset_version: string;
  complexity_score: number;
  complexity_classification: string;
  confidence_score: number;
  confidence_classification: string;
  readiness_score: number;
  readiness_classification: string;
  computed_at: string;
  duration_ms: number;
  human_reviewed: boolean;
  is_current: boolean;
  result: Record<string, unknown>;
}

// ---- Applications ----

export const api = {
  // Health
  health: () => request<HealthStatus>('/api/health'),

  // Applications
  listApplications: () => request<Application[]>('/api/applications'),
  getApplication: (id: string) => request<Application>(`/api/applications/${id}`),
  createApplication: (data: ApplicationCreate) =>
    request<Application>('/api/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateApplication: (id: string, data: ApplicationUpdate) =>
    request<Application>(`/api/applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteApplication: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/api/applications/${id}`, { method: 'DELETE' }),

  // Artifacts
  listArtifacts: (appId: string) =>
    request<Artifact[]>(`/api/applications/${appId}/artifacts`),
  uploadArtifacts: (appId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return request<Artifact[]>(`/api/applications/${appId}/artifacts`, {
      method: 'POST',
      body: form,
    });
  },
  importFolder: (appId: string) =>
    request<ImportFolderResult>(`/api/applications/${appId}/artifacts/import-folder`, {
      method: 'POST',
    }),
  artifactSummary: (appId: string) =>
    request<ArtifactSummary>(`/api/applications/${appId}/artifacts/summary`),
  getArtifact: (id: string) => request<Artifact>(`/api/artifacts/${id}`),
  getArtifactContent: (id: string) =>
    request<ArtifactContent>(`/api/artifacts/${id}/content`),
  deleteArtifact: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/api/artifacts/${id}`, { method: 'DELETE' }),

  // Analysis
  analyze: (appId: string) =>
    request<AnalyzeResponse>(`/api/applications/${appId}/analyze`, { method: 'POST' }),
  reanalyze: (appId: string) =>
    request<AnalyzeResponse>(`/api/applications/${appId}/reanalyze`, { method: 'POST' }),
  getComponents: (appId: string) =>
    request<Component[]>(`/api/applications/${appId}/components`),
  getAnalysisSummary: (appId: string) =>
    request<AnalysisSummary>(`/api/applications/${appId}/analysis-summary`),
  getParserCoverage: (appId: string) =>
    request<ParserCoverageReport>(`/api/applications/${appId}/parser-coverage`),

  // Dependencies
  discoverDependencies: (appId: string) =>
    request<{ dependencies_discovered: number; application_id: string }>(
      `/api/applications/${appId}/discover-dependencies`, { method: 'POST' }
    ),
  getDependencies: (appId: string) =>
    request<Dependency[]>(`/api/applications/${appId}/dependencies`),
  getDependencySummary: (appId: string) =>
    request<DependencySummary>(`/api/applications/${appId}/dependencies/summary`),
  getGraph: (appId: string) =>
    request<GraphData>(`/api/applications/${appId}/graph`),
  getComponentDependencies: (componentId: string) =>
    request<Dependency[]>(`/api/components/${componentId}/dependencies`),
  getComponentImpact: (componentId: string) =>
    request<ComponentImpact>(`/api/components/${componentId}/impact`),

  // Assessment
  runAssessment: (appId: string) =>
    request<Assessment>(`/api/applications/${appId}/assess`, { method: 'POST' }),
  getAssessment: (appId: string) =>
    request<Assessment>(`/api/applications/${appId}/assessment`),
  getDomainBreakdown: (appId: string) =>
    request<Record<string, DomainBreakdown>>(`/api/applications/${appId}/assessment/domains`),
  getRules: () =>
    request<RulesResponse>('/api/assessment/rules'),
  runWhatIf: (appId: string, overrides: Record<string, number>, humanReviewed = false) =>
    request<WhatIfResponse>(`/api/applications/${appId}/assess/what-if`, {
      method: 'POST',
      body: JSON.stringify({ weight_overrides: overrides, human_reviewed: humanReviewed }),
    }),
  getComponentAssessment: (componentId: string) =>
    request<ComponentAssessment>(`/api/components/${componentId}/assessment`),

  // Phase 6: Findings, Reviews, Recommendations, Roadmap
  getFindings: (appId: string, params?: {
    evidence_class?: string; domain?: string; severity?: string; finding_type?: string; search?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v) qs.append(k, v); });
    }
    const q = qs.toString();
    return request<Finding[]>(`/api/applications/${appId}/findings${q ? `?${q}` : ''}`);
  },
  getUnknowns: (appId: string) =>
    request<UnknownsResponse>(`/api/applications/${appId}/unknowns`),
  getRecommendations: (appId: string) =>
    request<RecommendationSummary>(`/api/applications/${appId}/recommendations`),
  getRoadmap: (appId: string) =>
    request<Roadmap>(`/api/applications/${appId}/roadmap`),
  reviewFinding: (findingId: string, data: ReviewRequest) =>
    request<ReviewAction>(`/api/findings/${findingId}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getArtifactContentWithHighlights: (artifactId: string, findingId?: string) => {
    const qs = findingId ? `?finding_id=${findingId}` : '';
    return request<ArtifactContent>(`/api/artifacts/${artifactId}/content${qs}`);
  },

  // Phase 7: Reports, Comparison, History, Export
  getReport: (appId: string) =>
    request<Report>(`/api/applications/${appId}/report`),
  compareApplications: (appA: string, appB: string) =>
    request<Comparison>(`/api/applications/compare?app_a=${appA}&app_b=${appB}`),
  getAssessmentHistory: (appId: string) =>
    request<AssessmentHistoryItem[]>(`/api/applications/${appId}/assessment-history`),
  exportReport: (appId: string, format: 'json' | 'html' = 'json') =>
    fetch(`/api/applications/${appId}/export?format=${format}`).then(async (res) => {
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : `report.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }),
};
