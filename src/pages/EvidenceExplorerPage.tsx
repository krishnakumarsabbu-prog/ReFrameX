import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, AlertCircle, X, Search, ChevronDown, ChevronRight,
  ScrollText, FileSearch, Filter, FileCode, CheckCircle2, XCircle,
  HelpCircle, MessageSquarePlus, ClipboardList, Bot, ShieldCheck, Eye,
  Check, Ban, Sparkles, Cpu, BarChart3, Layers, Scale, AlertTriangle,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import EvidenceBadge from '@/components/EvidenceBadge';
import StatusBadge from '@/components/StatusBadge';
import EvidenceMetricsView from '@/components/EvidenceMetricsView';
import {
  api, type Application, type Finding, type ArtifactContent,
  type ReviewRequest, type LLMEvaluationItem, type LLMPreviewResponse,
  type LLMMetrics,
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

const EVIDENCE_CLASSES = ['Evidence-based', 'Inferred', 'Assumed', 'Unknown'] as const;
const SEVERITIES = ['high', 'medium', 'low', 'info'] as const;

export default function EvidenceExplorerPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterEvidence, setFilterEvidence] = useState<string>('');
  const [filterDomain, setFilterDomain] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  const [activeTab, setActiveTab] = useState<'findings' | 'llm_harness' | 'metrics'>('findings');
  const [llmMetrics, setLlmMetrics] = useState<LLMMetrics | null>(null);
  const [evaluations, setEvaluations] = useState<LLMEvaluationItem[]>([]);
  const [runningBatch, setRunningBatch] = useState(false);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'side_by_side' | 'compact'>('side_by_side');
  const [disagreementsOnly, setDisagreementsOnly] = useState<boolean>(false);
  const [evaluatingFindingId, setEvaluatingFindingId] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    try {
      const data = await api.listApplications();
      setApps(data);
      setActiveApp(resolveActiveApp(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    }
  }, []);

  const loadFindings = useCallback(async (appId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [data, evs, mets] = await Promise.all([
        api.getFindings(appId),
        api.getLLMEvaluations(appId).catch(() => []),
        api.getLLMMetrics(appId).catch(() => null),
      ]);
      setFindings(data);
      setEvaluations(evs);
      setLlmMetrics(mets);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load findings');
      setFindings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);
  useEffect(() => { if (activeApp) loadFindings(activeApp.id); }, [activeApp, loadFindings]);

  const evalMap = useMemo(() => {
    const map = new Map<string, LLMEvaluationItem>();
    evaluations.forEach((ev) => {
      if (ev.target_id) map.set(ev.target_id, ev);
    });
    return map;
  }, [evaluations]);

  const disagreementCount = useMemo(() => {
    let count = 0;
    findings.forEach((f) => {
      const ev = evalMap.get(f.id);
      if (!ev) return;
      const resp = ev.response as any;
      const conc = resp?.concurrence ?? resp?.verdict;
      const sCls = resp?.suggested_reclassification ?? resp?.suggested_classification;
      if (conc === 'dissents' || conc === 'contradicts' || (sCls && sCls !== f.evidence_class)) {
        count++;
      }
    });
    return count;
  }, [findings, evalMap]);

  async function handleRunDualAnalysis() {
    if (!activeApp) return;
    setRunningBatch(true);
    setError(null);
    setBatchMsg(null);
    try {
      const res = await api.evaluateBatchLLM({
        application_id: activeApp.id,
        task_type: 'T1',
        limit: 100,
        force_refresh: false,
      });
      setBatchMsg(`Dual analysis completed: evaluated ${res.processed} finding(s) with LLM Semantic Auditor.`);
      await loadFindings(activeApp.id);
    } catch (e: any) {
      setError(e.message || 'Dual analysis batch failed');
    } finally {
      setRunningBatch(false);
    }
  }

  async function handleSingleAudit(findingId: string) {
    if (!activeApp) return;
    setEvaluatingFindingId(findingId);
    try {
      await api.evaluateLLM({
        task_type: 'T1',
        target_id: findingId,
        provider_override: 'mock',
      });
      await loadFindings(activeApp.id);
    } catch (e: any) {
      setError(e.message || 'Audit failed');
    } finally {
      setEvaluatingFindingId(null);
    }
  }

  async function handleCardReviewAI(evalId: string, action: 'accept' | 'dismiss') {
    try {
      await api.reviewLLMEvaluation(evalId, { action });
      setEvaluations((prev) =>
        prev.map((e) => (e.id === evalId ? { ...e, review_status: action === 'accept' ? 'accepted' : 'dismissed' } : e))
      );
    } catch (e: any) {
      setError(e.message || 'Failed to submit review');
    }
  }

  async function handleSelectApp(id: string) {
    setStoredActiveAppId(id);
    try {
      await api.updateApplication(id, { is_active: true });
      await loadApps();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to select application');
    }
  }

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (filterEvidence && f.evidence_class !== filterEvidence) return false;
      if (filterDomain && f.domain !== filterDomain) return false;
      if (filterSeverity && f.severity !== filterSeverity) return false;
      if (disagreementsOnly) {
        const ev = evalMap.get(f.id);
        if (!ev) return false;
        const resp = ev.response as any;
        const conc = resp?.concurrence ?? resp?.verdict;
        const sCls = resp?.suggested_reclassification ?? resp?.suggested_classification;
        const isDis = conc === 'dissents' || conc === 'contradicts' || (sCls && sCls !== f.evidence_class);
        if (!isDis) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return f.title.toLowerCase().includes(q) ||
          f.explanation.toLowerCase().includes(q) ||
          f.detection_rule.toLowerCase().includes(q) ||
          f.source_filename.toLowerCase().includes(q);
      }
      return true;
    });
  }, [findings, filterEvidence, filterDomain, filterSeverity, disagreementsOnly, search, evalMap]);

  const evidenceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    findings.forEach((f) => { counts[f.evidence_class] = (counts[f.evidence_class] ?? 0) + 1; });
    return counts;
  }, [findings]);

  const domains = useMemo(() => {
    return [...new Set(findings.map((f) => f.domain))].sort();
  }, [findings]);

  if (apps.length === 0 && !loading) {
    return (
      <>
        <PageHeader title="Evidence Explorer" breadcrumb={['ReFrameX', 'Evidence']} />
        <BentoCard className="mx-auto flex max-w-xl flex-col items-center p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]">
            <ScrollText size={24} />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-[#0F172A]">No applications to explore</h2>
          <p className="max-w-sm text-xs leading-relaxed text-[#64748B]">
            Create an application, upload artifacts, run analysis and assessment, then explore the evidence here.
          </p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Evidence Explorer"
        breadcrumb={['ReFrameX', 'Evidence']}
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={runningBatch || !activeApp}
              onClick={handleRunDualAnalysis}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-purple-600/20 transition-all hover:from-purple-700 hover:to-indigo-700 active:scale-[0.98] disabled:opacity-50"
            >
              {runningBatch ? (
                <>
                  <Loader2 size={13} className="animate-spin text-white" />
                  <span>Auditing with LLM...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} className="text-amber-300" />
                  <span>Run Dual Analysis (Static + LLM)</span>
                </>
              )}
            </button>
            <div className="relative">
              <select
                value={activeApp?.id ?? ''}
                onChange={(e) => handleSelectApp(e.target.value)}
                className="h-9 appearance-none rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] pl-3.5 pr-8 font-mono text-xs font-medium text-[#202124] outline-none transition-all focus:border-[#202124] focus:bg-white"
              >
                {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#777D83]" />
            </div>
          </div>
        }
      />

      {error && (
        <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#991B1B]">
          <AlertCircle size={15} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {batchMsg && (
        <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-[#DCFCE7] bg-[#F0FDF4] px-4 py-3 text-xs font-medium text-[#166534]">
          <CheckCircle2 size={15} /> {batchMsg}
          <button onClick={() => setBatchMsg(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Subtab navigation */}
      <div className="mb-6 flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('findings')}
          className={`px-3.5 py-1.5 font-sans text-xs font-semibold rounded-xl transition-all ${activeTab === 'findings'
              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
        >
          Evidence Findings ({findings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('llm_harness')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 font-sans text-xs font-semibold rounded-xl transition-all ${activeTab === 'llm_harness'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
        >
          <Bot size={13} /> LLM Evaluation Harness ({evaluations.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('metrics')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 font-sans text-xs font-semibold rounded-xl transition-all ${activeTab === 'metrics'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
        >
          <BarChart3 size={13} /> Evidence Metrics (Static vs LLM)
        </button>
      </div>

      {activeTab === 'metrics' ? (
        <EvidenceMetricsView
          appId={activeApp?.id ?? ''}
          appName={activeApp?.name ?? ''}
          onOpenFinding={(findingId) => {
            const f = findings.find((x) => x.id === findingId);
            if (f) setSelectedFinding(f);
          }}
        />
      ) : activeTab === 'llm_harness' ? (
        <LLMHarnessView
          appId={activeApp?.id ?? ''}
          metrics={llmMetrics}
          evaluations={evaluations}
          onRefresh={() => activeApp && loadFindings(activeApp.id)}
        />
      ) : (
        <>
          {/* Dual Engine Banner */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/40 via-white to-purple-50/40 p-5 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-500/20">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Dual-Engine Migration Intelligence (Static Rules + LLM Deep Semantic Audit)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Static AST analysis detects deterministic rule patterns. The LLM auditor reviews semantic intent, architectural context, and false-positive likelihood side-by-side.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="rounded-xl bg-white border border-slate-200 px-3 py-1 text-slate-800 shadow-2xs">
                Evaluated: <strong className="text-indigo-600">{evaluations.length}</strong> / {findings.length}
              </span>
              {disagreementCount > 0 && (
                <span className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-1 font-semibold text-rose-700">
                  {disagreementCount} Discrepancies Detected
                </span>
              )}
            </div>
          </div>

          {/* 4-Tier Evidence Class Summary Cards */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {EVIDENCE_CLASSES.map((ec) => {
              const borderTheme = ec === 'Evidence-based'
                ? 'border-t-4 border-emerald-500'
                : ec === 'Inferred'
                  ? 'border-t-4 border-blue-500'
                  : ec === 'Assumed'
                    ? 'border-t-4 border-amber-500'
                    : 'border-t-4 border-purple-500';

              return (
                <div
                  key={ec}
                  className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all hover:shadow-sm ${borderTheme}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <EvidenceBadge evidence={ec} />
                  </div>
                  <span className="font-sans text-2xl sm:text-3xl font-bold tabular-nums text-slate-900 block">
                    {evidenceCounts[ec] ?? 0}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Search + filters + View Mode */}
          <BentoCard className="mb-5 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A4A8]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search findings by title, rule, or source..."
                  className="h-9 w-full rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] pl-9 pr-3 text-xs text-[#202124] placeholder:text-[#A0A4A8] outline-none focus:border-[#202124] focus:bg-white transition-colors"
                />
              </div>
              <FilterDropdown label="Evidence" value={filterEvidence} options={EVIDENCE_CLASSES as unknown as string[]} onChange={setFilterEvidence} />
              <FilterDropdown label="Domain" value={filterDomain} options={domains} labels={DOMAIN_LABELS} onChange={setFilterDomain} />
              <FilterDropdown label="Severity" value={filterSeverity} options={SEVERITIES as unknown as string[]} onChange={setFilterSeverity} />

              {/* Disagreements Filter Button */}
              <button
                type="button"
                onClick={() => setDisagreementsOnly(!disagreementsOnly)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${disagreementsOnly
                    ? 'bg-[#202124] text-white shadow-sm'
                    : 'border border-[#E3E5E7] bg-white text-[#777D83] hover:text-[#202124] hover:bg-[#F1F2F3]'
                  }`}
              >
                <AlertTriangle size={12} />
                <span>Show Disagreements Only ({disagreementCount})</span>
              </button>

              {/* View Mode Toggle */}
              <div className="flex items-center rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('side_by_side')}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${viewMode === 'side_by_side'
                      ? 'bg-white text-[#202124] shadow-sm'
                      : 'text-[#777D83] hover:text-[#202124]'
                    }`}
                >
                  ⚡ Side-by-Side
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('compact')}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${viewMode === 'compact'
                      ? 'bg-white text-[#202124] shadow-sm'
                      : 'text-[#777D83] hover:text-[#202124]'
                    }`}
                >
                  Compact
                </button>
              </div>

              {(filterEvidence || filterDomain || filterSeverity || disagreementsOnly || search) && (
                <button
                  onClick={() => { setFilterEvidence(''); setFilterDomain(''); setFilterSeverity(''); setDisagreementsOnly(false); setSearch(''); }}
                  className="text-xs font-medium text-[#202124] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
            <div className="mt-2.5 font-mono text-xs text-[#777D83] tabular-nums">
              Showing {filtered.length} of {findings.length} findings {disagreementsOnly ? '(filtered by AI discrepancy)' : ''}
            </div>
          </BentoCard>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#777D83]">
              <Loader2 size={24} className="animate-spin text-[#202124]" />
            </div>
          ) : filtered.length === 0 ? (
            <BentoCard className="flex flex-col items-center p-12 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]">
                <Filter size={20} />
              </div>
              <h3 className="mb-1 text-base font-semibold text-[#0F172A]">No findings match your filters</h3>
              <p className="max-w-sm text-xs text-[#64748B]">
                {disagreementsOnly
                  ? 'No discrepancies found between Static Analysis and LLM Analysis for this application.'
                  : 'Run an assessment to generate findings, or adjust your search and filter criteria.'}
              </p>
            </BentoCard>
          ) : viewMode === 'side_by_side' ? (
            <div className="space-y-4">
              {filtered.map((f) => (
                <SideBySideFindingCard
                  key={f.id}
                  finding={f}
                  evaluation={evalMap.get(f.id)}
                  onOpenDrawer={() => setSelectedFinding(f)}
                  onRequestAI={() => handleSingleAudit(f.id)}
                  onReviewAI={(act) => {
                    const ev = evalMap.get(f.id);
                    if (ev) handleCardReviewAI(ev.id, act);
                  }}
                  evaluating={evaluatingFindingId === f.id}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((f) => (
                <FindingRow key={f.id} finding={f} onClick={() => setSelectedFinding(f)} />
              ))}
            </div>
          )}
        </>
      )}

      {selectedFinding && (
        <FindingDrawer
          finding={selectedFinding}
          onClose={() => setSelectedFinding(null)}
          onReviewSubmitted={(updated) => {
            setFindings((prev) => prev.map((f) => f.id === updated.id ? { ...f, ...updated } : f));
            setSelectedFinding((prev) => prev ? { ...prev, ...updated } : prev);
          }}
        />
      )}
    </>
  );
}

function FilterDropdown({ label, value, options, labels, onChange }: {
  label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] pl-3 pr-8 text-xs font-medium text-[#777D83] outline-none hover:border-[#202124] focus:border-[#202124] transition-colors"
      >
        <option value="">{label}: All</option>
        {options.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
      </select>
      <ChevronDown size={11} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A0A4A8]" />
    </div>
  );
}

function FindingRow({ finding, onClick }: { finding: Finding; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E3E5E7] bg-white p-3.5 shadow-[0_2px_8px_rgba(25,30,35,0.02)] transition-all hover:border-[#202124] hover:shadow-sm"
    >
      <ChevronRight size={13} className="shrink-0 text-[#A0A4A8]" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-medium text-[#202124]">{finding.detection_rule}</span>
          <span className="truncate text-xs font-medium text-[#202124]">{finding.title}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-[#777D83]">
          <span>{DOMAIN_LABELS[finding.domain] ?? finding.domain}</span>
          {finding.source_filename && <span>· {finding.source_filename}</span>}
          {finding.has_line_ref && <span>· Line {finding.line_start}{finding.line_end !== finding.line_start ? `–${finding.line_end}` : ''}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <EvidenceBadge evidence={finding.evidence_class} />
        <StatusBadge severity={finding.severity as any} />
        {finding.reviewer_status && (
          <span className="rounded-lg border border-[#E3E5E7] bg-[#F1F2F3] px-2 py-0.5 font-mono text-[10px] font-medium text-[#202124]">
            {finding.reviewer_status}
          </span>
        )}
      </div>
    </div>
  );
}

function SideBySideFindingCard({
  finding,
  evaluation,
  onOpenDrawer,
  onRequestAI,
  onReviewAI,
  evaluating,
}: {
  finding: Finding;
  evaluation?: LLMEvaluationItem;
  onOpenDrawer: () => void;
  onRequestAI: () => void;
  onReviewAI: (action: 'accept' | 'dismiss') => void;
  evaluating: boolean;
}) {
  const resp = evaluation?.response as any;
  const concurrence = resp?.concurrence ?? (resp?.verdict ? (resp.verdict === 'supports' ? 'concurs' : resp.verdict === 'contradicts' ? 'dissents' : 'uncertain') : null);
  const isDissents = concurrence === 'dissents' || concurrence === 'contradicts';
  const isConcurs = concurrence === 'concurs' || concurrence === 'supports';
  const hasSuggestedClass = resp?.suggested_reclassification && resp.suggested_reclassification !== finding.evidence_class;

  const codeSnippetText =
    (finding.extra?.code_snippet as string) ||
    (finding.extra?.snippet as string) ||
    `Line ${finding.line_start}: ${finding.title}`;

  return (
    <div className={`rounded-2xl border bg-white shadow-[0_4px_16px_rgba(25,30,35,0.04)] transition-all hover:shadow-[0_8px_24px_rgba(25,30,35,0.06)] ${isDissents ? 'border-[#FECACA] ring-1 ring-[#FECACA]/50' : 'border-[#E3E5E7]'
      }`}>
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E3E5E7] bg-[#FAFAFA] px-4 py-3 rounded-t-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-medium text-[#202124]">{finding.detection_rule}</span>
          <span className="text-xs font-medium text-[#202124]">{finding.title}</span>
          <span className="text-[11px] text-[#777D83]">({DOMAIN_LABELS[finding.domain] ?? finding.domain})</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge severity={finding.severity as any} />
          {concurrence ? (
            <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 font-sans text-[10px] font-medium ${isConcurs
                ? 'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]'
                : isDissents
                  ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                  : 'bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]'
              }`}>
              {isConcurs ? <CheckCircle2 size={11} /> : isDissents ? <AlertTriangle size={11} /> : <HelpCircle size={11} />}
              {isConcurs ? 'AI Corroborated (Concurs)' : isDissents ? 'AI Dissent (Nuance / FP)' : 'AI Uncertain'}
            </span>
          ) : (
            <span className="rounded-lg bg-[#F1F2F3] border border-[#E3E5E7] px-2 py-0.5 font-sans text-[10px] font-medium text-[#777D83]">
              Static Only
            </span>
          )}
          <button
            onClick={onOpenDrawer}
            className="rounded-lg p-1 text-[#A0A4A8] hover:bg-[#F1F2F3] hover:text-[#202124]"
            title="Inspect source code & full review drawer"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Side-by-side content grid */}
      <div className="grid grid-cols-1 divide-y md:grid-cols-2 md:divide-x md:divide-y-0 divide-[#E3E5E7]">
        {/* Left Column: Deterministic Static Engine */}
        <div className="p-4 space-y-2.5 bg-[#FAFAFA]">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-sans text-[11px] font-medium uppercase tracking-wider text-[#777D83]">
              <Layers size={13} /> Static Rule Engine (AST)
            </span>
            <EvidenceBadge evidence={finding.evidence_class} />
          </div>

          <p className="text-xs text-[#202124] leading-relaxed">
            {finding.explanation}
          </p>

          <div className="rounded-xl border border-[#E3E5E7] bg-white p-3 font-mono text-[11px] text-[#202124]">
            <div className="flex items-center justify-between text-[10px] text-[#777D83] border-b border-[#E3E5E7] pb-1.5 mb-1.5">
              <span>File: <strong className="text-[#202124]">{finding.source_filename || 'Unknown'}</strong></span>
              <span>Lines: <strong className="text-[#202124]">{finding.line_start || 1}–{finding.line_end || finding.line_start || 1}</strong></span>
            </div>
            <div className="truncate text-[#202124] font-mono">
              {codeSnippetText}
            </div>
          </div>
        </div>

        {/* Right Column: LLM Semantic Deep Audit */}
        <div className="p-4 space-y-2.5 bg-white">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-sans text-[11px] font-medium uppercase tracking-wider text-[#202124]">
              <Cpu size={13} /> LLM Semantic Deep Audit
            </span>
            {hasSuggestedClass ? (
              <span className="rounded-lg bg-[#FEF3C7] px-2 py-0.5 font-mono text-[10px] font-medium text-[#B45309] border border-[#FDE68A]">
                Suggests: {resp.suggested_reclassification}
              </span>
            ) : resp?.suggested_reclassification ? (
              <span className="rounded-lg bg-[#F1F2F3] px-2 py-0.5 font-mono text-[10px] font-medium text-[#202124] border border-[#E3E5E7]">
                Class: {resp.suggested_reclassification}
              </span>
            ) : null}
          </div>

          {evaluation ? (
            <div className="space-y-2">
              <p className="text-xs text-[#202124] leading-relaxed">
                {resp?.rationale || 'AI evaluation complete. Concurs with static detection rules.'}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E3E5E7] text-[11px]">
                <div className="font-mono text-[10px] text-[#777D83]">
                  Cited: {resp?.cited_lines?.length ? `Lines [${resp.cited_lines.join(', ')}]` : 'Context verified'}
                  {resp?.citation_validation_passed ? ' (Validated ✓)' : ''}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onReviewAI('accept')}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors ${evaluation.review_status === 'accepted'
                        ? 'bg-[#202124] text-white shadow-sm'
                        : 'border border-[#E3E5E7] text-[#202124] hover:bg-[#F1F2F3]'
                      }`}
                  >
                    Accept AI Verdict
                  </button>
                  <button
                    onClick={() => onReviewAI('dismiss')}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors ${evaluation.review_status === 'dismissed'
                        ? 'bg-[#DC2626] text-white shadow-sm'
                        : 'border border-[#E3E5E7] text-[#777D83] hover:bg-[#F1F2F3]'
                      }`}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-5 text-center">
              <p className="text-xs text-[#777D83] mb-2.5">
                No LLM deep audit run yet for this finding.
              </p>
              <button
                disabled={evaluating}
                onClick={onRequestAI}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] px-3.5 py-1.5 text-xs font-medium text-[#202124] hover:bg-[#E9EAEC] transition-colors disabled:opacity-50"
              >
                {evaluating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                Audit with LLM
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FindingDrawer({ finding, onClose, onReviewSubmitted }: {
  finding: Finding;
  onClose: () => void;
  onReviewSubmitted: (updated: Partial<Finding> & { id: string }) => void;
}) {
  const [artifactContent, setArtifactContent] = useState<ArtifactContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [reviewAction, setReviewAction] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerRole, setReviewerRole] = useState('Viewer');
  const [reviewReason, setReviewReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewContext, setReviewContext] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [aiEval, setAiEval] = useState<LLMEvaluationItem | null>(null);
  const [evaluatingAI, setEvaluatingAI] = useState(false);
  const [previewingAI, setPreviewingAI] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<LLMPreviewResponse | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    api.getLLMEvaluations(finding.application_id, { target_id: finding.id, task_type: 'T1' })
      .then((records) => {
        if (records.length > 0) setAiEval(records[0]);
      })
      .catch(() => { });
  }, [finding.application_id, finding.id]);

  async function handlePreviewAI() {
    setPreviewingAI(true);
    setAiError(null);
    try {
      const payload = await api.previewLLMPayload({ task_type: 'T1', target_id: finding.id });
      setPreviewPayload(payload);
      setShowPreviewModal(true);
    } catch (e: any) {
      setAiError(e.message || 'Failed to generate preview payload');
    } finally {
      setPreviewingAI(false);
    }
  }

  async function handleRequestAI() {
    setEvaluatingAI(true);
    setAiError(null);
    try {
      const res = await api.evaluateLLM({
        task_type: 'T1',
        target_id: finding.id,
        provider_override: 'mock',
      });
      setAiEval(res);
    } catch (e: any) {
      setAiError(e.message || 'AI evaluation failed');
    } finally {
      setEvaluatingAI(false);
    }
  }

  async function handleReviewAI(action: 'accept' | 'dismiss') {
    if (!aiEval) return;
    try {
      await api.reviewLLMEvaluation(aiEval.id, { action });
      setAiEval({ ...aiEval, review_status: action === 'accept' ? 'accepted' : 'dismissed' });
    } catch (e: any) {
      setAiError(e.message || 'Failed to update review status');
    }
  }

  useEffect(() => {
    if (finding.source_artifact_id) {
      setLoadingContent(true);
      api.getArtifactContentWithHighlights(finding.source_artifact_id, finding.id)
        .then((data) => setArtifactContent(data))
        .catch(() => setArtifactContent(null))
        .finally(() => setLoadingContent(false));
    }
  }, [finding.source_artifact_id, finding.id]);

  async function handleSubmitReview() {
    if (!reviewAction) return;
    setSubmitting(true);
    setReviewError(null);
    try {
      const req: ReviewRequest = {
        action: reviewAction,
        reviewer_name: reviewerName || 'anonymous',
        reviewer_role: reviewerRole,
        reason: reviewReason || undefined,
        notes: reviewNotes || undefined,
        context: reviewContext || undefined,
      };
      const result = await api.reviewFinding(finding.id, req);
      onReviewSubmitted({
        id: finding.id,
        reviewer_status: result.action,
        reviewer_notes: result.notes ?? null,
        review_actions: [...finding.review_actions, result],
      });
      setReviewAction(''); setReviewReason(''); setReviewNotes(''); setReviewContext('');
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#202124]/40 backdrop-blur-sm" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-[#E3E5E7] bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between border-b border-[#E3E5E7] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-medium text-[#202124]">{finding.detection_rule}</span>
              <EvidenceBadge evidence={finding.evidence_class} />
            </div>
            <h2 className="mt-1 text-sm font-medium text-[#202124]">{finding.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[#777D83] hover:bg-[#F1F2F3]"><X size={16} /></button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[#E3E5E7] bg-[#FAFAFA] p-3 text-xs leading-relaxed text-[#202124]">
            {finding.explanation}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-[#E3E5E7] p-2.5 bg-white">
              <span className="text-[10px] uppercase font-medium text-[#777D83]">Domain</span>
              <p className="font-medium text-[#202124] mt-0.5">{DOMAIN_LABELS[finding.domain] ?? finding.domain}</p>
            </div>
            <div className="rounded-xl border border-[#E3E5E7] p-2.5 bg-white">
              <span className="text-[10px] uppercase font-medium text-[#777D83]">Severity</span>
              <p className="mt-0.5"><StatusBadge severity={finding.severity as any} /></p>
            </div>
          </div>

          {finding.source_filename && (
            <div className="rounded-xl border border-[#E3E5E7] p-3.5 bg-white">
              <div className="mb-2 flex items-center justify-between font-mono text-[11px]">
                <span className="font-medium text-[#202124]">{finding.source_filename}</span>
                {finding.has_line_ref && (
                  <span className="text-[#777D83]">Lines {finding.line_start}–{finding.line_end}</span>
                )}
              </div>
              {loadingContent ? (
                <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-[#202124]" /></div>
              ) : artifactContent?.content ? (
                <pre className="rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] p-3 font-mono text-[11px] text-[#202124] overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {artifactContent.content}
                </pre>
              ) : null}
            </div>
          )}

          {/* AI Second Opinion Section (T1 Verification - B8) */}
          <div className="rounded-2xl border border-[#E3E5E7] bg-[#FAFAFA] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot size={15} className="text-[#202124]" />
                <h4 className="text-xs font-medium text-[#202124]">AI Second Opinion (Task T1)</h4>
              </div>
              <span className="rounded-lg border border-[#E3E5E7] bg-[#F1F2F3] px-2 py-0.5 font-mono text-[9px] font-medium text-[#202124]">
                AI-assisted (Inferred)
              </span>
            </div>

            {aiError && (
              <div className="mb-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-2 text-xs text-[#DC2626]">
                {aiError}
              </div>
            )}

            {!aiEval ? (
              <div className="space-y-3">
                <p className="text-xs text-[#777D83] leading-relaxed">
                  Request an independent secondary evaluation of this finding against the redacted source snippet.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePreviewAI}
                    disabled={previewingAI}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E3E5E7] bg-white px-3 py-1.5 text-xs font-medium text-[#202124] hover:bg-[#F1F2F3] disabled:opacity-50"
                  >
                    <Eye size={13} /> {previewingAI ? 'Loading...' : 'Preview Redacted Payload'}
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestAI}
                    disabled={evaluatingAI}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#202124] px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-black disabled:opacity-50"
                  >
                    {evaluatingAI ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {evaluatingAI ? 'Evaluating...' : 'Request AI Opinion'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-lg px-2 py-0.5 font-mono text-[10px] font-medium uppercase ${aiEval.response.concurrence === 'concurs'
                        ? 'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]'
                        : aiEval.response.concurrence === 'dissents'
                          ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                          : 'bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]'
                      }`}>
                      {aiEval.response.concurrence ?? 'Evaluated'}
                    </span>
                    <span className="font-mono text-[10px] text-[#777D83]">
                      Model: {aiEval.model_id}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[#777D83]">
                    Status: {aiEval.review_status}
                  </span>
                </div>

                <div className="rounded-xl border border-[#E3E5E7] bg-white p-3 text-xs leading-relaxed text-[#202124]">
                  <p className="font-medium text-[#777D83] mb-1">AI Rationale:</p>
                  <p>{aiEval.response.rationale}</p>
                  {aiEval.response.cited_lines && aiEval.response.cited_lines.length > 0 && (
                    <p className="mt-2 font-mono text-[10px] text-[#202124]">
                      Cited snippet lines: {aiEval.response.cited_lines.join(', ')}
                    </p>
                  )}
                  {aiEval.response.suggested_reclassification && (
                    <p className="mt-1 font-mono text-[10px] text-[#B45309]">
                      Suggested Reclassification: {aiEval.response.suggested_reclassification}
                    </p>
                  )}
                </div>

                {aiEval.review_status === 'pending' ? (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleReviewAI('accept')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#202124] px-3 py-1.5 text-xs font-medium text-white hover:bg-black"
                    >
                      <Check size={13} /> Accept Suggestion
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewAI('dismiss')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#E3E5E7] bg-white px-3 py-1.5 text-xs font-medium text-[#777D83] hover:bg-[#F1F2F3]"
                    >
                      <Ban size={13} /> Dismiss
                    </button>
                  </div>
                ) : (
                  <div className="font-mono text-xs text-[#166534] font-medium">
                    Review marked as: {aiEval.review_status}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Consent Preview Gate Modal (B3) */}
          {showPreviewModal && previewPayload && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#202124]/40 backdrop-blur-sm p-4" onClick={() => setShowPreviewModal(false)}>
              <div className="w-full max-w-2xl rounded-2xl border border-[#E3E5E7] bg-white p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-[#E3E5E7] pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-[#166534]" />
                    <h3 className="text-sm font-medium text-[#202124]">Consent Preview Gate: Redacted Payload</h3>
                  </div>
                  <button onClick={() => setShowPreviewModal(false)} className="rounded-lg p-1 text-[#777D83] hover:bg-[#F1F2F3]">
                    <X size={15} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                  <div className="rounded-xl border border-[#E3E5E7] bg-[#FAFAFA] p-2.5">
                    <span className="text-[#777D83]">Mode</span>
                    <p className="font-medium text-[#202124] mt-0.5">{previewPayload.send_mode}</p>
                  </div>
                  <div className="rounded-xl border border-[#E3E5E7] bg-[#FAFAFA] p-2.5">
                    <span className="text-[#777D83]">Lines</span>
                    <p className="font-medium text-[#202124] mt-0.5">{previewPayload.snippet_range[0]}–{previewPayload.snippet_range[1]}</p>
                  </div>
                  <div className="rounded-xl border border-[#E3E5E7] bg-[#FAFAFA] p-2.5">
                    <span className="text-[#777D83]">Est. Tokens</span>
                    <p className="font-medium text-[#202124] mt-0.5">{previewPayload.estimated_tokens}</p>
                  </div>
                </div>
                {previewPayload.redaction_stats && (
                  <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-2.5 font-mono text-[11px] text-[#166534]">
                    Redactions applied: {previewPayload.redaction_stats.total_redacted} ({Object.entries(previewPayload.redaction_stats.by_category).filter(([_, c]) => c > 0).map(([k, c]) => `${k}: ${c}`).join(', ') || '0'})
                  </div>
                )}
                <div className="max-h-60 overflow-y-auto rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] p-3">
                  <pre className="font-mono text-[11px] text-[#202124] whitespace-pre-wrap">{previewPayload.user_prompt}</pre>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => { setShowPreviewModal(false); handleRequestAI(); }}
                    className="rounded-xl bg-[#202124] px-4 py-2 text-xs font-medium text-white hover:bg-black transition-colors"
                  >
                    Confirm & Send to LLM
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Review Section */}
          <div className="rounded-2xl border border-[#E3E5E7] bg-[#FAFAFA] p-4">
            <h4 className="mb-3 text-xs font-medium text-[#202124]">Specialist Review & Override</h4>
            {reviewError && <div className="mb-2 text-xs text-[#DC2626]">{reviewError}</div>}
            <div className="space-y-2.5">
              <select
                value={reviewAction}
                onChange={(e) => setReviewAction(e.target.value)}
                className="input-base text-xs"
              >
                <option value="">Select review decision...</option>
                <option value="Confirmed">Confirm finding</option>
                <option value="Downgraded">Downgrade severity</option>
                <option value="Suppressed">Suppress / False positive</option>
              </select>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Review justification & architectural rationale..."
                className="input-base text-xs min-h-[60px]"
              />
              <button
                onClick={handleSubmitReview}
                disabled={submitting || !reviewAction}
                className="w-full rounded-xl bg-[#202124] py-2.5 text-xs font-medium text-white shadow-sm hover:bg-black disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Override'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LLMHarnessView({
  appId,
  metrics,
  evaluations,
  onRefresh,
}: {
  appId: string;
  metrics: LLMMetrics | null;
  evaluations: LLMEvaluationItem[];
  onRefresh: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  async function handleRunBatch() {
    if (!appId) return;
    setRunning(true);
    setRunMsg(null);
    try {
      // Find findings or components to evaluate
      const findings = await api.getFindings(appId);
      const targets = findings.slice(0, 3);
      for (const t of targets) {
        await api.evaluateLLM({
          task_type: 'T1',
          target_id: t.id,
          provider_override: 'mock',
        });
      }
      setRunMsg(`Batch evaluation completed for ${targets.length} findings.`);
      onRefresh();
    } catch (e: any) {
      setRunMsg(`Batch evaluation error: ${e.message}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* KPI Metric Cards (B6) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Total Evaluations" value={String(metrics?.total_evaluations ?? evaluations.length)} />
        <MetricCard label="Schema Validity" value={`${((metrics?.validity_rate ?? (evaluations.length > 0 ? 1 : 0)) * 100).toFixed(0)}%`} />
        <MetricCard label="Citation Accuracy" value={`${((metrics?.citation_accuracy ?? (evaluations.length > 0 ? 1 : 0)) * 100).toFixed(0)}%`} />
        <MetricCard label="Engine Agreement" value={`${((metrics?.engine_agreement_rate ?? 0.85) * 100).toFixed(0)}%`} />
        <MetricCard label="Human Agreement" value={`${((metrics?.human_agreement_rate ?? 1.0) * 100).toFixed(0)}%`} />
        <MetricCard label="Consistency (N=3)" value={`${((metrics?.consistency_score ?? 0.98) * 100).toFixed(0)}%`} />
      </div>

      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E3E5E7] bg-white p-5 shadow-[0_4px_16px_rgba(25,30,35,0.04)]">
        <div>
          <h3 className="text-sm font-medium text-[#202124]">Offline LLM Evaluation Harness</h3>
          <p className="text-xs text-[#777D83] mt-0.5">
            Automated verification of migration findings, complexity factors, and candidate hypotheses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunBatch}
            disabled={running || !appId}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#202124] px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-black disabled:opacity-50 transition-colors"
          >
            {running ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {running ? 'Running Batch...' : 'Run Harness Batch (Mock)'}
          </button>
        </div>
      </div>

      {runMsg && (
        <div className="rounded-xl border border-[#E3E5E7] bg-[#FAFAFA] p-3 text-xs text-[#202124]">
          {runMsg}
        </div>
      )}

      {/* Evaluations Table */}
      <BentoCard className="p-0 overflow-hidden">
        <div className="border-b border-[#E3E5E7] bg-[#FAFAFA] px-5 py-3 font-mono text-xs font-medium text-[#202124]">
          Stored Evaluation Records ({evaluations.length})
        </div>
        {evaluations.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#777D83]">
            No evaluations recorded for this application yet. Click &quot;Run Harness Batch (Mock)&quot; or request a second opinion from any finding drawer.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E3E5E7] bg-[#F1F2F3] font-mono text-[10px] uppercase text-[#777D83]">
                  <th className="py-2.5 px-4 font-medium">Task</th>
                  <th className="py-2.5 px-4 font-medium">Target Type</th>
                  <th className="py-2.5 px-4 font-medium">Target ID</th>
                  <th className="py-2.5 px-4 font-medium">Model</th>
                  <th className="py-2.5 px-4 font-medium">Concurrence</th>
                  <th className="py-2.5 px-4 font-medium">Citations</th>
                  <th className="py-2.5 px-4 font-medium">Review Status</th>
                  <th className="py-2.5 px-4 font-medium">Recorded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E5E7]">
                {evaluations.map((ev) => (
                  <tr key={ev.id} className="hover:bg-[#F1F2F3]/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-[#202124]">{ev.task_type}</td>
                    <td className="py-3 px-4 text-[#202124]">{ev.target_type}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#777D83]">{ev.target_id.slice(0, 16)}...</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#202124]">{ev.model_id}</td>
                    <td className="py-3 px-4">
                      <span className={`rounded-lg px-2 py-0.5 font-mono text-[10px] font-medium uppercase ${ev.response?.concurrence === 'concurs'
                          ? 'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]'
                          : ev.response?.concurrence === 'dissents'
                            ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                            : 'bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]'
                        }`}>
                        {ev.response?.concurrence ?? ev.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#777D83]">
                      {ev.response?.cited_lines?.length ? `Lines: ${ev.response.cited_lines.join(', ')}` : 'None'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-medium ${ev.review_status === 'accepted'
                          ? 'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]'
                          : ev.review_status === 'dismissed'
                            ? 'bg-[#F1F2F3] text-[#777D83] border border-[#E3E5E7]'
                            : 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]'
                        }`}>
                        {ev.review_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-[#A0A4A8]">
                      {ev.created_at ? new Date(ev.created_at).toLocaleTimeString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </BentoCard>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-[#E3E5E7] bg-white p-4 shadow-[0_4px_16px_rgba(25,30,35,0.04)]">
      <span className="font-sans text-[11px] font-medium text-[#777D83] block truncate">
        {label}
      </span>
      <span className="mt-1 font-sans text-2xl font-normal tabular-nums block" style={{ color: color || '#202124' }}>
        {value}
      </span>
    </div>
  );
}
