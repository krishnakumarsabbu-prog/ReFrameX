import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import {
  Boxes, FileSearch, Sparkles, GitBranch, Gauge, ScrollText, AlertTriangle,
  Lightbulb, FlaskConical, FileText, Download, Printer, UploadCloud, FolderUp,
  RefreshCw, CheckCircle2, ChevronDown, ChevronRight, X, Loader2, Filter,
  Layers, Database, Code2, Cpu, Zap, Shield, Play, ArrowRight, Eye,
  Check, Sliders, ExternalLink, ArrowUpDown, ChevronUp, AlertCircle, FileCode,
  HardDrive, Info, CheckCheck, Calculator
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import RingProgress from '@/components/RingProgress';
import StatusBadge from '@/components/StatusBadge';
import EvidenceBadge from '@/components/EvidenceBadge';
import CategoryExplanationModal from '@/components/CategoryExplanationModal';
import {
  api, type Application, type ApplicationCreate, type Artifact, type Component,
  type Dependency, type Assessment, type DomainBreakdown, type Finding,
  type RecommendationSummary, type Roadmap, type Report, type ArtifactSummary,
  type DependencySummary, type SimulationImpact, type ScenarioAnalysis,
  type RuleFiring, type DomainScore
} from '@/api/client';
import { resolveActiveApp, setStoredActiveAppId } from '@/utils/activeApp';

const DOMAIN_LABELS: Record<string, string> = {
  application_business_logic: 'Application & Business Logic',
  data_structures: 'Data Structures',
  database_persistence: 'Database & Persistence',
  jobs_batch_orchestration: 'Jobs, Batch & Orchestration',
  online_transactions_ui: 'Online Transactions & UI',
  integration_external_dependencies: 'Integration & External Dependencies',
  security_controls: 'Security & Controls',
  operational_nonfunctional: 'Operational & Nonfunctional',
};

const DOMAIN_ORDER = Object.keys(DOMAIN_LABELS);

const SEVERITY_COLORS: Record<string, string> = {
  high: '#DC2626',
  medium: '#D97706',
  low: '#166534',
  info: '#4B5563',
};

const PIPELINE_STAGES = [
  { id: 'ingest', label: '1. Ingest & Encodings', desc: 'Validating MIME, SHA-256 and ASCII/EBCDIC headers' },
  { id: 'parse', label: '2. Deterministic AST', desc: 'Extracting COBOL, Copybooks, JCL, BMS & SQL DDL' },
  { id: 'deps', label: '3. Dependency Graph', desc: 'Resolving dynamic CALLs, SQL tables, and batch jobs' },
  { id: 'assess', label: '4. 8-Domain Scoring', desc: 'Executing deterministic ruleset across 8 domains' },
  { id: 'evidence', label: '5. Evidence & Risk', desc: 'Segregating Evidence-based, Inferred, Assumed & Unknowns' },
  { id: 'recommend', label: '6. AI Recommendations', desc: 'Synthesizing refactoring roadmap and executive briefing' },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ApplicationOverviewPage() {
  const { id: routeAppId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  // App catalog state
  const [apps, setApps] = useState<Application[]>([]);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dimension states
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactSummary, setArtifactSummary] = useState<ArtifactSummary | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [depSummary, setDepSummary] = useState<DependencySummary | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [breakdown, setBreakdown] = useState<Record<string, DomainBreakdown>>({});
  const [findings, setFindings] = useState<Finding[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationSummary | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [infoDomain, setInfoDomain] = useState<string | null>(null);

  // Pipeline status
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(-1);
  const [pipelineMessage, setPipelineMessage] = useState<string | null>(null);
  const [pipelineElapsedMs, setPipelineElapsedMs] = useState<number>(0);

  // UI state
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedArtifactForView, setSelectedArtifactForView] = useState<Artifact | null>(null);
  const [artifactContent, setArtifactContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  // Collapsible sections
  const ALL_SECTIONS = [
    'ingestion', 'components', 'dependencies', 'complexity',
    'evidence', 'risks', 'recommendations', 'simulator', 'report'
  ];
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['ingestion', 'complexity', 'evidence', 'recommendations', 'report'])
  );

  // Filters within sections
  const [artifactSearch, setArtifactSearch] = useState('');
  const [artifactCatFilter, setArtifactCatFilter] = useState('all');
  const [findingClassFilter, setFindingClassFilter] = useState('all');
  const [findingSeverityFilter, setFindingSeverityFilter] = useState('all');
  const [componentSearch, setComponentSearch] = useState('');

  // What-If Simulator state inside section
  const [simComponentId, setSimComponentId] = useState<string>('');
  const [simScenario, setSimScenario] = useState<'extract_service' | 'refactor_in_place' | 'retain_mainframe'>('extract_service');
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<{ impact: SimulationImpact; scenario: ScenarioAnalysis } | null>(null);

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // 1. Initial Load of applications
  const loadApps = useCallback(async () => {
    setLoadingApp(true);
    try {
      const data = await api.listApplications();
      setApps(data);
      let selected: Application | null = null;
      if (routeAppId) {
        selected = data.find((a) => a.id === routeAppId) || null;
      }
      if (!selected) {
        selected = resolveActiveApp(data);
      }
      setActiveApp(selected);
      if (selected) {
        setStoredActiveAppId(selected.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    } finally {
      setLoadingApp(false);
    }
  }, [routeAppId]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  // Dynamic effective status: If an assessment exists or has fired rules, it is Complete!
  const effectiveStatus = useMemo(() => {
    if (assessment && (assessment.complexity_score !== null || assessment.fired_rules?.length > 0)) {
      return 'Complete';
    }
    return activeApp?.assessment_status || 'Not Started';
  }, [assessment, activeApp]);

  // Sync with backend if app was marked 'Not Started' despite having assessment results
  useEffect(() => {
    if (activeApp && assessment && activeApp.assessment_status !== 'Complete') {
      api.updateApplication(activeApp.id, { assessment_status: 'Complete' })
        .then(() => {
          setApps((prev) =>
            prev.map((a) => (a.id === activeApp.id ? { ...a, assessment_status: 'Complete' } : a))
          );
          setActiveApp((prev) => (prev ? { ...prev, assessment_status: 'Complete' } : null));
        })
        .catch(() => { });
    }
  }, [activeApp, assessment]);

  // 2. Load all dimensions for the active application
  const loadAppDimensions = useCallback(async (appId: string) => {
    setError(null);
    try {
      const [
        arts,
        artSumm,
        comps,
        deps,
        depSum,
        assess,
        bd,
        finds,
        recs,
        rdmap,
        rep,
      ] = await Promise.all([
        api.listArtifacts(appId).catch(() => []),
        api.artifactSummary(appId).catch(() => null),
        api.getComponents(appId).catch(() => []),
        api.getDependencies(appId).catch(() => []),
        api.getDependencySummary(appId).catch(() => null),
        api.getAssessment(appId).catch(() => null),
        api.getDomainBreakdown(appId).catch(() => ({})),
        api.getFindings(appId).catch(() => []),
        api.getRecommendations(appId).catch(() => null),
        api.getRoadmap(appId).catch(() => null),
        api.getReport(appId).catch(() => null),
      ]);

      setArtifacts(arts);
      setArtifactSummary(artSumm);
      setComponents(comps);
      if (comps.length > 0 && !simComponentId) {
        setSimComponentId(comps[0].id);
      }
      setDependencies(deps);
      setDepSummary(depSum);
      setAssessment(assess);
      setBreakdown(bd || {});
      setFindings(finds);
      setRecommendations(recs);
      setRoadmap(rdmap);
      setReport(rep);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load application data');
    }
  }, [simComponentId]);

  useEffect(() => {
    if (activeApp) {
      loadAppDimensions(activeApp.id);
    }
  }, [activeApp, loadAppDimensions]);

  // Handle switching apps
  async function handleSelectApp(appId: string) {
    const chosen = apps.find((a) => a.id === appId);
    if (!chosen) return;
    setActiveApp(chosen);
    localStorage.setItem('reframex_active_app_id', appId);
    localStorage.setItem('reframex_user_explicit_app', 'true');
    window.dispatchEvent(new CustomEvent('reframex-app-changed', { detail: { appId } }));
    try {
      await api.updateApplication(appId, { is_active: true });
    } catch {
      // ignore
    }
    navigate(`/applications/${appId}/overview`);
  }

  // 3. Automated End-to-End Pipeline Runner
  async function runAutomatedPipeline(uploadAction?: () => Promise<void>) {
    if (!activeApp) return;
    setPipelineRunning(true);
    setPipelineMessage(null);
    const startTime = performance.now();

    try {
      // Stage 1: Ingestion
      setCurrentStageIndex(0);
      if (uploadAction) {
        await uploadAction();
      }

      // Stage 2: AST Analysis
      setCurrentStageIndex(1);
      await api.analyze(activeApp.id);

      // Stage 3: Dependency Discovery
      setCurrentStageIndex(2);
      await api.discoverDependencies(activeApp.id);

      // Stage 4: 8-Domain Assessment
      setCurrentStageIndex(3);
      await api.runAssessment(activeApp.id);

      // Stage 5 & 6: Synthesizing findings, recommendations, report
      setCurrentStageIndex(4);
      await new Promise((r) => setTimeout(r, 100));

      setCurrentStageIndex(5);
      await api.updateApplication(activeApp.id, { assessment_status: 'Complete' });
      await loadAppDimensions(activeApp.id);
      await loadApps();

      const totalTime = Math.round(performance.now() - startTime);
      setPipelineElapsedMs(totalTime);
      setPipelineMessage(`All 6 automated checks completed successfully in ${(totalTime / 1000).toFixed(2)}s! Status updated to Complete. All findings ready below.`);
      setCurrentStageIndex(6); // Completed!

      // Expand all core sections to showcase findings immediately
      setExpandedSections(new Set(ALL_SECTIONS));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pipeline execution encountered an error');
    } finally {
      setPipelineRunning(false);
    }
  }

  // Handle file upload
  async function handleFilesUpload(files: FileList | null) {
    if (!files || files.length === 0 || !activeApp) return;
    const fileArray = Array.from(files);
    await runAutomatedPipeline(async () => {
      await api.uploadArtifacts(activeApp.id, fileArray);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  }

  // Handle 1-click sample pack load
  async function handleLoadSamplePack() {
    if (!activeApp) return;
    await runAutomatedPipeline(async () => {
      await api.loadSampleArtifacts(activeApp.id);
    });
  }

  // Section toggle helpers
  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAll() {
    setExpandedSections(new Set(ALL_SECTIONS));
  }

  function collapseAll() {
    setExpandedSections(new Set());
  }

  // Export handlers
  async function handleExport(format: 'json' | 'html') {
    if (!activeApp) return;
    setDownloadMenuOpen(false);
    try {
      await api.exportReport(activeApp.id, format);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to download report');
    }
  }

  function handleExportCSV() {
    if (!activeApp) return;
    setDownloadMenuOpen(false);
    api.exportFindingsCSV(findings, activeApp.name);
  }

  function handlePrintReport() {
    setDownloadMenuOpen(false);
    if (!activeApp) return;
    api.exportReport(activeApp.id, 'pdf').catch((e) => {
      setError(e instanceof Error ? e.message : 'Failed to export PDF');
    });
  }

  // Simulator runner inside section
  async function handleRunSimulator() {
    if (!activeApp || !simComponentId) return;
    setSimRunning(true);
    try {
      const resp = await api.runSimulation(activeApp.id, {
        component_id: simComponentId,
        scenario_type: simScenario,
      });
      setSimResult({
        impact: resp.impact,
        scenario: resp.scenario,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation failed');
    } finally {
      setSimRunning(false);
    }
  }

  // View artifact source
  async function handleViewArtifact(art: Artifact) {
    setSelectedArtifactForView(art);
    setLoadingContent(true);
    setArtifactContent(null);
    try {
      const res = await api.getArtifactContent(art.id);
      setArtifactContent(res.content);
    } catch (e) {
      setArtifactContent('Failed to load file content: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setLoadingContent(false);
    }
  }

  // Handle Finding Review
  async function handleReviewFinding(findingId: string, action: string) {
    try {
      await api.reviewFinding(findingId, {
        action,
        reviewer_name: 'Lead Architect',
        reviewer_role: 'Modernization Assessor',
        notes: `Reviewed in Application Overview cockpit (${action})`,
      });
      if (activeApp) {
        const updated = await api.getFindings(activeApp.id);
        setFindings(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review action failed');
    }
  }

  // Filtered artifacts
  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((a) => {
      if (artifactCatFilter !== 'all' && a.category !== artifactCatFilter) return false;
      if (artifactSearch.trim()) {
        const q = artifactSearch.toLowerCase();
        return (
          a.original_filename.toLowerCase().includes(q) ||
          (a.relative_path && a.relative_path.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [artifacts, artifactCatFilter, artifactSearch]);

  // Filtered components
  const filteredComponents = useMemo(() => {
    return components.filter((c) => {
      if (!componentSearch.trim()) return true;
      const q = componentSearch.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.component_type.toLowerCase().includes(q) ||
        c.source_filename.toLowerCase().includes(q)
      );
    });
  }, [components, componentSearch]);

  // Filtered findings
  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (findingClassFilter !== 'all' && f.evidence_class !== findingClassFilter) return false;
      if (findingSeverityFilter !== 'all' && f.severity !== findingSeverityFilter) return false;
      return true;
    });
  }, [findings, findingClassFilter, findingSeverityFilter]);

  // Chart data for domain breakdown
  const domainRadarData = useMemo(() => {
    return DOMAIN_ORDER.map((id) => {
      const s = assessment?.domain_scores?.[id];
      const bd = breakdown[id];
      return {
        domain: (bd?.label ?? DOMAIN_LABELS[id] ?? id).split(' ')[0],
        complexity: s?.complexity?.has_evidence && s.complexity.score != null ? s.complexity.score : 0,
        confidence: s?.confidence?.has_evidence && s.confidence.score != null ? s.confidence.score : 0,
        readiness: s?.readiness?.has_evidence && s.readiness.score != null ? s.readiness.score : 0,
      };
    });
  }, [assessment, breakdown]);

  const domainBarData = useMemo(() => {
    return DOMAIN_ORDER.map((id) => {
      const ds = assessment?.domain_scores?.[id]?.complexity;
      const bd = breakdown[id];
      return {
        domain: id,
        label: bd?.label ?? DOMAIN_LABELS[id] ?? id,
        score: ds?.has_evidence && ds.score != null ? ds.score : 0,
        hasEvidence: Boolean(ds?.has_evidence),
      };
    });
  }, [assessment, breakdown]);

  // Distinct artifact categories
  const categories = useMemo(() => {
    return artifactSummary ? Object.keys(artifactSummary.by_category).sort() : [];
  }, [artifactSummary]);

  if (loadingApp) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
        <span className="font-mono text-xs text-slate-500">Initializing ReFrameX Overview Cockpit…</span>
      </div>
    );
  }

  return (
    <>
      {/* 1. Header Toolbar with Application Switcher & Download Report */}
      <PageHeader
        title="Application Overview"
        breadcrumb={['ReFrameX', 'Applications', activeApp?.name ?? 'Overview', 'Cockpit']}
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* App switcher */}
            <div className="relative">
              <select
                value={activeApp?.id ?? ''}
                onChange={(e) => handleSelectApp(e.target.value)}
                className="h-9 appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 font-mono text-xs font-semibold text-slate-900 shadow-sm transition-all hover:border-indigo-600 focus:border-indigo-600 focus:outline-none"
              >
                {apps.map((a) => {
                  const isAssessed = (a.id === activeApp?.id && assessment) || a.assessment_status === 'Complete';
                  const statusLabel = isAssessed ? 'Complete' : a.assessment_status;
                  return (
                    <option key={a.id} value={a.id}>
                      {a.name} ({statusLabel})
                    </option>
                  );
                })}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Quick New App */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors"
              title="Add New Application"
            >
              + New
            </button>

            {/* Expand / Collapse All */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
              <button
                onClick={expandAll}
                className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
                title="Expand All Accordions"
              >
                Expand All
              </button>
              <span className="text-slate-200">|</span>
              <button
                onClick={collapseAll}
                className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
                title="Collapse All Accordions"
              >
                Collapse
              </button>
            </div>

            {/* Run Full Pipeline */}
            <button
              onClick={() => runAutomatedPipeline()}
              disabled={pipelineRunning || !activeApp}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all hover:from-indigo-700 hover:to-blue-700 active:scale-[0.98] disabled:opacity-50"
            >
              {pipelineRunning ? <Loader2 size={13} className="animate-spin text-white" /> : <Play size={13} className="text-indigo-200" />}
              {pipelineRunning ? 'Running Checks…' : 'Run Full Pipeline'}
            </button>

            {/* DOWNLOAD REPORT DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/25 transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98]"
              >
                <Download size={14} className="text-emerald-100" />
                <span>Download Report</span>
                <ChevronDown size={12} className={downloadMenuOpen ? 'rotate-180 transition-transform' : ''} />
              </button>

              {downloadMenuOpen && (
                <div
                  className="absolute right-0 mt-2 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 border-b border-slate-100">
                    Select Export Format
                  </div>
                  <button
                    onClick={() => handleExport('html')}
                    className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <FileText size={15} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Interactive HTML Report</div>
                      <div className="text-[10px] text-slate-500">Self-contained executive briefing with all 19 sections</div>
                    </div>
                  </button>

                  <button
                    onClick={handlePrintReport}
                    className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                      <Printer size={15} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Printable PDF Report</div>
                      <div className="text-[10px] text-slate-500">Clean print-ready view formatted for executive distribution</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleExport('json')}
                    className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
                      <Code2 size={15} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Structured JSON (M2O Schema)</div>
                      <div className="text-[10px] text-slate-500">Complete machine-readable assessment tree</div>
                    </div>
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                      <Database size={15} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Findings CSV Spreadsheet</div>
                      <div className="text-[10px] text-slate-500">All findings, rules, line citations and severity metrics</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />

      {error && (
        <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800 shadow-sm">
          <AlertCircle size={15} className="text-red-600 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700"><X size={14} /></button>
        </div>
      )}

      {/* 2. Hero Application Meta Strip & KPI Scorecards */}
      {activeApp && (
        <div className="space-y-6 mb-8">
          {/* Identity Bar */}
          <BentoCard className="p-5 border border-slate-200/90 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/25">
                  <Boxes size={26} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="font-mono text-xl font-bold text-slate-900">{activeApp.name}</h2>
                    <StatusBadge status={effectiveStatus} />
                    {activeApp.is_active && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                        <Check size={11} className="text-emerald-600" /> Active Context
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 max-w-2xl line-clamp-1">
                    {activeApp.description || 'Enterprise mainframe mission-critical application.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-3.5 py-2">
                  <span className="text-[10px] uppercase font-bold text-indigo-700 block">Business Domain</span>
                  <span className="font-semibold text-slate-900">{activeApp.business_domain || 'Banking & Insurance'}</span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2">
                  <span className="text-[10px] uppercase font-bold text-slate-600 block">Technology Stack</span>
                  <span className="font-semibold text-slate-900">{activeApp.technology_stack || 'COBOL, CICS, DB2, JCL'}</span>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Target Architecture</span>
                  <span className="font-semibold text-emerald-800">Red Hat OpenShift / Java Microservices</span>
                </div>
              </div>
            </div>
          </BentoCard>

          {/* 4 Glowing KPI Scorecards with Colored Accent Borders & Badges */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Complexity */}
            <BentoCard className="relative overflow-hidden p-5 border-t-4 border-amber-500 bg-gradient-to-b from-amber-50/30 to-white shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-amber-800">
                  Migration Complexity
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Explain how Migration Complexity is calculated"
                    onClick={() => setInfoDomain('composite')}
                    className="rounded p-1 text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    <Info size={14} />
                  </button>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <Gauge size={15} />
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <RingProgress
                  value={assessment?.complexity_score ?? 0}
                  size={76}
                  color="#D97706"
                  sublabel="/ 100"
                />
                <div className="min-w-0">
                  <div className="text-xl font-bold text-slate-900 leading-tight">
                    {assessment ? assessment.complexity_classification : 'Not Assessed'}
                  </div>
                  <div className="text-[11px] font-mono text-amber-700 mt-1">
                    {assessment ? `${assessment.domains_assessed ?? 8}/8 domains calculated` : 'Upload & run'}
                  </div>
                </div>
              </div>
            </BentoCard>

            {/* Confidence */}
            <BentoCard className="relative overflow-hidden p-5 border-t-4 border-blue-500 bg-gradient-to-b from-blue-50/30 to-white shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-blue-800">
                  Assessment Confidence
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Explain how Assessment Confidence is calculated"
                    onClick={() => setInfoDomain('composite')}
                    className="rounded p-1 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    <Info size={14} />
                  </button>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <Shield size={15} />
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <RingProgress
                  value={assessment?.confidence_score ?? 0}
                  size={76}
                  color="#2563EB"
                  sublabel="%"
                />
                <div className="min-w-0">
                  <div className="text-xl font-bold text-slate-900 leading-tight">
                    {assessment ? assessment.confidence_classification : 'Pending Evidence'}
                  </div>
                  <div className="text-[11px] font-mono text-blue-700 mt-1">
                    {findings.length > 0 ? `${findings.filter(f => f.evidence_class === 'Evidence-based').length} verified citations` : 'Awaiting code trace'}
                  </div>
                </div>
              </div>
            </BentoCard>

            {/* Readiness */}
            <BentoCard className="relative overflow-hidden p-5 border-t-4 border-emerald-500 bg-gradient-to-b from-emerald-50/30 to-white shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-800">
                  Migration Readiness
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Explain how Migration Readiness is calculated"
                    onClick={() => setInfoDomain('composite')}
                    className="rounded p-1 text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    <Info size={14} />
                  </button>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <Sparkles size={15} />
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <RingProgress
                  value={assessment?.readiness_score ?? 0}
                  size={76}
                  color="#059669"
                  sublabel="/ 100"
                />
                <div className="min-w-0">
                  <div className="text-xl font-bold text-slate-900 leading-tight">
                    {assessment ? assessment.readiness_classification : 'Uncomputed'}
                  </div>
                  <div className="text-[11px] font-mono text-emerald-700 mt-1">
                    {recommendations ? `${recommendations.total} actionable refactorings` : 'Calculated after rules'}
                  </div>
                </div>
              </div>
            </BentoCard>

            {/* Asset Totals */}
            <BentoCard className="relative overflow-hidden p-5 border-t-4 border-purple-500 bg-gradient-to-b from-purple-50/30 to-white shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-purple-800">
                  Discovered Inventory
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                  <Boxes size={15} />
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-1">
                <div className="rounded-lg bg-white/90 border border-slate-100 p-2 shadow-2xs">
                  <span className="text-slate-500 text-[10px] block">Artifacts</span>
                  <span className="font-bold text-lg text-blue-600">{artifacts.length}</span>
                </div>
                <div className="rounded-lg bg-white/90 border border-slate-100 p-2 shadow-2xs">
                  <span className="text-slate-500 text-[10px] block">Components</span>
                  <span className="font-bold text-lg text-indigo-600">{components.length}</span>
                </div>
                <div className="rounded-lg bg-white/90 border border-slate-100 p-2 shadow-2xs">
                  <span className="text-slate-500 text-[10px] block">Dependencies</span>
                  <span className="font-bold text-sm text-teal-600">{dependencies.length}</span>
                </div>
                <div className="rounded-lg bg-white/90 border border-slate-100 p-2 shadow-2xs">
                  <span className="text-slate-500 text-[10px] block">Findings / Risks</span>
                  <span className="font-bold text-sm text-rose-600">{findings.length}</span>
                </div>
              </div>
            </BentoCard>
          </div>
        </div>
      )}

      {/* 3. Hero Ingestion Hub & Live Animated Pipeline Stepper */}
      <div className="mb-8 rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-slate-50/80 to-indigo-50/40 p-6 shadow-[0_8px_30px_rgba(30,41,59,0.06)] relative overflow-hidden">
        {/* Subtle decorative aura */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-gradient-to-br from-indigo-400/10 via-purple-400/10 to-teal-400/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/25">
                <Sparkles size={15} />
              </span>
              <h3 className="font-sans text-base font-bold text-slate-900">
                Automated Ingestion & Multi-Stage Assessment Engine
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Pipeline Ready
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upload a source directory or files. ReFrameX executes the complete audit automatically:
              decompiles AST, resolves cross-module calls, calculates all 8 complexity domains, classifies line-level citations, and compiles the executive report below.
            </p>
          </div>

          {/* Action buttons with clean alignment */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={pipelineRunning || !activeApp}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <FolderUp size={15} className="text-blue-400" />
              <span>Upload Directory</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={pipelineRunning || !activeApp}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              <UploadCloud size={15} className="text-indigo-600" />
              <span>Upload Files</span>
            </button>

            <button
              onClick={handleLoadSamplePack}
              disabled={pipelineRunning || !activeApp}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/25 hover:from-emerald-700 hover:to-teal-700 transition-all active:scale-[0.98] disabled:opacity-50"
              title="1-Click load verified sample pack containing COBOL, Copybooks, JCL, BMS maps & SQL DDL"
            >
              <Sparkles size={14} className="text-emerald-200 animate-pulse" />
              <span>1-Click Load Mainframe Sample Pack</span>
            </button>

            {/* Hidden file & folder inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFilesUpload(e.target.files)}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              // @ts-expect-error standard directory upload attribute
              webkitdirectory=""
              directory=""
              className="hidden"
              onChange={(e) => handleFilesUpload(e.target.files)}
            />
          </div>
        </div>

        {/* Drag & drop dropzone hint */}
        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFilesUpload(e.dataTransfer.files); }}
          className="mt-5 rounded-xl border-2 border-dashed border-indigo-200 bg-white/70 hover:bg-indigo-50/40 transition-colors p-4 text-center cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600">
            <HardDrive size={15} className="text-indigo-500" />
            <span className="font-medium">Drag & drop mainframe repository here (or click to browse):</span>
            <div className="flex flex-wrap items-center gap-1.5 ml-1">
              <span className="font-mono text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-semibold">COBOL (.cbl)</span>
              <span className="font-mono text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md font-semibold">Copybook (.cpy)</span>
              <span className="font-mono text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-md font-semibold">JCL (.jcl)</span>
              <span className="font-mono text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-semibold">BMS Maps (.bms)</span>
              <span className="font-mono text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-semibold">Db2 SQL (.sql)</span>
              <span className="font-mono text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md font-semibold">Security (.racf)</span>
            </div>
          </div>
        </div>

        {/* Animated Pipeline Stepper */}
        {(pipelineRunning || pipelineMessage) && (
          <div className="mt-5 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {pipelineRunning ? (
                  <Loader2 size={16} className="animate-spin text-indigo-600" />
                ) : (
                  <CheckCheck size={16} className="text-emerald-600" />
                )}
                <span className="font-mono text-xs font-bold text-slate-900">
                  {pipelineRunning ? 'Automated Analysis Pipeline in Progress…' : 'Pipeline Execution Complete'}
                </span>
              </div>
              {pipelineElapsedMs > 0 && (
                <span className="font-mono text-xs text-emerald-800 font-bold bg-emerald-100 px-2.5 py-0.5 rounded-md">
                  Elapsed: {(pipelineElapsedMs / 1000).toFixed(2)}s
                </span>
              )}
            </div>

            {/* Pipeline Step Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {PIPELINE_STAGES.map((stg, idx) => {
                const isPassed = currentStageIndex > idx;
                const isCurrent = currentStageIndex === idx;
                return (
                  <div
                    key={stg.id}
                    className={`rounded-xl border p-2.5 transition-all ${isPassed
                      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
                      : isCurrent
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-sm text-indigo-900'
                        : 'border-slate-200 bg-slate-50/60 text-slate-400'
                      }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {isPassed ? (
                        <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                      ) : isCurrent ? (
                        <Loader2 size={14} className="shrink-0 animate-spin text-indigo-600" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-slate-300" />
                      )}
                      <span className="font-mono text-[11px] font-bold truncate text-slate-900">
                        {stg.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug line-clamp-2">
                      {stg.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            {pipelineMessage && (
              <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>{pipelineMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. THE 9 COMBINED COLLAPSIBLE DIMENSIONS */}
      <div className="space-y-4">
        {/* ========================================================================= */}
        {/* SECTION 1: ARTIFACT INVENTORY & SOURCE EXPLORER */}
        {/* ========================================================================= */}
        <CollapsibleSection
          id="ingestion"
          index="01"
          themeColor="blue"
          icon={<FileSearch size={18} />}
          title="Artifact Ingestion & Source Inventory"
          subtitle="Indexed mainframe sources, categorized by type, encoding, and parse status"
          badge={`${artifacts.length} Artifacts (${formatSize(artifactSummary?.total_size_bytes ?? 0)})`}
          isExpanded={expandedSections.has('ingestion')}
          onToggle={() => toggleSection('ingestion')}
          tabLink="/artifacts"
        >
          {artifacts.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No artifacts uploaded yet. Use the upload bar above to ingest files.</p>
          ) : (
            <div className="space-y-4">
              {/* Category pills */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-[10px] uppercase font-bold text-slate-500">Filter Category:</span>
                <button
                  onClick={() => setArtifactCatFilter('all')}
                  className={`px-3 py-1 rounded-lg font-mono text-[11px] font-semibold transition-colors ${artifactCatFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  All ({artifacts.length})
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setArtifactCatFilter(c)}
                    className={`px-3 py-1 rounded-lg font-mono text-[11px] font-semibold transition-colors ${artifactCatFilter === c
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {c} ({artifactSummary?.by_category[c]})
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search file name…"
                    value={artifactSearch}
                    onChange={(e) => setArtifactSearch(e.target.value)}
                    className="h-8 rounded-xl border border-slate-200 px-3 text-xs font-mono outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Artifact table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Filename</th>
                      <th className="px-4 py-2.5 font-semibold">Category</th>
                      <th className="px-4 py-2.5 font-semibold">Support Level</th>
                      <th className="px-4 py-2.5 font-semibold">Size</th>
                      <th className="px-4 py-2.5 font-semibold">Encoding</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredArtifacts.slice(0, 15).map((art) => (
                      <tr key={art.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                          {art.original_filename}
                          {art.relative_path && art.relative_path !== art.original_filename && (
                            <span className="block text-[10px] text-slate-400 font-normal">{art.relative_path}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-600 font-medium">{art.category}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-mono font-semibold ${art.support_level === 'SUPPORTED_PARSE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                            {art.support_level}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-600 tabular-nums">{formatSize(art.size_bytes)}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-600">{art.detected_encoding}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={art.processing_status} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => handleViewArtifact(art)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs"
                          >
                            <Eye size={12} className="text-blue-600" /> View Code
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredArtifacts.length > 15 && (
                <p className="text-[11px] text-slate-500 text-center">
                  Showing first 15 of {filteredArtifacts.length} artifacts. View all in Artifact Explorer.
                </p>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* ========================================================================= */}
        {/* SECTION 2: COMPONENT & APPLICATION INTELLIGENCE */}
        {/* ========================================================================= */}
        <CollapsibleSection
          id="components"
          index="02"
          themeColor="indigo"
          icon={<Cpu size={18} />}
          title="Component & Application Intelligence"
          subtitle="Extracted business programs, subroutines, copybook records, JCL jobs, and screens"
          badge={`${components.length} Extracted Components`}
          isExpanded={expandedSections.has('components')}
          onToggle={() => toggleSection('components')}
          tabLink="/intelligence"
        >
          {components.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No components extracted. Run the pipeline to extract AST nodes.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  placeholder="Filter components by name or type…"
                  value={componentSearch}
                  onChange={(e) => setComponentSearch(e.target.value)}
                  className="h-8 w-72 rounded-xl border border-slate-200 px-3 text-xs font-mono outline-none focus:border-indigo-600"
                />
                <span className="font-mono text-xs text-slate-500">
                  {filteredComponents.length} of {components.length} components
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Component Name</th>
                      <th className="px-4 py-2.5 font-semibold">Type</th>
                      <th className="px-4 py-2.5 font-semibold">Technology</th>
                      <th className="px-4 py-2.5 font-semibold">Source File & Line</th>
                      <th className="px-4 py-2.5 font-semibold">Evidence Class</th>
                      <th className="px-4 py-2.5 font-semibold">Key Detected Properties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredComponents.slice(0, 15).map((comp) => (
                      <tr key={comp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                          {comp.name}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-indigo-700 font-semibold">{comp.component_type}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-600">{comp.technology}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">
                          {comp.source_filename}
                          <span className="text-slate-400 ml-1">
                            (L{comp.line_start}{comp.line_end !== comp.line_start ? `–${comp.line_end}` : ''})
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <EvidenceBadge evidence={comp.evidence_class} />
                        </td>
                        <td className="px-4 py-2.5 text-[11px] font-mono text-slate-600">
                          {Object.entries(comp.detected_properties || {})
                            .slice(0, 2)
                            .map(([k, v]) => `${k}=${v}`)
                            .join('; ') || 'Standard AST construct'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CollapsibleSection>

        {/* ========================================================================= */}
        {/* SECTION 3: DEPENDENCY INTELLIGENCE & CALL GRAPH */}
        {/* ========================================================================= */}
        <CollapsibleSection
          id="dependencies"
          index="03"
          themeColor="teal"
          icon={<GitBranch size={18} />}
          title="Dependency Intelligence & Topology"
          subtitle="Inter-component call chains, database queries, copybook inclusions, and job steps"
          badge={`${dependencies.length} Discovered Calls`}
          isExpanded={expandedSections.has('dependencies')}
          onToggle={() => toggleSection('dependencies')}
          tabLink="/dependencies"
        >
          {dependencies.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No dependencies discovered yet.</p>
          ) : (
            <div className="space-y-4">
              {/* Dependency KPI strip with vibrant background pills */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3">
                  <span className="text-[10px] uppercase font-mono font-bold text-teal-800 block">Total Invocations</span>
                  <span className="text-xl font-bold font-mono text-teal-900">{depSummary?.total_dependencies ?? dependencies.length}</span>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                  <span className="text-[10px] uppercase font-mono font-bold text-amber-800 block">Unresolved Targets</span>
                  <span className="text-xl font-bold font-mono text-amber-900">{depSummary?.unresolved_targets ?? 0}</span>
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50/50 p-3">
                  <span className="text-[10px] uppercase font-mono font-bold text-red-800 block">Circular Chains</span>
                  <span className="text-xl font-bold font-mono text-red-900">{depSummary?.circular_dependencies ?? 0}</span>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                  <span className="text-[10px] uppercase font-mono font-bold text-blue-800 block">Single Points of Failure</span>
                  <span className="text-xl font-bold font-mono text-blue-900">{depSummary?.single_points ?? 0}</span>
                </div>
              </div>

              {/* Dependency list table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Caller Component</th>
                      <th className="px-4 py-2.5 font-semibold">Relationship</th>
                      <th className="px-4 py-2.5 font-semibold">Target Component</th>
                      <th className="px-4 py-2.5 font-semibold">Evidence</th>
                      <th className="px-4 py-2.5 font-semibold">Rule Citation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {dependencies.slice(0, 10).map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-2 font-mono font-bold text-slate-900">{d.source_component_id}</td>
                        <td className="px-4 py-2 font-mono text-xs">
                          <span className="inline-flex rounded-md bg-blue-50 px-2.5 py-0.5 text-blue-700 font-semibold border border-blue-200">
                            {d.relationship_type}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono font-bold text-slate-900">{d.target_component_id}</td>
                        <td className="px-4 py-2">
                          <EvidenceBadge evidence={d.evidence_class} />
                        </td>
                        <td className="px-4 py-2 text-[11px] font-mono text-slate-600">{d.detection_method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CollapsibleSection>

        {/* ========================================================================= */}
        {/* SECTION 4: 8-DOMAIN COMPLEXITY ASSESSMENT & RULES */}
        {/* ========================================================================= */}
        <CollapsibleSection
          id="complexity"
          index="04"
          themeColor="amber"
          icon={<Gauge size={18} />}
          title="Migration Complexity & 8-Domain Scoring"
          subtitle="Deterministic ruleset execution across all eight official assessment domains"
          badge={assessment ? `Score: ${assessment.complexity_score}/100 (${assessment.complexity_classification})` : 'Pending'}
          isExpanded={expandedSections.has('complexity')}
          onToggle={() => toggleSection('complexity')}
          tabLink="/complexity"
        >
          {!assessment ? (
            <p className="text-xs text-slate-500 py-4 text-center">Run assessment to score domains.</p>
          ) : (
            <div className="space-y-6">
              {/* Radar and Bar Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <h4 className="font-mono text-xs font-bold uppercase text-slate-700 mb-3 flex items-center justify-between">
                    <span>8-Domain Score Radar</span>
                    <span className="text-[10px] text-amber-700 font-normal">Complexity vs Confidence vs Readiness</span>
                  </h4>
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <RadarChart data={domainRadarData} outerRadius={95}>
                        <PolarGrid stroke="#CBD5E1" />
                        <PolarAngleAxis dataKey="domain" tick={{ fontSize: 10, fill: '#475569', fontFamily: 'JetBrains Mono' }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94A3B8', fontFamily: 'JetBrains Mono' }} />
                        <Radar name="Complexity" dataKey="complexity" stroke="#D97706" fill="#D97706" fillOpacity={0.25} />
                        <Radar name="Confidence" dataKey="confidence" stroke="#2563EB" fill="#2563EB" fillOpacity={0.2} />
                        <Radar name="Readiness" dataKey="readiness" stroke="#059669" fill="#059669" fillOpacity={0.25} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <h4 className="font-mono text-xs font-bold uppercase text-slate-700 mb-3 flex items-center justify-between">
                    <span>Domain Complexity Distribution</span>
                    <span className="text-[10px] text-slate-500 font-normal">Weighted by component count</span>
                  </h4>
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart data={domainBarData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }} />
                        <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 9, fill: '#475569', fontFamily: 'JetBrains Mono' }} />
                        <Tooltip />
                        <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={12}>
                          {domainBarData.map((d, i) => (
                            <Cell key={i} fill={d.hasEvidence ? '#D97706' : '#E2E8F0'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* 8-Domain Breakdown with Info Calculation Icons */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-mono text-xs font-bold uppercase text-slate-900">
                      8-Domain Scorecard & Calculation Proof
                    </h4>
                    <span className="text-[11px] text-slate-500 font-normal">
                      Click <Info size={12} className="inline text-blue-600" /> on any category to view formulas & rules
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInfoDomain('composite')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors shadow-2xs"
                  >
                    <Calculator size={12} /> Scoring Guide & Proof
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {DOMAIN_ORDER.map((id) => {
                    const label = DOMAIN_LABELS[id] ?? id;
                    const ds = assessment?.domain_scores?.[id];
                    const cx = ds?.complexity;
                    const conf = ds?.confidence;
                    const ready = ds?.readiness;
                    const anyEv = cx?.has_evidence || conf?.has_evidence || ready?.has_evidence;

                    return (
                      <div
                        key={id}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 hover:border-blue-300 hover:bg-blue-50/20 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-2">
                            <span className="text-xs font-bold text-slate-800 truncate" title={label}>
                              {label}
                            </span>
                            <button
                              type="button"
                              title={`Explain how ${label} is calculated`}
                              onClick={() => setInfoDomain(id)}
                              className="rounded p-1 text-slate-400 hover:text-blue-600 hover:bg-white transition-colors shrink-0"
                            >
                              <Info size={13} />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
                            <div className="rounded bg-white p-1.5 border border-slate-200/80">
                              <span className="text-[9px] text-amber-700 block uppercase font-bold">Cx</span>
                              <span className="text-xs font-bold text-slate-800">
                                {cx?.has_evidence && cx.score != null ? cx.score : '—'}
                              </span>
                            </div>
                            <div className="rounded bg-white p-1.5 border border-slate-200/80">
                              <span className="text-[9px] text-blue-700 block uppercase font-bold">Conf</span>
                              <span className="text-xs font-bold text-slate-800">
                                {conf?.has_evidence && conf.score != null ? conf.score : '—'}
                              </span>
                            </div>
                            <div className="rounded bg-white p-1.5 border border-slate-200/80">
                              <span className="text-[9px] text-emerald-700 block uppercase font-bold">Ready</span>
                              <span className="text-xs font-bold text-slate-800">
                                {ready?.has_evidence && ready.score != null ? ready.score : '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                          <span>{anyEv ? 'Evidenced' : 'Unevidenced'}</span>
                          <button
                            type="button"
                            onClick={() => setInfoDomain(id)}
                            className="font-semibold text-blue-600 hover:underline inline-flex items-center gap-0.5"
                          >
                            Details <ChevronRight size={10} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fired Rules Table */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <h4 className="font-mono text-xs font-bold uppercase text-slate-900 mb-3 flex items-center justify-between">
                  <span>Applied Rules ({assessment.fired_rules.length})</span>
                  <button
                    type="button"
                    onClick={() => setInfoDomain('composite')}
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 hover:text-blue-700 transition-colors"
                  >
                    <Info size={12} className="text-blue-600" />
                    <span>How points are accumulated</span>
                  </button>
                </h4>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {assessment.fired_rules.map((rule, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs hover:border-amber-300 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900">{rule.rule_id}</span>
                        <div className="flex items-center gap-2">
                          <span className="rounded px-2 py-0.5 font-mono text-[10px] bg-white border border-slate-200 text-slate-800 font-semibold">
                            {DOMAIN_LABELS[rule.domain] ?? rule.domain}
                          </span>
                          <span
                            className="rounded px-2 py-0.5 font-mono text-[10px] font-bold"
                            style={{
                              background: rule.severity === 'high' ? '#FEE2E2' : '#FEF3C7',
                              color: rule.severity === 'high' ? '#991B1B' : '#92400E',
                            }}
                          >
                            {rule.severity}
                          </span>
                          <span className="font-mono font-bold text-amber-700">+{rule.points} pts</span>
                        </div>
                      </div>
                      <p className="mt-1 text-slate-900 font-semibold">{rule.description}</p>
                      <p className="mt-0.5 text-slate-600">{rule.explanation}</p>
                      {rule.recommendation && (
                        <div className="mt-2 text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                          <span className="font-bold">Modernization guidance: </span>{rule.recommendation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CollapsibleSection>

        {/* ========================================================================= */}
        {/* SECTION 5: EVIDENCE EXPLORER & LINE-LEVEL AUDIT LEDGER */}
        {/* ========================================================================= */}
        <CollapsibleSection
          id="evidence"
          index="05"
          themeColor="emerald"
          icon={<ScrollText size={18} />}
          title="Evidence Explorer & Audit Ledger"
          subtitle="Every material conclusion traced to artifact, line numbers, and classification"
          badge={`${findings.length} Evidence Findings`}
          isExpanded={expandedSections.has('evidence')}
          onToggle={() => toggleSection('evidence')}
          tabLink="/evidence"
        >
          {findings.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No findings recorded. Ingest code to generate evidence trace.</p>
          ) : (
            <div className="space-y-4">
              {/* Evidence Class Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-[10px] uppercase font-bold text-slate-500">Classification:</span>
                {['all', 'Evidence-based', 'Inferred', 'Assumed', 'Unknown'].map((cls) => (
                  <button
                    key={cls}
                    onClick={() => setFindingClassFilter(cls)}
                    className={`px-3 py-1 rounded-lg font-mono text-[11px] font-semibold transition-colors ${findingClassFilter === cls ? 'bg-emerald-700 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {cls} ({cls === 'all' ? findings.length : findings.filter((f) => f.evidence_class === cls).length})
                  </button>
                ))}

                <span className="font-mono text-[10px] uppercase font-bold text-slate-500 ml-3">Severity:</span>
                {['all', 'high', 'medium', 'low'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setFindingSeverityFilter(sev)}
                    className={`px-3 py-1 rounded-lg font-mono text-[11px] font-semibold transition-colors ${findingSeverityFilter === sev ? 'bg-emerald-700 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {sev} ({sev === 'all' ? findings.length : findings.filter((f) => f.severity === sev).length})
                  </button>
                ))}
              </div>

              {/* Findings Ledger Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Finding Title & Explanation</th>
                      <th className="px-4 py-2.5 font-semibold">Domain</th>
                      <th className="px-4 py-2.5 font-semibold">Severity</th>
                      <th className="px-4 py-2.5 font-semibold">Evidence Class</th>
                      <th className="px-4 py-2.5 font-semibold">Source Citation</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Auditor Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredFindings.slice(0, 15).map((find) => (
                      <tr key={find.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-2.5 max-w-sm">
                          <div className="font-bold text-slate-900">{find.title}</div>
                          <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{find.explanation}</p>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-600 font-medium">{DOMAIN_LABELS[find.domain] ?? find.domain}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className="inline-flex rounded-md px-2 py-0.5 font-mono text-[10px] font-bold"
                            style={{
                              background: `${SEVERITY_COLORS[find.severity] || '#777D83'}15`,
                              color: SEVERITY_COLORS[find.severity] || '#777D83',
                            }}
                          >
                            {find.severity}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <EvidenceBadge evidence={find.evidence_class} />
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-900">
                          {find.source_filename}
                          <span className="block text-slate-400">
                            L{find.line_start}{find.line_end !== find.line_start ? `–${find.line_end}` : ''}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleReviewFinding(find.id, 'accept')}
                              className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
                              title="Mark Verified"
                            >
                              Verify
                            </button>
                            <button
                              onClick={() => handleReviewFinding(find.id, 'override')}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                              title="Override"
                            >
                              Override
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CollapsibleSection>

        {/* ========================================================================= */}
        {/* SECTION 6: UNKNOWNS & RISK REGISTER */}
        {/* ========================================================================= */}
        <CollapsibleSection
          id="risks"
          index="06"
          themeColor="rose"
          icon={<AlertTriangle size={18} />}
          title="Unknowns, Risks & Missing Information"
          subtitle="Severity breakdown and unsupported artifacts impacting confidence score"
          badge={`${findings.filter((f) => f.severity === 'high').length} High Risks`}
          isExpanded={expandedSections.has('risks')}
          onToggle={() => toggleSection('risks')}
          tabLink="/risks"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* High Risks */}
              <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-2xs">
                <h4 className="font-mono text-xs font-bold uppercase text-red-900 mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-red-600" /> High-Severity Risks ({findings.filter((f) => f.severity === 'high').length})
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {findings.filter((f) => f.severity === 'high').map((rf) => (
                    <div key={rf.id} className="rounded-lg border border-red-200 bg-white p-3 text-xs shadow-2xs">
                      <div className="font-bold text-red-900">{rf.title}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">{rf.explanation}</div>
                      <div className="mt-1 font-mono text-[10px] text-slate-400">
                        Source: {rf.source_filename} (L{rf.line_start})
                      </div>
                    </div>
                  ))}
                  {findings.filter((f) => f.severity === 'high').length === 0 && (
                    <p className="text-xs text-emerald-700">No high severity risks identified.</p>
                  )}
                </div>
              </div>

              {/* Missing Information / Unsupported */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
                <h4 className="font-mono text-xs font-bold uppercase text-amber-900 mb-3 flex items-center gap-1.5">
                  <Info size={15} className="text-amber-600" /> Missing Artifacts & Confidence Degradation
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {(assessment?.missing_information || []).map((msg, i) => (
                    <div key={i} className="rounded-lg border border-amber-200 bg-white p-3 text-xs text-amber-900 shadow-2xs">
                      • {msg}
                    </div>
                  ))}
                  {(assessment?.missing_information || []).length === 0 && (
                    <p className="text-xs text-emerald-700">All necessary artifact types present.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* ========================================================================= */}
        {/* SECTION 7: REFACTORING RECOMMENDATIONS & ROADMAP */}
        {/* ========================================================================= */}
        <CollapsibleSection
          id="recommendations"
          index="07"
          themeColor="purple"
          icon={<Lightbulb size={18} />}
          title="Modernization Recommendations & Phased Roadmap"
          subtitle="Prioritized candidate decomposition, target microservices, and sprint planning"
          badge={`${recommendations?.total ?? 0} Recommendations`}
          isExpanded={expandedSections.has('recommendations')}
          onToggle={() => toggleSection('recommendations')}
          tabLink="/recommendations"
        >
          {!recommendations ? (
            <p className="text-xs text-slate-500 py-4 text-center">No recommendations synthesized yet.</p>
          ) : (
            <div className="space-y-4">
              {/* Category cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs shadow-2xs">
                  <span className="font-mono text-[10px] uppercase font-bold text-emerald-800 block">Good Refactoring Candidates</span>
                  <span className="text-2xl font-bold font-mono text-emerald-700">
                    {recommendations.by_category['Good Refactoring Candidate'] ?? 0}
                  </span>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs shadow-2xs">
                  <span className="font-mono text-[10px] uppercase font-bold text-amber-800 block">Requires Further Analysis</span>
                  <span className="text-2xl font-bold font-mono text-amber-700">
                    {recommendations.by_category['Requires Further Analysis'] ?? 0}
                  </span>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs shadow-2xs">
                  <span className="font-mono text-[10px] uppercase font-bold text-red-800 block">Retain on Mainframe</span>
                  <span className="text-2xl font-bold font-mono text-red-700">
                    {recommendations.by_category['Retain on Mainframe for Now'] ?? 0}
                  </span>
                </div>
              </div>

              {/* Recommendation items */}
              <div className="space-y-2.5">
                {recommendations.recommendations.map((rec, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-2xs hover:border-purple-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-900">{rec.component}</span>
                        <span className="font-mono text-[11px] text-slate-500 font-semibold">({rec.component_type})</span>
                      </div>
                      <span className={`rounded-md px-2.5 py-0.5 font-mono text-[10px] font-bold ${rec.category === 'Good Refactoring Candidate'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : rec.category === 'Requires Further Analysis'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                        {rec.category}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-800 font-medium leading-relaxed">{rec.reason}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-600 border-t border-slate-100 pt-2">
                      <span><strong>Next Action:</strong> {rec.next_action}</span>
                      <span><strong>Complexity:</strong> {rec.complexity_classification}</span>
                      <span><strong>Confidence:</strong> {rec.confidence_classification}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CollapsibleSection>

        {/* ========================================================================= */}
        {/* SECTION 8: REFACTORING IMPACT SIMULATOR (WHAT-IF) */}
        {/* ========================================================================= */}
        <CollapsibleSection
          id="simulator"
          index="08"
          themeColor="pink"
          icon={<FlaskConical size={18} />}
          title="Refactoring Impact Simulator (What-If)"
          subtitle="Test extraction boundaries, calculate blast radius, and preview database dependencies"
          badge="Interactive Sandbox"
          isExpanded={expandedSections.has('simulator')}
          onToggle={() => toggleSection('simulator')}
          tabLink="/simulator"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-mono uppercase font-bold text-slate-600 mb-1">Target Component</label>
                <select
                  value={simComponentId}
                  onChange={(e) => setSimComponentId(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 outline-none"
                >
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.component_type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-mono uppercase font-bold text-slate-600 mb-1">Modernization Scenario</label>
                <select
                  value={simScenario}
                  onChange={(e) => setSimScenario(e.target.value as any)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 outline-none"
                >
                  <option value="extract_service">Extract to Spring Boot / Quarkus Service</option>
                  <option value="refactor_in_place">Refactor Monolith In-Place</option>
                  <option value="retain_mainframe">Retain on Mainframe with API Wrapper</option>
                </select>
              </div>

              <div className="self-end">
                <button
                  onClick={handleRunSimulator}
                  disabled={simRunning || !simComponentId}
                  className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {simRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  Simulate Impact
                </button>
              </div>
            </div>

            {simResult && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-xs shadow-2xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-mono">
                  <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                    <span className="text-[10px] text-slate-500 block font-bold">Directly Impacted</span>
                    <span className="font-bold text-lg text-slate-900">{simResult.impact.directly_impacted}</span>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-200">
                    <span className="text-[10px] text-amber-800 block font-bold">Indirect Blast Radius</span>
                    <span className="font-bold text-lg text-amber-700">{simResult.impact.indirectly_impacted}</span>
                  </div>
                  <div className="rounded-lg bg-indigo-50 p-2.5 border border-indigo-200">
                    <span className="text-[10px] text-indigo-800 block font-bold">Shared DB Tables</span>
                    <span className="font-bold text-lg text-indigo-700">{simResult.impact.shared_data_dependencies.length}</span>
                  </div>
                  <div className="rounded-lg bg-teal-50 p-2.5 border border-teal-200">
                    <span className="text-[10px] text-teal-800 block font-bold">Connected JCL Jobs</span>
                    <span className="font-bold text-lg text-teal-700">{simResult.impact.connected_jobs.length}</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-2 text-slate-600 leading-relaxed">
                  <strong>Connectivity note: </strong> {simResult.impact.graph_connectivity_note}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* ========================================================================= */}
        {/* SECTION 9: EXECUTIVE REPORT & MULTI-FORMAT EXPORT */}
        {/* ========================================================================= */}
        <CollapsibleSection
          id="report"
          index="09"
          themeColor="slate"
          icon={<FileText size={18} />}
          title="Executive Assessment Report & Multi-Format Export"
          subtitle="All 19 audit sections pre-computed for board and architectural review"
          badge={report ? '19 Sections Ready' : 'Pending'}
          isExpanded={expandedSections.has('report')}
          onToggle={() => toggleSection('report')}
          tabLink="/reports"
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
              <div>
                <h4 className="font-sans text-sm font-bold text-slate-900">
                  Official ReFrameX Modernization Assessment Report
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Full 19-section compliance document including AI governance, deterministic AST findings, and reviewer logs.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleExport('html')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700"
                >
                  <Download size={13} /> Download HTML
                </button>
                <button
                  onClick={handlePrintReport}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <Printer size={13} /> Print PDF
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <Code2 size={13} /> JSON
                </button>
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <Database size={13} /> Findings CSV
                </button>
              </div>
            </div>

            {report && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-[11px] font-mono">
                {[
                  'Executive Summary', 'Application Overview', 'Artifact Inventory', 'Component Inventory',
                  'Dependency Analysis', 'Domain Assessments', 'Migration Complexity', 'Assessment Confidence',
                  'Migration Readiness', 'Major Risks', 'Evidence Gaps', 'Refactoring Recommendations',
                  'Prioritized Next Steps', 'Parser Coverage', 'Evidence Metrics', 'AI Usage Statement',
                  'Limitations & Assumptions', 'Version Audit', 'Measured Metrics'
                ].map((sec, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-2xs">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span className="truncate text-slate-800 font-semibold">{sec}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>
      </div>

      {/* 5. Source Code Viewer Drawer */}
      {selectedArtifactForView && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedArtifactForView(null)}>
          <div
            className="w-full max-w-2xl h-full overflow-y-auto bg-white border-l border-slate-200 p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <div>
                <h3 className="font-mono text-base font-bold text-slate-900">{selectedArtifactForView.original_filename}</h3>
                <span className="font-mono text-xs text-indigo-700 font-semibold">{selectedArtifactForView.category} · {selectedArtifactForView.detected_encoding}</span>
              </div>
              <button
                onClick={() => setSelectedArtifactForView(null)}
                className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {loadingContent ? (
              <div className="flex items-center justify-center py-20 text-slate-500">
                <Loader2 size={24} className="animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shadow-2xs">
                <div className="border-b border-slate-200 bg-white px-4 py-2 font-mono text-[10px] font-bold text-slate-600">
                  Source Viewer · UTF-8 Decoded
                </div>
                <pre className="p-4 font-mono text-xs text-slate-900 overflow-x-auto whitespace-pre-wrap max-h-[70vh] leading-relaxed">
                  {artifactContent || '(No content available)'}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Quick New Application Modal */}
      {showCreateModal && (
        <CreateAppModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (data) => {
            const created = await api.createApplication(data);
            await api.updateApplication(created.id, { is_active: true });
            setShowCreateModal(false);
            await loadApps();
            navigate(`/applications/${created.id}/overview`);
          }}
        />
      )}

      {/* 7. Category Calculation & Algorithm Explainer Modal */}
      <CategoryExplanationModal
        isOpen={!!infoDomain}
        domainId={infoDomain}
        assessment={assessment}
        onClose={() => setInfoDomain(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Reusable Collapsible Section Container with Color Themes
// ---------------------------------------------------------------------------
interface CollapsibleSectionProps {
  id: string;
  index: string;
  icon: React.ReactNode;
  themeColor?: 'blue' | 'indigo' | 'teal' | 'amber' | 'emerald' | 'rose' | 'purple' | 'pink' | 'slate';
  title: string;
  subtitle: string;
  badge?: string;
  isExpanded: boolean;
  onToggle: () => void;
  tabLink?: string;
  children: React.ReactNode;
}

const THEME_STYLES: Record<string, { iconBg: string; badgeBg: string; borderHover: string }> = {
  blue: { iconBg: 'bg-blue-100 text-blue-700 border-blue-200', badgeBg: 'bg-blue-50 text-blue-800 border-blue-200', borderHover: 'hover:border-blue-400' },
  indigo: { iconBg: 'bg-indigo-100 text-indigo-700 border-indigo-200', badgeBg: 'bg-indigo-50 text-indigo-800 border-indigo-200', borderHover: 'hover:border-indigo-400' },
  teal: { iconBg: 'bg-teal-100 text-teal-700 border-teal-200', badgeBg: 'bg-teal-50 text-teal-800 border-teal-200', borderHover: 'hover:border-teal-400' },
  amber: { iconBg: 'bg-amber-100 text-amber-800 border-amber-200', badgeBg: 'bg-amber-50 text-amber-800 border-amber-200', borderHover: 'hover:border-amber-400' },
  emerald: { iconBg: 'bg-emerald-100 text-emerald-700 border-emerald-200', badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200', borderHover: 'hover:border-emerald-400' },
  rose: { iconBg: 'bg-rose-100 text-rose-700 border-rose-200', badgeBg: 'bg-rose-50 text-rose-800 border-rose-200', borderHover: 'hover:border-rose-400' },
  purple: { iconBg: 'bg-purple-100 text-purple-700 border-purple-200', badgeBg: 'bg-purple-50 text-purple-800 border-purple-200', borderHover: 'hover:border-purple-400' },
  pink: { iconBg: 'bg-pink-100 text-pink-700 border-pink-200', badgeBg: 'bg-pink-50 text-pink-800 border-pink-200', borderHover: 'hover:border-pink-400' },
  slate: { iconBg: 'bg-slate-100 text-slate-800 border-slate-200', badgeBg: 'bg-slate-100 text-slate-800 border-slate-200', borderHover: 'hover:border-slate-400' },
};

function CollapsibleSection({
  index,
  icon,
  themeColor = 'indigo',
  title,
  subtitle,
  badge,
  isExpanded,
  onToggle,
  tabLink,
  children,
}: CollapsibleSectionProps) {
  const navigate = useNavigate();
  const theme = THEME_STYLES[themeColor] || THEME_STYLES.indigo;

  return (
    <BentoCard className={`overflow-hidden p-0 transition-all border border-slate-200/90 shadow-xs ${theme.borderHover}`} dense>
      <div
        onClick={onToggle}
        className="flex w-full items-center justify-between cursor-pointer p-5 transition-colors hover:bg-slate-50/70"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
            {index}
          </span>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${theme.iconBg} shadow-2xs`}>
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="font-sans text-sm font-bold text-slate-900 truncate">
              {title}
            </h3>
            <p className="text-[11px] text-slate-500 truncate font-medium">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          {badge && (
            <span className={`font-mono text-xs font-bold border px-3 py-1 rounded-lg shadow-2xs ${theme.badgeBg}`}>
              {badge}
            </span>
          )}

          {tabLink && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(tabLink);
              }}
              className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-500 hover:text-indigo-600 hover:underline"
              title="Open full dedicated tab"
            >
              Open Tab <ExternalLink size={11} />
            </button>
          )}

          <div className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-200 bg-white p-5 animate-in fade-in-50 duration-150">
          {children}
        </div>
      )}
    </BentoCard>
  );
}

// ---------------------------------------------------------------------------
// Quick Create Application Modal
// ---------------------------------------------------------------------------
function CreateAppModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: ApplicationCreate) => Promise<void>;
}) {
  const [form, setForm] = useState<ApplicationCreate>({
    name: '',
    description: '',
    business_domain: 'Banking & Financial Services',
    owner: 'Enterprise Architecture',
    technology_stack: 'COBOL, CICS, DB2, JCL',
    environment: 'Production',
    assessment_status: 'Not Started',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!form.name.trim()) {
      setErr('Application Name / ID is required');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onCreate(form);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-base font-bold text-slate-900">Create Application for Overview Cockpit</h2>
          <button onClick={onClose} className="rounded-xl p-1 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
        </div>
        {err && <div className="mb-3 text-xs font-semibold text-red-700 bg-red-50 p-2 rounded-lg border border-red-200">{err}</div>}
        <div className="space-y-3">
          <div>
            <span className="block text-[11px] font-mono uppercase font-bold text-slate-600 mb-1">Application Name / ID *</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-9 rounded-xl border border-slate-200 px-3 font-mono text-xs outline-none focus:border-indigo-600"
              placeholder="e.g. CORE-BANKING-PAYROLL"
            />
          </div>
          <div>
            <span className="block text-[11px] font-mono uppercase font-bold text-slate-600 mb-1">Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full h-16 rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-indigo-600"
              placeholder="Mission critical mainframe ledger and settlement subsystem."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-[10px] font-mono uppercase font-bold text-slate-600 mb-1">Business Domain</span>
              <input
                value={form.business_domain}
                onChange={(e) => setForm({ ...form, business_domain: e.target.value })}
                className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-indigo-600"
              />
            </div>
            <div>
              <span className="block text-[10px] font-mono uppercase font-bold text-slate-600 mb-1">Tech Stack</span>
              <input
                value={form.technology_stack}
                onChange={(e) => setForm({ ...form, technology_stack: e.target.value })}
                className="w-full h-9 rounded-xl border border-slate-200 px-3 font-mono text-xs outline-none focus:border-indigo-600"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
          <button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            Create & Open Cockpit
          </button>
        </div>
      </div>
    </div>
  );
}
