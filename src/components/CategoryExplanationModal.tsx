import { useState, useMemo } from 'react';
import {
  X, Info, Calculator, CheckCircle2, AlertTriangle, Layers, Database,
  Cpu, GitBranch, Shield, Zap, Sliders, ChevronRight, FileCode, Check,
  Activity, ArrowRight, Gauge, HelpCircle
} from 'lucide-react';
import { Assessment, RuleFiring, DomainScore } from '@/api/client';

export interface DomainMetadata {
  id: string;
  name: string;
  shortName: string;
  weight: string;
  weightNum: number;
  icon: string;
  scope: string;
  analyzedAssets: string[];
  complexityRationale: string;
  confidenceRationale: string;
  readinessRationale: string;
  keyRuleSamples: { id: string; type: 'complexity' | 'confidence' | 'readiness'; points: number; condition: string }[];
  whyItMatters: string;
}

export const DOMAIN_METADATA_MAP: Record<string, DomainMetadata> = {
  application_business_logic: {
    id: 'application_business_logic',
    name: 'Application & Business Logic',
    shortName: 'App Logic',
    weight: '18%',
    weightNum: 0.18,
    icon: 'Cpu',
    scope: 'Core procedural algorithms, branching logic, subprogram coupling, and cyclomatic density.',
    analyzedAssets: [
      'COBOL Divisions, Sections, and Paragraph structure',
      'Branching control flow: GOTO statement frequency, ALTER self-modifying code',
      'Inter-program CALL invocations (static linked vs dynamic late-bound resolution)',
      'PERFORM loop nesting depths and recursive execution flows',
      'Embedded EXEC SQL / EXEC CICS procedural handoffs',
    ],
    complexityRationale: 'Raw complexity accumulates when high-friction patterns (GOTO, ALTER, deep PERFORM loops, dynamic late-binding) are detected in AST. Higher points indicate entangled spaghetti control flow.',
    confidenceRationale: 'Starts at 0.0. Awards +60 for fully parsed AST evidence and +40 for zero unresolved external program references. Penalizes -15 for inferred or ambiguous subroutines.',
    readinessRationale: 'Starts at 0.0. Awards +50 for enterprise standard COBOL dialects (IBM Enterprise COBOL v4-v6) and +50 for documented application ownership. Penalizes -20 if dynamic calls target unresolvable load modules.',
    keyRuleSamples: [
      { id: 'CX-AB-001', type: 'complexity', points: 15, condition: 'GOTO statements detected (anti-pattern: unstructured branching)' },
      { id: 'CX-AB-002', type: 'complexity', points: 25, condition: 'ALTER statements detected (anti-pattern: self-modifying procedural code)' },
      { id: 'CX-AB-003', type: 'complexity', points: 15, condition: 'Dynamic CALL statements (runtime late-binding resolution)' },
      { id: 'CX-AB-004', type: 'complexity', points: 8, condition: 'PERFORM nesting depth >= 3 levels' },
      { id: 'CF-AB-001', type: 'confidence', points: 60, condition: 'Verified Evidence-based AST components parsed directly from source' },
      { id: 'RD-AB-001', type: 'readiness', points: 50, condition: 'Supported COBOL runtime dialect identified' },
    ],
    whyItMatters: 'Business logic represents the largest migration risk. Untangled, modular logic can be translated or re-hosted with minimal defect leakage.',
  },
  data_structures: {
    id: 'data_structures',
    name: 'Data Structures',
    shortName: 'Data Struct',
    weight: '12%',
    weightNum: 0.12,
    icon: 'Layers',
    scope: 'Record schemas, memory layouts, copybook definitions, packed decimal formats, and byte alignments.',
    analyzedAssets: [
      'COBOL Copybooks (.cpy, .cbl, .ccp) and 01-level record layouts',
      'REDEFINES clauses (memory buffer aliasing and multi-structure mapping)',
      'OCCURS DEPENDING ON (variable-length array structures)',
      'COMP / COMP-3 packed decimal and binary representation fields',
      'Level 88 condition names (boolean status flags)',
    ],
    complexityRationale: 'Raw points add up when byte layouts are dynamically sized (OCCURS DEPENDING ON) or memory buffers are reinterpreted (REDEFINES), which require specialized serialization in target languages.',
    confidenceRationale: 'Awards +60 for copybooks parsed with deterministic byte length, +40 for zero unresolved copybook includes. Deducts -25 if programs reference unknown or missing copybooks.',
    readinessRationale: 'Awards +50 for documented schema dictionary and +50 for fixed-width byte-aligned layouts. Deducts -30 if ambiguous offsets exist.',
    keyRuleSamples: [
      { id: 'CX-DS-001', type: 'complexity', points: 15, condition: 'REDEFINES memory buffer aliasing detected' },
      { id: 'CX-DS-002', type: 'complexity', points: 15, condition: 'OCCURS DEPENDING ON variable-length array record layout' },
      { id: 'CX-DS-003', type: 'complexity', points: 10, condition: 'COMP-3 packed decimal numeric fields requiring conversion' },
      { id: 'CF-DS-001', type: 'confidence', points: 60, condition: 'All referenced copybooks resolved and byte-lengths calculated' },
      { id: 'RD-DS-001', type: 'readiness', points: 50, condition: 'Clean byte-aligned copybook records ready for DTO / Protobuf codegen' },
    ],
    whyItMatters: 'Data layout errors in mainframe migrations cause silent data corruption. Exact byte-level modeling guarantees zero data loss.',
  },
  database_persistence: {
    id: 'database_persistence',
    name: 'Database & Persistence',
    shortName: 'DB & SQL',
    weight: '15%',
    weightNum: 0.15,
    icon: 'Database',
    scope: 'Relational database access, embedded SQL statements, schema DDL tables, VSAM clusters, and IMS hierarchies.',
    analyzedAssets: [
      'Embedded EXEC SQL statements (SELECT, INSERT, UPDATE, DELETE, cursors, commits)',
      'SQL DDL table schemas (CREATE TABLE, ALTER, PRIMARY/FOREIGN KEY, INDEXES)',
      'VSAM file clusters (KSDS indexed, ESDS sequential, RRDS relative, DEFINE CLUSTER)',
      'IMS DB / DL/I hierarchical database segment calls',
      'SQLCA error checking and transaction boundary handling',
    ],
    complexityRationale: 'Complex multi-table joins, cursor pagination, and legacy VSAM keyed files increase migration effort. Embedded SQL without DDL schemas spikes complexity.',
    confidenceRationale: 'Awards +60 when embedded SQL statements have matching DDL table definitions in the ingested catalog, +40 for clean schema coverage. Deducts -30 if SQL tables lack DDL.',
    readinessRationale: 'Awards +50 if full DDL schemas are provided for target cloud DB (PostgreSQL, Oracle, MySQL) migration, +50 for standard ANSI SQL. Deducts -30 for missing table definitions.',
    keyRuleSamples: [
      { id: 'CX-DB-001', type: 'complexity', points: 12, condition: 'Embedded EXEC SQL statements in business programs' },
      { id: 'CX-DB-002', type: 'complexity', points: 18, condition: 'VSAM KSDS / ESDS file cluster persistence used' },
      { id: 'CX-DB-003', type: 'complexity', points: 15, condition: 'Complex multi-table cursor queries requiring refactoring' },
      { id: 'CF-DB-001', type: 'confidence', points: 60, condition: 'DDL schema artifacts present and cataloged for all SQL tables' },
      { id: 'RD-DB-001', type: 'readiness', points: 50, condition: 'DDL schemas complete and convertible to PostgreSQL / relational DDL' },
    ],
    whyItMatters: 'Decoupling storage engines from mainframe file systems (VSAM/IMS) to modern relational/NoSQL stores is critical for cloud scalability.',
  },
  jobs_batch_orchestration: {
    id: 'jobs_batch_orchestration',
    name: 'Jobs, Batch & Orchestration',
    shortName: 'Batch & JCL',
    weight: '12%',
    weightNum: 0.12,
    icon: 'Zap',
    scope: 'JCL batch jobs, execution procedures (PROCs), dataset step allocations, and conditional execution branches.',
    analyzedAssets: [
      'JCL JOB cards, EXEC PGM (programs) and EXEC PROC (procedures)',
      'DD (Data Definition) statements: DSN allocation, DISP=(NEW,OLD,SHR,DELETE,CATLG)',
      'Conditional job steps: COND parameter and IF-THEN-ELSE step branching',
      'GDG (Generation Data Groups) automated dataset versioning',
      'SYSIN control cards and temporary scratch datasets (&&TEMP)',
    ],
    complexityRationale: 'Deeply nested PROCs, multi-step dependencies, and conditional restart logic increase modernization and orchestrator conversion complexity.',
    confidenceRationale: 'Awards +60 for parsed JCL jobs with cataloged input/output datasets, +40 for resolved PROC definitions. Deducts -20 for missing cataloged datasets.',
    readinessRationale: 'Awards +50 for clean step-level return code dependencies ready for Airflow / Argo conversion, +50 for documented batch schedules. Deducts -25 for manual operator intervention cards.',
    keyRuleSamples: [
      { id: 'CX-JB-001', type: 'complexity', points: 12, condition: 'Multi-step batch job orchestration (> 5 steps per job)' },
      { id: 'CX-JB-002', type: 'complexity', points: 15, condition: 'GDG (Generation Data Group) automated dataset versioning' },
      { id: 'CX-JB-003', type: 'complexity', points: 14, condition: 'Complex IF-THEN-ELSE conditional step execution' },
      { id: 'CF-JB-001', type: 'confidence', points: 60, condition: 'JCL jobs and dataset lineage fully extracted from source' },
      { id: 'RD-JB-001', type: 'readiness', points: 50, condition: 'Clean step boundaries convertible to containerized DAG tasks' },
    ],
    whyItMatters: 'Batch window overruns are catastrophic for banking and insurance. Replacing JCL with cloud DAGs (Airflow/Prefect) requires exact I/O dataset modeling.',
  },
  online_transactions_ui: {
    id: 'online_transactions_ui',
    name: 'Online Transactions & UI',
    shortName: 'Online CICS',
    weight: '15%',
    weightNum: 0.15,
    icon: 'Activity',
    scope: 'CICS online transaction management, BMS screen maps, 3270 terminal interactions, COMMAREA state, and conversational flows.',
    analyzedAssets: [
      'CICS Transaction IDs and EXEC CICS command handshakes',
      'BMS (Basic Mapping Support) screen definitions: DFHMSD, DFHMDI, DFHMDF',
      '3270 terminal screen attributes: protect, skip, numeric, high-intensity color',
      'Pseudo-conversational state: EXEC CICS RETURN TRANSID and COMMAREA transfer',
      'Syncpoints, abend handling (EXEC CICS HANDLE ABEND), and rollback',
    ],
    complexityRationale: 'High screen-to-program coupling, hardware 3270 byte stream handling, and stateful COMMAREAs create significant refactoring effort when migrating to web/mobile APIs.',
    confidenceRationale: 'Awards +60 for verified CICS programs with matching BMS screen maps, +40 for transaction-to-program routing resolution. Deducts -20 for unmapped transaction IDs.',
    readinessRationale: 'Awards +50 if BMS screen layouts are extracted and ready for React/Angular component generation, +50 for stateless session flows. Deducts -30 for tight terminal hardware buffering.',
    keyRuleSamples: [
      { id: 'CX-OL-001', type: 'complexity', points: 15, condition: 'CICS online transaction management and dispatching detected' },
      { id: 'CX-OL-002', type: 'complexity', points: 15, condition: 'BMS 3270 terminal screen map definitions present' },
      { id: 'CX-OL-003', type: 'complexity', points: 12, condition: 'COMMAREA session payload state exchange across screens' },
      { id: 'CF-OL-001', type: 'confidence', points: 60, condition: 'BMS maps extracted and cross-referenced with CICS programs' },
      { id: 'RD-OL-001', type: 'readiness', points: 50, condition: 'BMS maps and fields ready for automated React/REST transformation' },
    ],
    whyItMatters: 'Green screens must be modernized into intuitive web apps. Converting BMS maps into React forms eliminates years of manual frontend redesign.',
  },
  integration_external_dependencies: {
    id: 'integration_external_dependencies',
    name: 'Integration & External Dependencies',
    shortName: 'Integration',
    weight: '12%',
    weightNum: 0.12,
    icon: 'GitBranch',
    scope: 'Cross-module invocation graph, circular dependency cycles (Tarjan SCC), choke points, and external boundary interfaces.',
    analyzedAssets: [
      'Static CALL and dynamic late-bound subprogram graph',
      'Tarjan Strongly Connected Components (SCC) for circular recursive loops',
      'Dominance-based choke point nodes (critical path single-points-of-failure)',
      'External message queues (IBM MQ), CICS web services, and EDI feeds',
      'Data file exchange and shared scratch storage',
    ],
    complexityRationale: 'Circular dependencies and high-in-degree choke point modules make microservices extraction difficult. High fan-out compounds blast radius.',
    confidenceRationale: 'Awards +60 when 100% of inter-program dependencies are resolved in the graph, +40 for complete module closure. Deducts -20 for unresolved external calls.',
    readinessRationale: 'Awards +50 for clear acyclic call hierarchy and modular boundary isolation, +50 for stateless invocation contracts. Deducts -35 for recursive circular dependency cycles.',
    keyRuleSamples: [
      { id: 'CX-IN-001', type: 'complexity', points: 15, condition: 'High-fanout cross-program dependency tree' },
      { id: 'CX-IN-002', type: 'complexity', points: 25, condition: 'Tarjan SCC circular call cycles detected between programs' },
      { id: 'CX-IN-003', type: 'complexity', points: 15, condition: 'Critical architectural choke-point components detected' },
      { id: 'CF-IN-001', type: 'confidence', points: 60, condition: 'Complete dependency graph closure with zero orphan calls' },
      { id: 'RD-IN-001', type: 'readiness', points: 50, condition: 'Clean modular service boundaries ready for API extraction' },
    ],
    whyItMatters: 'Circular dependencies prevent safe modular decomposition. Resolving call cycles with Tarjan SCC provides an exact, safe refactoring roadmap.',
  },
  security_controls: {
    id: 'security_controls',
    name: 'Security & Controls',
    shortName: 'Security',
    weight: '8%',
    weightNum: 0.08,
    icon: 'Shield',
    scope: 'IBM RACF profiles, authorization exits, dataset access permissions, credential safety, and regulatory compliance.',
    analyzedAssets: [
      'IBM RACF security commands (PERMIT, RDEFINE, RACROUTE)',
      'Program-level authority checks and system supervisor calls',
      'Hardcoded credentials or API keys in source files',
      'Audit logging, compliance journal entries, and error redaction',
      'Role-based access control (RBAC) definitions',
    ],
    complexityRationale: 'Proprietary RACF security exits and undocumented authorization routines require replacement with modern identity providers (OAuth2, OIDC, IAM).',
    confidenceRationale: 'Awards +60 for cataloged RACF profiles or explicit security checks, +40 for compliance audit logs. Deducts -20 for undocumented permission assumptions.',
    readinessRationale: 'Awards +50 if security roles map directly to standard OAuth2/OIDC claims, +50 for zero hardcoded credentials. Deducts -25 for proprietary mainframe auth exits.',
    keyRuleSamples: [
      { id: 'CX-SC-001', type: 'complexity', points: 15, condition: 'Proprietary RACF authorization checks requiring identity migration' },
      { id: 'CX-SC-002', type: 'complexity', points: 25, condition: 'Hardcoded credentials or secrets detected in source code' },
      { id: 'CF-SC-001', type: 'confidence', points: 60, condition: 'Explicit security rules and profiles documented in artifacts' },
      { id: 'RD-SC-001', type: 'readiness', points: 50, condition: 'Security roles cleanly mappable to modern cloud IAM / OAuth2' },
    ],
    whyItMatters: 'Security compliance is non-negotiable. Modernizing auth to OAuth2/OIDC guarantees zero vulnerability regression.',
  },
  operational_nonfunctional: {
    id: 'operational_nonfunctional',
    name: 'Operational & Nonfunctional',
    shortName: 'Operational',
    weight: '8%',
    weightNum: 0.08,
    icon: 'Sliders',
    scope: 'Runtime configuration files, SYSOUT print handling, performance bottlenecks, unsupported binary formats, and memory limits.',
    analyzedAssets: [
      'System configuration files and initialization parameters',
      'SYSOUT print spooling, JES2/JES3 print destination cards',
      'Unsupported or proprietary binary artifacts (.load, .obj, .dat)',
      'Memory footprint constraints and 24-bit/31-bit AMODE/RMODE settings',
      'Encoding quirks (EBCDIC CP037 code page conversion artifacts)',
    ],
    complexityRationale: 'Opaque binary files, print spooling routines, and legacy 24-bit addressing limit portability to standard Linux container runtimes.',
    confidenceRationale: 'Awards +60 for complete runtime inventory with zero unclassified files, +40 for documented system configs. Deducts -20 for opaque binaries.',
    readinessRationale: 'Awards +50 for standard container-compatible runtime specifications, +50 for transparent configuration files. Deducts -20 for unsupported binary payloads.',
    keyRuleSamples: [
      { id: 'CX-ON-001', type: 'complexity', points: 20, condition: 'Unsupported binary or proprietary binary artifacts detected' },
      { id: 'CX-ON-002', type: 'complexity', points: 10, condition: 'SYSOUT print spooling and mainframe report generation routines' },
      { id: 'CF-ON-001', type: 'confidence', points: 60, condition: 'Runtime environment parameters and configuration fully cataloged' },
      { id: 'RD-ON-001', type: 'readiness', points: 50, condition: 'Standard Linux / Kubernetes container deployability verified' },
    ],
    whyItMatters: 'Ensures target runtime parity. Identifies obscure mainframe dependencies before deployment to Kubernetes.',
  },
};

const DOMAIN_ORDER = Object.keys(DOMAIN_METADATA_MAP);

interface CategoryExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  domainId?: string | null;
  assessment?: Assessment | null;
}

export default function CategoryExplanationModal({
  isOpen,
  onClose,
  domainId: initialDomainId,
  assessment,
}: CategoryExplanationModalProps) {
  const [selectedTab, setSelectedTab] = useState<string>(
    initialDomainId && initialDomainId !== 'composite' && DOMAIN_METADATA_MAP[initialDomainId]
      ? initialDomainId
      : initialDomainId === 'composite'
        ? 'composite'
        : 'application_business_logic'
  );

  const [ruleFilter, setRuleFilter] = useState<'all' | 'complexity' | 'confidence' | 'readiness'>('all');

  // Update selected tab if initialDomainId changes when modal opens
  useMemo(() => {
    if (initialDomainId) {
      setSelectedTab(initialDomainId);
    }
  }, [initialDomainId]);

  if (!isOpen) return null;

  const isComposite = selectedTab === 'composite';
  const currentDomainMeta = !isComposite ? DOMAIN_METADATA_MAP[selectedTab] : null;

  // Domain score from active assessment
  const domainScoreObj = assessment?.domain_scores?.[selectedTab];
  const domainComplexity = domainScoreObj?.complexity;
  const domainConfidence = domainScoreObj?.confidence;
  const domainReadiness = domainScoreObj?.readiness;

  // Fired rules for current domain
  const firedRulesInDomain = assessment?.fired_rules?.filter(
    (r) => r.domain === selectedTab
  ) ?? [];

  const filteredFiredRules = firedRulesInDomain.filter((r) => {
    if (ruleFilter === 'all') return true;
    return r.measure === ruleFilter;
  });

  // Calculate live raw points
  const rawComplexityPoints = firedRulesInDomain
    .filter((r) => r.measure === 'complexity')
    .reduce((sum, r) => sum + r.points, 0);

  const rawConfidencePoints = firedRulesInDomain
    .filter((r) => r.measure === 'confidence')
    .reduce((sum, r) => sum + r.points, 0);

  const rawReadinessPoints = firedRulesInDomain
    .filter((r) => r.measure === 'readiness')
    .reduce((sum, r) => sum + r.points, 0);

  // Hyperbolic calculation for display
  const hyperbolicCalculated = rawComplexityPoints > 0
    ? (100 * rawComplexityPoints) / (rawComplexityPoints + 20)
    : 0;

  // Composite coverage ratio calculation
  const totalDomains = DOMAIN_ORDER.length;
  const evidencedDomainsCount = assessment?.domains_assessed ?? (
    DOMAIN_ORDER.filter((d) => {
      const s = assessment?.domain_scores?.[d];
      return s?.complexity?.has_evidence || s?.confidence?.has_evidence || s?.readiness?.has_evidence;
    }).length
  );
  const coverageRatio = totalDomains > 0 ? evidencedDomainsCount / totalDomains : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Calculator size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Scoring Engine & Algorithm Explainer
                </h2>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800 border border-emerald-200">
                  100% Deterministic AST
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Mathematical proof, raw weights, saturation curves, and line-level rule citations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/80 px-4 py-2 text-xs scrollbar-none">
          <button
            onClick={() => setSelectedTab('composite')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all shrink-0 ${
              isComposite
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Gauge size={13} />
            <span>Composite Assessment</span>
          </button>

          <span className="h-4 w-px bg-slate-300 mx-1 shrink-0" />

          {DOMAIN_ORDER.map((id) => {
            const meta = DOMAIN_METADATA_MAP[id];
            const isSelected = selectedTab === id;
            const hasEv = assessment?.domain_scores?.[id]?.complexity?.has_evidence ||
              assessment?.domain_scores?.[id]?.confidence?.has_evidence;

            return (
              <button
                key={id}
                onClick={() => setSelectedTab(id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                <span>{meta.shortName}</span>
                <span
                  className={`rounded px-1 font-mono text-[9px] ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : hasEv
                        ? 'bg-emerald-100 text-emerald-800 font-semibold'
                        : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {meta.weight}
                </span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ================= COMPOSITE METHODOLOGY TAB ================= */}
          {isComposite ? (
            <div className="space-y-6">
              {/* Introduction Card */}
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/30 p-5 shadow-2xs">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Overall Composite Scoring Methodology
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      ReFrameX uses a multi-domain deterministic scoring engine. Every measure operates on a transparent, mathematical formula—not stochastic LLM approximations. Same input code produces bit-for-bit identical scores every time.
                    </p>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-center shrink-0">
                    <span className="block font-mono text-[10px] uppercase text-slate-400">Total Rules</span>
                    <span className="font-mono text-base font-bold text-blue-700">80</span>
                    <span className="block text-[9px] text-slate-500">v2 Ruleset</span>
                  </div>
                </div>
              </div>

              {/* The 3 Core Formulas Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Complexity */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-900">
                        1. Migration Complexity
                      </span>
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-800">
                        Scale 0–100
                      </span>
                    </div>
                    <div className="rounded-lg bg-white p-3 border border-amber-200 font-mono text-xs text-slate-800 text-center mb-2 shadow-2xs">
                      S = 100 × raw / (raw + 20)
                    </div>
                    <p className="text-[11px] text-slate-600 leading-normal">
                      <strong>Hyperbolic Saturation:</strong> Accumulates negative friction points from anti-patterns. Saturation parameter <em>K=20</em> prevents runaway counts (e.g. 100 GOTOs won't break the scale).
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-amber-100 font-mono text-[10px] text-slate-500">
                    Rollup: Weighted average over <em>evidenced domains only</em>.
                  </div>
                </div>

                {/* 2. Confidence */}
                <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-blue-900">
                        2. Assessment Confidence
                      </span>
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-800">
                        Scale 0–100
                      </span>
                    </div>
                    <div className="rounded-lg bg-white p-3 border border-blue-200 font-mono text-xs text-slate-800 text-center mb-2 shadow-2xs">
                      Conf = min(Σ wᵢ·cᵢ, Coverage × 100)
                    </div>
                    <p className="text-[11px] text-slate-600 leading-normal">
                      <strong>Evidence & Completeness:</strong> Starts at 0.0 baseline. Positive points awarded for AST parse certainty (+60) and zero unresolved stubs (+40). Capped by domain coverage ratio.
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-100 font-mono text-[10px] text-slate-500">
                    Single-point accumulation: One rule award per domain to prevent count inflation.
                  </div>
                </div>

                {/* 3. Readiness */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-900">
                        3. Cloud Readiness
                      </span>
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                        Scale 0–100
                      </span>
                    </div>
                    <div className="rounded-lg bg-white p-3 border border-emerald-200 font-mono text-xs text-slate-800 text-center mb-2 shadow-2xs">
                      Readiness = clamp(0 + raw, 0, 100)
                    </div>
                    <p className="text-[11px] text-slate-600 leading-normal">
                      <strong>Modernization Prerequisites:</strong> Starts at 0.0 baseline. Points awarded for supported target dialects, documented schemas, and clean step DAGs; penalized for circular loops or missing DDL.
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-emerald-100 font-mono text-[10px] text-slate-500">
                    Rollup: Weighted sum over all 8 domains (unevidenced = 0).
                  </div>
                </div>
              </div>

              {/* Domain Weights Table */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-mono text-xs font-bold uppercase text-slate-800">
                    Domain Weight Allocations (Sum = 100%)
                  </h4>
                  <span className="font-mono text-[11px] text-slate-500">
                    Approved by Architecture Review Board
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {DOMAIN_ORDER.map((id) => {
                    const meta = DOMAIN_METADATA_MAP[id];
                    return (
                      <div
                        key={id}
                        onClick={() => setSelectedTab(id)}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-slate-800">{meta.shortName}</span>
                          <span className="font-mono text-xs font-bold text-blue-600">{meta.weight}</span>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500 truncate">{meta.scope}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Assessment Live Verification */}
              {assessment && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <h4 className="font-mono text-xs font-bold uppercase text-slate-800 mb-2">
                    Live Active App Calculation Check
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                      <div className="text-[10px] font-mono uppercase text-slate-400">Application Complexity</div>
                      <div className="text-lg font-mono font-bold text-amber-600">
                        {assessment.complexity_score} / 100
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Classification: <strong>{assessment.complexity_classification}</strong>
                      </div>
                    </div>
                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                      <div className="text-[10px] font-mono uppercase text-slate-400">Assessment Confidence</div>
                      <div className="text-lg font-mono font-bold text-blue-600">
                        {assessment.confidence_score} / 100
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Coverage: <strong>{evidencedDomainsCount} of {totalDomains} domains ({Math.round(coverageRatio * 100)}%)</strong>
                      </div>
                    </div>
                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                      <div className="text-[10px] font-mono uppercase text-slate-400">Migration Readiness</div>
                      <div className="text-lg font-mono font-bold text-emerald-600">
                        {assessment.readiness_score} / 100
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Classification: <strong>{assessment.readiness_classification}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : currentDomainMeta ? (
            /* ================= SINGLE DOMAIN TAB ================= */
            <div className="space-y-6">
              {/* Domain Header Card */}
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {currentDomainMeta.name}
                      </h3>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-800 border border-blue-200">
                        Weight: {currentDomainMeta.weight} ({currentDomainMeta.weightNum})
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      {currentDomainMeta.scope}
                    </p>
                  </div>
                  {domainScoreObj && (
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="block font-mono text-[9px] uppercase text-slate-400">Status</span>
                        <span className="font-mono text-xs font-bold text-emerald-700">
                          {domainScoreObj.complexity?.has_evidence ? 'Evidenced' : 'Not Evidenced'}
                        </span>
                      </div>
                      <span className="h-6 w-px bg-slate-300 mx-1" />
                      <div className="text-right">
                        <span className="block font-mono text-[9px] uppercase text-slate-400">Rules Fired</span>
                        <span className="font-mono text-xs font-bold text-slate-800">
                          {firedRulesInDomain.length}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* What ReFrameX Scans and Analyzes */}
                <div className="mt-4 pt-4 border-t border-slate-200/70">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Mainframe Assets & AST Tokens Analyzed:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-700">
                    {currentDomainMeta.analyzedAssets.map((asset, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                        <span>{asset}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Exact Formula & Live Math for Active App */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
                  <span>How Scores are Calculated for this Domain</span>
                  <span className="text-slate-500 font-normal text-[11px]">Live calculations on active app</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Complexity Card */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[11px] font-bold text-amber-900">Complexity</span>
                      <span className="font-mono text-xs font-bold text-amber-700">
                        {domainComplexity?.score != null ? `${domainComplexity.score} / 100` : '—'}
                      </span>
                    </div>
                    <div className="rounded bg-white p-2 border border-amber-200 font-mono text-[11px] text-slate-800 text-center mb-2">
                      100 × raw / (raw + 20)
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div>Raw points: <strong className="font-mono">{rawComplexityPoints}</strong></div>
                      {rawComplexityPoints > 0 ? (
                        <div className="font-mono text-[10px] text-amber-800 bg-amber-100/50 p-1 rounded">
                          100 × {rawComplexityPoints} / ({rawComplexityPoints} + 20) = {hyperbolicCalculated.toFixed(1)}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400">0 raw points → 0.0 clean complexity</div>
                      )}
                    </div>
                  </div>

                  {/* Confidence Card */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/20 p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[11px] font-bold text-blue-900">Confidence</span>
                      <span className="font-mono text-xs font-bold text-blue-700">
                        {domainConfidence?.score != null ? `${domainConfidence.score} / 100` : '—'}
                      </span>
                    </div>
                    <div className="rounded bg-white p-2 border border-blue-200 font-mono text-[11px] text-slate-800 text-center mb-2">
                      clamp(0 + raw, 0, 100)
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div>Raw points: <strong className="font-mono">{rawConfidencePoints}</strong></div>
                      <div className="text-[10px] text-slate-500">
                        Deduplicated per rule: +60 AST verified, +40 zero unknown stubs.
                      </div>
                    </div>
                  </div>

                  {/* Readiness Card */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/20 p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[11px] font-bold text-emerald-900">Readiness</span>
                      <span className="font-mono text-xs font-bold text-emerald-700">
                        {domainReadiness?.score != null ? `${domainReadiness.score} / 100` : '—'}
                      </span>
                    </div>
                    <div className="rounded bg-white p-2 border border-emerald-200 font-mono text-[11px] text-slate-800 text-center mb-2">
                      clamp(0 + raw, 0, 100)
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div>Raw points: <strong className="font-mono">{rawReadinessPoints}</strong></div>
                      <div className="text-[10px] text-slate-500">
                        Baseline 0.0. Adds points for supported dialects, subtracts for blockers.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fired Rules in This Domain (Live Citations) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800">
                    Rules Applied in this Domain ({firedRulesInDomain.length})
                  </h4>
                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 text-[11px]">
                    {(['all', 'complexity', 'confidence', 'readiness'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setRuleFilter(filter)}
                        className={`rounded-lg px-2.5 py-1 capitalize font-medium transition-all ${
                          ruleFilter === filter
                            ? 'bg-slate-900 text-white font-semibold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredFiredRules.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {filteredFiredRules.map((rule, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900">{rule.rule_id}</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                                rule.measure === 'complexity'
                                  ? 'bg-amber-100 text-amber-800'
                                  : rule.measure === 'confidence'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {rule.measure}
                            </span>
                            <span className="font-mono font-bold text-slate-800">
                              {rule.points > 0 ? `+${rule.points}` : rule.points} pts
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 font-semibold text-slate-900">{rule.description}</p>
                        <p className="mt-0.5 text-slate-600 text-[11px]">{rule.explanation}</p>
                        {rule.evidence_refs?.length > 0 && (
                          <div className="mt-2 text-[10px] font-mono text-slate-500 bg-white p-1.5 rounded border border-slate-200 flex items-center justify-between">
                            <span>Evidence citation: {rule.evidence_refs[0].rule || 'AST Pattern'}</span>
                            <span>Line {rule.evidence_refs[0].line_start}–{rule.evidence_refs[0].line_end}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No {ruleFilter !== 'all' ? ruleFilter : ''} rules fired for this domain on the active application.
                  </div>
                )}
              </div>

              {/* Sample Formal Rules Specification */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Sample Ruleset Specification for {currentDomainMeta.shortName}
                </h4>
                <div className="space-y-1.5 text-xs">
                  {currentDomainMeta.keyRuleSamples.map((r, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-white p-2 border border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{r.id}</span>
                        <span className="text-slate-600">{r.condition}</span>
                      </div>
                      <span
                        className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          r.type === 'complexity'
                            ? 'bg-amber-100 text-amber-800'
                            : r.type === 'confidence'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        +{r.points} pts ({r.type})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Why ReFrameX Wins Review */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 flex items-start gap-3">
                <CheckCircle2 size={18} className="text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-emerald-950">Why This Algorithm Withstands Review</div>
                  <p className="mt-0.5 text-emerald-900 leading-relaxed">
                    {currentDomainMeta.whyItMatters} Every score is deterministic, mathematical, and verified by line-level source code evidence. No prompt engineering discrepancies, no hallucinations.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-mono">Model: ReFrameX Deterministic Scoring Engine v2.0</span>
            <span>•</span>
            <span className="font-mono">K = 20.0 (Hyperbolic Saturation)</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-1.5 font-medium text-white hover:bg-slate-800 transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}
