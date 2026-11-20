import type {
  RailItem,
  KPI,
  DomainRing,
  RecentAssessment,
  TopRisk,
  RecommendedAction,
  BarDatum,
  ReadinessSlice,
} from '@/types';

export const railItems: RailItem[] = [
  { id: 'dashboard', label: 'Executive Dashboard', path: '/', icon: 'LayoutDashboard' },
  { id: 'applications', label: 'Applications', path: '/applications', icon: 'Boxes' },
  { id: 'artifacts', label: 'Artifact Explorer', path: '/artifacts', icon: 'FileSearch' },
  { id: 'intelligence', label: 'Application Intelligence', path: '/intelligence', icon: 'Sparkles' },
  { id: 'dependencies', label: 'Dependency Intelligence', path: '/dependencies', icon: 'GitBranch' },
  {
    id: 'complexity', label: 'Complexity Assessment', path: '/complexity', icon: 'Gauge',
    tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'domains', label: 'Domains' },
      { id: 'rules', label: 'Rules' },
    ],
  },
  { id: 'evidence', label: 'Evidence Explorer', path: '/evidence', icon: 'ScrollText' },
  { id: 'risks', label: 'Unknowns and Risks', path: '/risks', icon: 'AlertTriangle' },
  { id: 'recommendations', label: 'Refactoring Recommendations', path: '/recommendations', icon: 'Lightbulb' },
  { id: 'simulator', label: 'Impact Simulator', path: '/simulator', icon: 'FlaskConical' },
  { id: 'reports', label: 'Assessment Reports', path: '/reports', icon: 'FileText' },
  { id: 'compare', label: 'Application Comparison', path: '/compare', icon: 'Columns3' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: 'Settings' },
];

export const dashboardTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'risks', label: 'Risks' },
  { id: 'actions', label: 'Actions' },
];

export const applicationsTabs = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'archived', label: 'Archived' },
];

export const kpis: KPI[] = [
  { id: 'apps', label: 'Total Applications', value: '24', hint: 'Across 6 portfolios' },
  { id: 'components', label: 'Total Components', value: '1,842', trend: '+38', trendDirection: 'up', hint: 'Discovered from artifacts' },
  { id: 'deps', label: 'Dependencies Discovered', value: '5,217', trend: '+412', trendDirection: 'up', hint: 'Inter-component calls' },
  { id: 'highrisk', label: 'High-Risk Components', value: '87', trend: '-5', trendDirection: 'down', hint: 'Severity = high' },
  { id: 'avgcomplexity', label: 'Avg. Migration Complexity', value: '64', unit: '/100', hint: 'Weighted by component count' },
  { id: 'avgconfidence', label: 'Avg. Assessment Confidence', value: '71', unit: '%', hint: 'Evidence coverage' },
];

export const componentTrend: BarDatum[] = [
  { label: 'Apr', value: 1420 },
  { label: 'May', value: 1485 },
  { label: 'Jun', value: 1521 },
  { label: 'Jul', value: 1610 },
  { label: 'Aug', value: 1689 },
  { label: 'Sep', value: 1740 },
  { label: 'Oct', value: 1798 },
  { label: 'Nov', value: 1842 },
];

export const readinessDistribution: ReadinessSlice[] = [
  { label: 'Not Ready', value: 9, color: '#E04A3A' },
  { label: 'Partially Ready', value: 11, color: '#E0A23A' },
  { label: 'Ready for Planning', value: 4, color: '#3AAE6B' },
];

export const domains: DomainRing[] = [
  { id: 'd1', label: 'Application & Business Logic', shortLabel: 'Business Logic', readiness: 62, complexity: 68, components: 412 },
  { id: 'd2', label: 'Data Structures', shortLabel: 'Data Structures', readiness: 71, complexity: 54, components: 318 },
  { id: 'd3', label: 'Database & Persistence', shortLabel: 'Database', readiness: 48, complexity: 76, components: 256 },
  { id: 'd4', label: 'Jobs, Batch & Orchestration', shortLabel: 'Batch & Jobs', readiness: 55, complexity: 71, components: 184 },
  { id: 'd5', label: 'Online Transactions & UI', shortLabel: 'Online & UI', readiness: 66, complexity: 59, components: 227 },
  { id: 'd6', label: 'Integration & External Deps', shortLabel: 'Integration', readiness: 40, complexity: 82, components: 143 },
  { id: 'd7', label: 'Security & Controls', shortLabel: 'Security', readiness: 73, complexity: 47, components: 98 },
  { id: 'd8', label: 'Operational & Nonfunctional', shortLabel: 'Operational', readiness: 58, complexity: 63, components: 204 },
];

export const recentAssessments: RecentAssessment[] = [
  { id: 'a1', application: 'CLAIMS-MGR', date: '2026-11-18', complexity: 72, confidence: 78, readiness: 'Partially Ready', status: 'Complete' },
  { id: 'a2', application: 'PAYROLL-EXEC', date: '2026-11-16', complexity: 85, confidence: 64, readiness: 'Not Ready', status: 'Complete' },
  { id: 'a3', application: 'ACCT-LEDGER', date: '2026-11-14', complexity: 58, confidence: 82, readiness: 'Ready for Planning', status: 'Complete' },
  { id: 'a4', application: 'LOAN-SERV', date: '2026-11-12', complexity: 67, confidence: 71, readiness: 'Partially Ready', status: 'In Progress' },
  { id: 'a5', application: 'CUST-INFO', date: '2026-11-10', complexity: 51, confidence: 85, readiness: 'Ready for Planning', status: 'In Progress' },
];

export const topRisks: TopRisk[] = [
  { id: 'r1', component: 'DB2-COPY-UTIL', application: 'PAYROLL-EXEC', severity: 'high', category: 'Database migration', evidence: 'Evidence-based' },
  { id: 'r2', component: 'CICS-LINK-BRIDGE', application: 'CLAIMS-MGR', severity: 'high', category: 'External integration', evidence: 'Evidence-based' },
  { id: 'r3', component: 'BATCH-SCHED-HOOK', application: 'LOAN-SERV', severity: 'medium', category: 'Job orchestration', evidence: 'Inferred' },
  { id: 'r4', component: 'ENCRYPT-LEGACY', application: 'ACCT-LEDGER', severity: 'medium', category: 'Security controls', evidence: 'Inferred' },
  { id: 'r5', component: 'SORT-MERGE-CUSTOM', application: 'PAYROLL-EXEC', severity: 'high', category: 'Data structure', evidence: 'Assumed' },
];

export const recommendedActions: RecommendedAction[] = [
  { id: 'act1', action: 'Decompose monolithic DB2-COPY-UTIL into service boundary before extraction', priority: 'High', application: 'PAYROLL-EXEC', effort: '3-4 sprints' },
  { id: 'act2', action: 'Document CICS-LINK-BRIDGE contract — missing interface artifacts', priority: 'High', application: 'CLAIMS-MGR', effort: '1 sprint' },
  { id: 'act3', action: 'Replace custom SORT-MERGE-CUSTOM with standard sort utility', priority: 'Medium', application: 'PAYROLL-EXEC', effort: '2 sprints' },
  { id: 'act4', action: 'Capture batch scheduler configuration artifacts for LOAN-SERV', priority: 'Medium', application: 'LOAN-SERV', effort: '1 sprint' },
];

export const moduleDescriptions: Record<string, { title: string; summary: string; phase: string; bullets: string[] }> = {
  applications: {
    title: 'Applications',
    summary: 'Catalog of mainframe applications under assessment. Browse portfolios, view component inventories, and track assessment status per application.',
    phase: 'Phase 2',
    bullets: ['Application cards with component counts and status', 'Filter by portfolio, platform, and assessment state', 'Drill into component-level inventory per application'],
  },
  artifacts: {
    title: 'Artifact Explorer',
    summary: 'Upload and browse source artifacts — COBOL programs, copybooks, JCL, BMS maps, control cards. The explorer indexes artifacts for static extraction.',
    phase: 'Phase 2',
    bullets: ['Artifact upload with checksum and version tracking', 'Tree browser by library, program, and copybook', 'Source viewer with line-numbered, highlighted ranges'],
  },
  intelligence: {
    title: 'Application Intelligence',
    summary: 'Per-application intelligence view: extracted structure, call graph, data flow, and inferred business logic with evidence classifications.',
    phase: 'Phase 3',
    bullets: ['Program structure tree with CALL/PERFORM hierarchy', 'Data flow map from copybooks to file/DB references', 'Inferred logic with Evidence / Inferred / Assumed labels'],
  },
  dependencies: {
    title: 'Dependency Intelligence',
    summary: 'Interactive dependency graph showing inter-component and inter-application relationships. Identify coupling hotspots and blast radius.',
    phase: 'Phase 3',
    bullets: ['React Flow graph with directional edges', 'Coupling analysis and circular dependency detection', 'Blast-radius simulation for targeted refactoring'],
  },
  complexity: {
    title: 'Complexity Assessment',
    summary: 'Compute Migration Complexity across the eight official assessment domains. Every score cites its rule, artifact, and evidence class.',
    phase: 'Phase 3',
    bullets: ['Per-domain complexity scoring with rule citations', 'Complexity heatmap across components and applications', 'Rule library with adjustable weights and thresholds'],
  },
  evidence: {
    title: 'Evidence Explorer',
    summary: 'Trace every material conclusion back to its source artifact, line/record, and extraction rule. Filter by evidence class and domain.',
    phase: 'Phase 4',
    bullets: ['Evidence ledger linking findings to artifact references', 'Filter by Evidence-based / Inferred / Assumed / Unknown', 'Side-by-side source viewer with highlighted ranges'],
  },
  risks: {
    title: 'Unknowns and Risks',
    summary: 'Missing-information registry and risk register. Unsupported artifacts are recorded here and reduce assessment confidence — never silently ignored.',
    phase: 'Phase 4',
    bullets: ['Missing-artifact registry with confidence impact', 'Risk register with severity, category, and evidence class', 'Confidence-degradation report per application'],
  },
  recommendations: {
    title: 'Refactoring Recommendations',
    summary: 'Prioritized, evidence-linked refactoring actions. Each recommendation references the findings that motivated it and the effort estimate.',
    phase: 'Phase 5',
    bullets: ['Prioritized action queue with dependency ordering', 'Effort estimates tied to component complexity', 'Recommendation-to-evidence traceability links'],
  },
  simulator: {
    title: 'Impact Simulator',
    summary: 'Simulate the impact of a proposed refactoring action on complexity, readiness, and blast radius — before any code changes.',
    phase: 'Phase 5',
    bullets: ['Before/after complexity projection per domain', 'Blast-radius simulation across the dependency graph', 'Scenario comparison with confidence intervals'],
  },
  reports: {
    title: 'Assessment Reports',
    summary: 'Generate exportable assessment reports: complexity, confidence, readiness, evidence, and recommendations. Reviewer sign-off tracked separately.',
    phase: 'Phase 6',
    bullets: ['Report builder with section selection', 'Export to PDF and structured JSON', 'Reviewer annotations stored separately from machine findings'],
  },
  compare: {
    title: 'Application Comparison',
    summary: 'Side-by-side comparison of applications across complexity, confidence, readiness, and domain scores. Prioritize migration sequencing.',
    phase: 'Phase 6',
    bullets: ['Multi-select applications for comparison', 'Radar and bar comparison across domains', 'Migration sequencing recommendation based on scores'],
  },
  settings: {
    title: 'Settings',
    summary: 'Configure tool preferences: complexity rule weights, evidence thresholds, display options, and reduce-transparency mode.',
    phase: 'Ongoing',
    bullets: ['Rule library weights and thresholds', 'Display and accessibility preferences', 'Parser and model version information'],
  },
};
