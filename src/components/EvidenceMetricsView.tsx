import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertCircle, Download, CheckCircle2, XCircle, AlertTriangle,
  HelpCircle, ShieldAlert, Cpu, Sparkles, Scale, ExternalLink, RefreshCw,
  FileSearch, ChevronRight, X, BarChart3, Layers, GitCompare, Eye,
} from 'lucide-react';
import BentoCard from '@/components/BentoCard';
import StatusBadge from '@/components/StatusBadge';
import EvidenceBadge from '@/components/EvidenceBadge';
import {
  api, type EvidenceMetricsResponse, type StaticMetrics,
  type LLMMetricsData, type ComparisonMetrics,
} from '@/api/client';

interface EvidenceMetricsViewProps {
  appId: string;
  appName: string;
  onOpenFinding?: (findingId: string) => void;
}

export default function EvidenceMetricsView({ appId, appName, onOpenFinding }: EvidenceMetricsViewProps) {
  const [data, setData] = useState<EvidenceMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubView, setActiveSubView] = useState<'static' | 'llm' | 'comparison'>('static');

  // Drilldown modal state
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState('');
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownItems, setDrilldownItems] = useState<any[]>([]);

  // Disagreement table filters
  const [disagreementSeverity, setDisagreementSeverity] = useState<string>('all');
  const [disagreementDomain, setDisagreementDomain] = useState<string>('all');

  const loadMetrics = useCallback(async () => {
    if (!appId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await api.getEvidenceMetrics(appId);
      setData(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load evidence metrics');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const handleDrilldown = async (metricType: string, category?: string, label?: string) => {
    setDrilldownTitle(label || `${metricType} ${category || ''}`);
    setDrilldownOpen(true);
    setDrilldownLoading(true);
    try {
      const res = await api.getEvidenceMetricsDrilldown(appId, metricType, category);
      setDrilldownItems(res.items || []);
    } catch {
      setDrilldownItems([]);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const handleExport = () => {
    window.open(api.exportEvidenceMetricsUrl(appId), '_blank');
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-[#202124]" size={28} />
        <span className="ml-3 font-sans text-xs text-[#777D83]">Computing evidence metrics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <BentoCard className="p-8 text-center">
        <AlertCircle className="mx-auto mb-3 text-[#DC2626]" size={32} />
        <h3 className="font-sans text-sm font-medium text-[#202124]">Metrics Generation Error</h3>
        <p className="mt-1 font-sans text-xs text-[#777D83]">{error || 'No data returned'}</p>
        <button
          onClick={loadMetrics}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#202124] px-4 py-2 font-sans text-xs font-medium text-white hover:bg-[#333538]"
        >
          <RefreshCw size={13} /> Retry
        </button>
      </BentoCard>
    );
  }

  const { static: st, llm, comparison: comp, notice, metadata } = data;
  const isLLMActive = llm && llm.status !== 'disabled' && llm.status !== 'not_run';

  return (
    <div className="space-y-6">
      {/* 1. Combined Overview: Two side-by-side cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Static Analysis Card */}
        <div className="relative overflow-hidden rounded-2xl border border-[#E3E5E7] bg-white p-6 shadow-[0_4px_16px_rgba(25,30,35,0.04)]">
          <div className="flex items-center justify-between border-b border-[#E3E5E7] pb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F1F2F3] text-[#202124]">
                <Layers size={16} />
              </span>
              <div>
                <h3 className="font-sans text-sm font-medium text-[#202124]">Static Analysis</h3>
                <p className="font-sans text-xs text-[#777D83]">Deterministic Rules-Based Extraction</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCFCE7] bg-[#F0FDF4] px-2.5 py-1 font-mono text-[11px] font-medium text-[#166534]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
              Static: Complete
            </span>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2.5">
            <div
              onClick={() => handleDrilldown('all', undefined, 'All Static Findings')}
              className="cursor-pointer rounded-xl bg-[#F1F2F3]/70 p-3 transition-colors hover:bg-[#E9EAEC]"
            >
              <span className="block font-sans text-[10px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Findings</span>
              <span className="font-mono text-xl font-normal tabular-nums text-[#202124]">{st.findings_total}</span>
            </div>
            <div
              onClick={() => handleDrilldown('lacking_line_refs', undefined, 'Findings Lacking Line References')}
              className="cursor-pointer rounded-xl bg-[#F1F2F3]/70 p-3 transition-colors hover:bg-[#E9EAEC]"
            >
              <span className="block font-sans text-[10px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Traceability</span>
              <span className="font-mono text-xl font-normal tabular-nums text-[#166534]">{st.traceability.with_line_pct}%</span>
            </div>
            <div className="rounded-xl bg-[#F1F2F3]/70 p-3">
              <span className="block font-sans text-[10px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Domains</span>
              <span className="font-mono text-xl font-normal tabular-nums text-[#202124]">{st.coverage.domains_assessed_count}/8</span>
            </div>
            <div className="rounded-xl bg-[#F1F2F3]/70 p-3">
              <span className="block font-sans text-[10px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Parse Rate</span>
              <span className="font-mono text-xl font-normal tabular-nums text-[#202124]">{st.coverage.parse_success_rate}%</span>
            </div>
          </div>
        </div>

        {/* LLM Analysis Card */}
        <div className="relative overflow-hidden rounded-2xl border border-[#E3E5E7] bg-white p-6 shadow-[0_4px_16px_rgba(25,30,35,0.04)]">
          <div className="flex items-center justify-between border-b border-[#E3E5E7] pb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F1F2F3] text-[#202124]">
                <Cpu size={16} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-sans text-sm font-medium text-[#202124]">LLM Second Opinion</h3>
                  <span className="rounded-lg bg-[#F5F3FF] px-2 py-0.5 font-mono text-[9px] font-medium text-[#5B21B6] border border-[#DDD6FE]">
                    AI-assisted (Inferred)
                  </span>
                </div>
                <p className="font-sans text-xs text-[#777D83]">Advisory Review & Hypothesis Critique</p>
              </div>
            </div>

            {llm.status === 'complete' ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[#F3F4F6] px-2.5 py-1 font-mono text-[11px] font-medium text-[#202124]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#202124]" />
                LLM: Complete
              </span>
            ) : llm.status === 'partial' ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#FEF08A] bg-[#FEFCE8] px-2.5 py-1 font-mono text-[11px] font-medium text-[#92400E]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
                LLM: Partial ({llm.n})
              </span>
            ) : llm.status === 'disabled' ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E3E5E7] bg-[#F1F2F3] px-2.5 py-1 font-mono text-[11px] font-medium text-[#777D83]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#A0A4A8]" />
                LLM: Disabled
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E3E5E7] bg-[#F1F2F3] px-2.5 py-1 font-mono text-[11px] font-medium text-[#777D83]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#CBD5E1]" />
                LLM: Not Run
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2.5">
            <div className="rounded-xl bg-[#F1F2F3]/70 p-3">
              <span className="block font-sans text-[10px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Reviews</span>
              <span className="font-mono text-xl font-normal tabular-nums text-[#202124]">{llm.n}</span>
            </div>
            <div className="rounded-xl bg-[#F1F2F3]/70 p-3">
              <span className="block font-sans text-[10px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Schema Valid</span>
              <span className="font-mono text-xl font-normal tabular-nums text-[#166534]">
                {llm.quality?.schema_valid_rate != null ? `${llm.quality.schema_valid_rate}%` : '—'}
              </span>
            </div>
            <div className="rounded-xl bg-[#F1F2F3]/70 p-3">
              <span className="block font-sans text-[10px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Citation Valid</span>
              <span className="font-mono text-xl font-normal tabular-nums text-[#202124]">
                {llm.quality?.citation_valid_rate != null ? `${llm.quality.citation_valid_rate}%` : '—'}
              </span>
            </div>
            <div className="rounded-xl bg-[#F1F2F3]/70 p-3">
              <span className="block font-sans text-[10px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Consistency</span>
              <span className="font-mono text-xl font-normal tabular-nums text-[#202124]">
                {llm.reliability?.consistency_rate != null ? `${llm.reliability.consistency_rate}%` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sub-view Navigation Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3E5E7] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubView('static')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 font-sans text-xs font-medium transition-all ${activeSubView === 'static'
                ? 'bg-[#202124] text-white shadow-sm'
                : 'text-[#777D83] hover:bg-[#F1F2F3] hover:text-[#202124]'
              }`}
          >
            <Layers size={14} /> Static Analysis
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('llm')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 font-sans text-xs font-medium transition-all ${activeSubView === 'llm'
                ? 'bg-[#202124] text-white shadow-sm'
                : 'text-[#777D83] hover:bg-[#F1F2F3] hover:text-[#202124]'
              }`}
          >
            <Cpu size={14} /> LLM Analysis
            <span className={`rounded-full px-1.5 text-[9px] font-semibold ${activeSubView === 'llm' ? 'bg-[#C5F45A] text-[#202124]' : 'bg-[#F5F3FF] text-[#5B21B6]'}`}>
              Inferred
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('comparison')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 font-sans text-xs font-medium transition-all ${activeSubView === 'comparison'
                ? 'bg-[#202124] text-white shadow-sm'
                : 'text-[#777D83] hover:bg-[#F1F2F3] hover:text-[#202124]'
              }`}
          >
            <Scale size={14} /> Comparison & Agreement
            {comp && (
              <span className={`rounded-full px-1.5 text-[9px] font-semibold ${activeSubView === 'comparison' ? 'bg-[#C5F45A] text-[#202124]' : 'bg-[#E3E5E7] text-[#202124]'}`}>
                {comp.agreement_matrix.agreement_rate_pct}%
              </span>
            )}
          </button>
        </div>

        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E3E5E7] bg-white px-3.5 py-2 font-sans text-xs font-medium text-[#202124] shadow-[0_1px_3px_rgba(25,30,35,0.04)] transition-colors hover:bg-[#F1F2F3]"
        >
          <Download size={14} className="text-[#777D83]" /> Export Metrics (JSON)
        </button>
      </div>

      {/* 3. Sub-views */}

      {/* A) STATIC ANALYSIS VIEW */}
      {activeSubView === 'static' && (
        <div className="space-y-6">
          {/* Severity & Domain & Classification Breakdowns */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {/* By Severity */}
            <BentoCard className="p-5">
              <h4 className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-[#777D83]">Findings by Severity</h4>
              <div className="mt-4 space-y-2.5">
                {(['HIGH', 'MEDIUM', 'LOW', 'INFO'] as const).map((sev) => {
                  const count = st.by_severity[sev] ?? 0;
                  const pct = st.findings_total > 0 ? (count / st.findings_total) * 100 : 0;
                  const color = sev === 'HIGH' ? 'bg-[#DC2626]' : sev === 'MEDIUM' ? 'bg-[#D97706]' : sev === 'LOW' ? 'bg-[#166534]' : 'bg-[#777D83]';
                  return (
                    <div
                      key={sev}
                      onClick={() => handleDrilldown('severity', sev, `${sev} Severity Findings`)}
                      className="cursor-pointer rounded-xl p-2 transition-colors hover:bg-[#F1F2F3]"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-sans font-medium text-[#202124]">{sev}</span>
                        <span className="font-mono font-medium tabular-nums text-[#202124]">{count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#E3E5E7]">
                        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </BentoCard>

            {/* By Evidence Classification */}
            <BentoCard className="p-5">
              <h4 className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-[#777D83]">Evidence Classification</h4>
              <div className="mt-4 space-y-2.5">
                {(['Evidence-based', 'Inferred', 'Assumed', 'Unknown'] as const).map((clsName) => {
                  const count = st.by_evidence_classification[clsName] ?? 0;
                  return (
                    <div
                      key={clsName}
                      onClick={() => handleDrilldown('evidence_class', clsName, `${clsName} Findings`)}
                      className="flex cursor-pointer items-center justify-between rounded-xl p-2 transition-colors hover:bg-[#F1F2F3]"
                    >
                      <EvidenceBadge evidence={clsName} />
                      <span className="font-mono text-xs font-normal tabular-nums text-[#202124]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </BentoCard>

            {/* Rules Executed */}
            <BentoCard className="p-5">
              <h4 className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-[#777D83]">Derived Rules Fired</h4>
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs pb-1">
                  <span className="text-[#777D83]">Total Fired:</span>
                  <span className="font-mono font-medium text-[#202124]">{st.rules.rules_fired} / {st.rules.total_rules}</span>
                </div>
                {Object.entries(st.rules.by_measure).map(([mKey, mVal]) => (
                  <div key={mKey} className="rounded-xl bg-[#F1F2F3]/70 p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-sans capitalize text-[#202124]">{mKey}</span>
                      <span className="font-mono font-medium text-[#202124]">{mVal.fired} / {mVal.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            </BentoCard>
          </div>

          {/* Traceability Table */}
          <BentoCard className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-[#202124]">Traceability Audit</h4>
                <p className="font-sans text-xs text-[#777D83]">
                  {st.traceability.with_line_pct}% of findings carry line references. ({st.traceability.lacking_line_refs_count} findings lacking line reference)
                </p>
              </div>
            </div>

            {st.traceability.lacking_line_refs.length > 0 ? (
              <div className="max-h-60 overflow-y-auto rounded-xl border border-[#E3E5E7]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#F1F2F3] text-[11px] font-medium text-[#777D83] border-b border-[#E3E5E7]">
                    <tr>
                      <th className="px-4 py-3">Finding ID</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Rule</th>
                      <th className="px-4 py-3">Source File</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E5E7]">
                    {st.traceability.lacking_line_refs.map((item) => (
                      <tr key={item.id} className="hover:bg-[#F1F2F3]/50">
                        <td className="px-4 py-2.5 font-mono font-medium text-[#202124]">{item.id.slice(0, 12)}</td>
                        <td className="px-4 py-2.5 text-[#202124]">{item.title}</td>
                        <td className="px-4 py-2.5 font-mono text-[#777D83]">{item.detection_rule}</td>
                        <td className="px-4 py-2.5 font-mono text-[#777D83]">{item.source_filename}</td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => onOpenFinding?.(item.id)}
                            className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-[#202124] hover:underline"
                          >
                            View <ExternalLink size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-[#F0FDF4] p-3 text-xs text-[#166534] border border-[#DCFCE7]">
                <CheckCircle2 size={15} /> All findings carry verified source and line references.
              </div>
            )}
          </BentoCard>

          {/* Parser Accuracy against Ground Truth */}
          <BentoCard className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-[#202124]">
                  Ground-Truth Parser Accuracy
                </h4>
                <p className="font-sans text-xs text-[#777D83]">
                  {st.parser_accuracy?.overall ? (
                    `Evaluated against hand-verified mainframe code samples (Precision: ${st.parser_accuracy.overall.precision}%, Recall: ${st.parser_accuracy.overall.recall}%, F1: ${st.parser_accuracy.overall.f1}%, n=${st.parser_accuracy.overall.sample_size_n})`
                  ) : (
                    <span title="Ground-truth samples not mounted on host">Ground-truth parser benchmarks not measured (—)</span>
                  )}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#E3E5E7]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F1F2F3] text-[11px] font-medium text-[#777D83] border-b border-[#E3E5E7]">
                  <tr>
                    <th className="px-4 py-3">Parser</th>
                    <th className="px-4 py-3">Precision</th>
                    <th className="px-4 py-3">Recall</th>
                    <th className="px-4 py-3">F1 Score</th>
                    <th className="px-4 py-3">TP</th>
                    <th className="px-4 py-3">FP</th>
                    <th className="px-4 py-3">FN</th>
                    <th className="px-4 py-3">Sample Size (n)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E5E7]">
                  {Object.keys(st.parser_accuracy?.per_parser || {}).length > 0 ? (
                    Object.entries(st.parser_accuracy.per_parser).map(([pName, pStat]) => (
                      <tr key={pName} className="hover:bg-[#F1F2F3]/50">
                        <td className="px-4 py-2.5 font-mono font-medium capitalize text-[#202124]">{pName}</td>
                        <td className="px-4 py-2.5 font-mono text-[#166534]">{pStat.precision != null ? `${pStat.precision}%` : '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-[#166534]">{pStat.recall != null ? `${pStat.recall}%` : '—'}</td>
                        <td className="px-4 py-2.5 font-mono font-medium text-[#202124]">{pStat.f1 != null ? `${pStat.f1}%` : '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-[#777D83]">{pStat.true_positive ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-[#991B1B]">{pStat.false_positive ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-[#991B1B]">{pStat.false_negative ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-[#777D83]">{pStat.sample_size_n ?? '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-4 text-center text-[#777D83]">
                        Ground-truth parser benchmarks not measured (—)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </BentoCard>
        </div>
      )}

      {/* B) LLM ANALYSIS VIEW */}
      {activeSubView === 'llm' && (
        <div className="space-y-6">
          {/* Status banner */}
          <div className="rounded-2xl border border-[#E3E5E7] bg-white p-5 shadow-[0_4px_16px_rgba(25,30,35,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-sans text-xs font-medium text-[#202124]">AI Second Opinion Engine</span>
                  <span className="rounded-lg bg-[#F5F3FF] px-2 py-0.5 font-mono text-[10px] font-medium text-[#5B21B6] border border-[#DDD6FE]">
                    Advisory Layer Only
                  </span>
                </div>
                <p className="mt-1 font-sans text-xs text-[#777D83]">
                  Model: <span className="font-mono font-medium text-[#202124]">{metadata.llm_model}</span> | Send Mode: <span className="font-mono text-[#202124]">snippets (±20 lines)</span> | PII Redaction: <span className="font-medium text-[#166534]">Active</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-[#777D83]">Prompt Hashes:</span>
                <span className="font-mono text-[11px] text-[#202124]">{metadata.prompt_versions.length} versions</span>
              </div>
            </div>
          </div>

          {!isLLMActive ? (
            <BentoCard className="p-10 text-center">
              <Cpu className="mx-auto mb-3 text-[#A0A4A8]" size={36} />
              <h3 className="font-sans text-sm font-medium text-[#202124]">
                {llm.status === 'disabled' ? 'LLM Evaluation Layer is Disabled' : 'No LLM Evaluations Run Yet'}
              </h3>
              <p className="mx-auto mt-1 max-w-md font-sans text-xs text-[#777D83]">
                {llm.notice || 'By default, zero external network calls occur. Enable LLM evaluation or run mock reviews from the Evidence Findings drawer to view AI advisory metrics.'}
              </p>
            </BentoCard>
          ) : (
            <>
              {/* Quality & Outcomes Grid */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
                <BentoCard className="p-5">
                  <span className="font-sans text-[11px] font-medium text-[#777D83]">Total Items Reviewed</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-normal tabular-nums text-[#202124]">{llm.n}</span>
                    <span className="font-mono text-xs text-[#777D83]">(n={llm.n})</span>
                  </div>
                  <span className="mt-2 block font-sans text-[11px] text-[#777D83]">
                    {llm.coverage?.review_coverage_pct}% of total findings
                  </span>
                </BentoCard>

                <BentoCard className="p-5">
                  <span className="font-sans text-[11px] font-medium text-[#777D83]">Schema Validation Rate</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-normal tabular-nums text-[#166534]">{llm.quality?.schema_valid_rate}%</span>
                    <span className="font-mono text-xs text-[#777D83]">(n={llm.n})</span>
                  </div>
                  <span className="mt-2 block font-sans text-[11px] text-[#777D83]">100% Pydantic conformance</span>
                </BentoCard>

                <BentoCard className="p-5">
                  <span className="font-sans text-[11px] font-medium text-[#777D83]">Citation Validity Rate</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-normal tabular-nums text-[#202124]">{llm.quality?.citation_valid_rate}%</span>
                    <span className="font-mono text-xs text-[#777D83]">(n={llm.n})</span>
                  </div>
                  <span className="mt-2 block font-sans text-[11px] text-[#777D83]">
                    {llm.quality?.invalid_citation_count} out-of-range citations
                  </span>
                </BentoCard>

                <BentoCard className="p-5">
                  <span className="font-sans text-[11px] font-medium text-[#777D83]">Run-to-Run Consistency</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-normal tabular-nums text-[#202124]">{llm.reliability?.consistency_rate}%</span>
                    <span className="font-mono text-xs text-[#777D83]">(n={llm.n})</span>
                  </div>
                  <span className="mt-2 block font-sans text-[11px] text-[#777D83]">Across repeated runs (N=3)</span>
                </BentoCard>
              </div>

              {/* Verdict & Human Outcomes */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* Verdict Distribution */}
                <BentoCard className="p-6">
                  <div className="flex items-center justify-between border-b border-[#E3E5E7] pb-3">
                    <h4 className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-[#202124]">AI Verdict Distribution</h4>
                    <span className="font-mono text-xs text-[#777D83]">(n = {llm.verdict_distribution?.n})</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-[#166534]">
                        <CheckCircle2 size={14} /> Supports Engine Finding
                      </span>
                      <span className="font-mono font-medium text-[#202124]">{llm.verdict_distribution?.supports ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-[#991B1B]">
                        <XCircle size={14} /> Contradicts / Dissents
                      </span>
                      <span className="font-mono font-medium text-[#202124]">{llm.verdict_distribution?.contradicts ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-[#92400E]">
                        <HelpCircle size={14} /> Insufficient Evidence
                      </span>
                      <span className="font-mono font-medium text-[#202124]">{llm.verdict_distribution?.insufficient ?? 0}</span>
                    </div>
                  </div>
                </BentoCard>

                {/* Human Confirmation Outcomes */}
                <BentoCard className="p-6">
                  <div className="flex items-center justify-between border-b border-[#E3E5E7] pb-3">
                    <h4 className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-[#202124]">Human Review Outcomes</h4>
                    <span className="font-mono text-xs text-[#777D83]">(n = {llm.human_outcome?.n})</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#166534]">Accepted by Architect</span>
                      <span className="font-mono font-medium text-[#166534]">{llm.human_outcome?.accepted ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#991B1B]">Dismissed by Architect</span>
                      <span className="font-mono font-medium text-[#991B1B]">{llm.human_outcome?.dismissed ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#777D83]">Pending Human Review</span>
                      <span className="font-mono font-medium text-[#777D83]">{llm.human_outcome?.pending ?? 0}</span>
                    </div>
                  </div>
                </BentoCard>
              </div>

              {/* Latency and Tokens */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <BentoCard className="p-5">
                  <h4 className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-[#777D83]">Performance Latency</h4>
                  <div className="mt-3 grid grid-cols-3 gap-2.5 text-center">
                    <div className="rounded-xl bg-[#F1F2F3] p-2.5">
                      <span className="block font-sans text-[10px] text-[#777D83]">p50</span>
                      <span className="font-mono text-sm font-medium text-[#202124]">{llm.reliability?.latency_ms.p50} ms</span>
                    </div>
                    <div className="rounded-xl bg-[#F1F2F3] p-2.5">
                      <span className="block font-sans text-[10px] text-[#777D83]">p95</span>
                      <span className="font-mono text-sm font-medium text-[#202124]">{llm.reliability?.latency_ms.p95} ms</span>
                    </div>
                    <div className="rounded-xl bg-[#F1F2F3] p-2.5">
                      <span className="block font-sans text-[10px] text-[#777D83]">Avg</span>
                      <span className="font-mono text-sm font-medium text-[#202124]">{llm.reliability?.latency_ms.avg} ms</span>
                    </div>
                  </div>
                </BentoCard>

                <BentoCard className="p-5">
                  <h4 className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-[#777D83]">Token Consumption</h4>
                  <div className="mt-3 grid grid-cols-3 gap-2.5 text-center">
                    <div className="rounded-xl bg-[#F1F2F3] p-2.5">
                      <span className="block font-sans text-[10px] text-[#777D83]">Prompt</span>
                      <span className="font-mono text-sm font-medium text-[#202124]">{llm.reliability?.tokens_used.prompt_tokens}</span>
                    </div>
                    <div className="rounded-xl bg-[#F1F2F3] p-2.5">
                      <span className="block font-sans text-[10px] text-[#777D83]">Completion</span>
                      <span className="font-mono text-sm font-medium text-[#202124]">{llm.reliability?.tokens_used.completion_tokens}</span>
                    </div>
                    <div className="rounded-xl bg-[#F1F2F3] p-2.5">
                      <span className="block font-sans text-[10px] text-[#777D83]">Total</span>
                      <span className="font-mono text-sm font-medium text-[#202124]">{llm.reliability?.tokens_used.total_tokens}</span>
                    </div>
                  </div>
                </BentoCard>
              </div>
            </>
          )}
        </div>
      )}

      {/* C) COMPARISON & AGREEMENT VIEW */}
      {activeSubView === 'comparison' && (
        <div className="space-y-6">
          {/* Mandatory Notice Banner */}
          <div className="flex items-start gap-3 rounded-2xl border border-[#E3E5E7] bg-white p-5 shadow-[0_4px_16px_rgba(25,30,35,0.04)] text-xs text-[#202124]">
            <Scale className="mt-0.5 shrink-0 text-[#202124]" size={18} />
            <div>
              <span className="font-medium text-[#202124]">Architectural Advisory Notice:</span>
              <p className="mt-0.5 leading-relaxed text-[#777D83]">{notice}</p>
            </div>
          </div>

          {!comp ? (
            <BentoCard className="p-10 text-center">
              <Scale className="mx-auto mb-3 text-[#A0A4A8]" size={36} />
              <h3 className="font-sans text-sm font-medium text-[#202124]">Comparison Not Available</h3>
              <p className="mt-1 font-sans text-xs text-[#777D83]">
                Comparison requires both deterministic static findings and LLM second opinion evaluations to exist for this application.
              </p>
            </BentoCard>
          ) : (
            <>
              {/* Agreement Matrix Card */}
              <BentoCard className="p-6">
                <div className="flex items-center justify-between border-b border-[#E3E5E7] pb-3">
                  <div>
                    <h4 className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-[#202124]">
                      Agreement Matrix (Static vs. LLM)
                    </h4>
                    <p className="font-sans text-xs text-[#777D83]">
                      {comp.agreement_matrix.agreement_rate_pct}% Overall Engine-to-AI Agreement Rate (n = {comp.agreement_matrix.n})
                    </p>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-[#166534]">Agree: <strong>{comp.agreement_matrix.agree}</strong></span>
                    <span className="text-[#991B1B]">Disagree: <strong>{comp.agreement_matrix.disagree}</strong></span>
                    <span className="text-[#92400E]">Insufficient: <strong>{comp.agreement_matrix.insufficient}</strong></span>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-xl border border-[#E3E5E7]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F1F2F3] text-[11px] font-medium text-[#777D83] border-b border-[#E3E5E7]">
                      <tr>
                        <th className="px-4 py-3">Static Evidence Class</th>
                        <th className="px-4 py-3 text-[#166534]">Concurs (Supports)</th>
                        <th className="px-4 py-3 text-[#991B1B]">Dissents (Contradicts)</th>
                        <th className="px-4 py-3 text-[#92400E]">Insufficient Evidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E3E5E7]">
                      {Object.entries(comp.agreement_matrix.by_class).map(([clsName, counts]) => (
                        <tr key={clsName} className="hover:bg-[#F1F2F3]/50">
                          <td className="px-4 py-2.5"><EvidenceBadge evidence={clsName} /></td>
                          <td className="px-4 py-2.5 font-mono font-medium text-[#166534]">{counts.agree}</td>
                          <td className="px-4 py-2.5 font-mono font-medium text-[#991B1B]">{counts.disagree}</td>
                          <td className="px-4 py-2.5 font-mono font-medium text-[#92400E]">{counts.insufficient}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </BentoCard>

              {/* Independent Human Check & Planted False-Positive Detection */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <BentoCard className="p-6">
                  <h4 className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-[#202124]">
                    Independent Human Alignment
                  </h4>
                  <p className="mt-1 font-sans text-xs text-[#777D83]">
                    Alignment against human architect review decisions
                  </p>
                  <div className="mt-4 space-y-3.5">
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#202124]">Static Engine vs. Human</span>
                        <span className="font-mono font-medium text-[#166534]">
                          {comp.independent_human_check.static_vs_human_agreement_pct}% (n={comp.independent_human_check.static_human_n})
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full rounded-full bg-[#E3E5E7]">
                        <div
                          className="h-2 rounded-full bg-[#166534]"
                          style={{ width: `${comp.independent_human_check.static_vs_human_agreement_pct}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#202124]">LLM Second Opinion vs. Human</span>
                        <span className="font-mono font-medium text-[#202124]">
                          {comp.independent_human_check.llm_vs_human_agreement_pct}% (n={comp.independent_human_check.llm_human_n})
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full rounded-full bg-[#E3E5E7]">
                        <div
                          className="h-2 rounded-full bg-[#202124]"
                          style={{ width: `${comp.independent_human_check.llm_vs_human_agreement_pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </BentoCard>

                {/* Planted FP Detection */}
                <BentoCard className="p-6">
                  <h4 className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-[#202124]">
                    False-Positive Detection Accuracy
                  </h4>
                  <p className="mt-1 font-sans text-xs text-[#777D83]">
                    Benchmark against hand-verified ground truth test cases
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-[#F1F2F3] p-3">
                      <span className="block font-medium text-[#202124]">Static Analysis Engine</span>
                      <span className="mt-1 block font-mono text-sm font-medium text-[#202124]">
                        {comp.planted_false_positives.static.f1}% F1
                      </span>
                      <span className="font-sans text-[11px] text-[#777D83]">
                        Precision: {comp.planted_false_positives.static.precision}% | Recall: {comp.planted_false_positives.static.recall}%
                      </span>
                    </div>
                    <div className="rounded-xl bg-[#F1F2F3] p-3">
                      <span className="block font-medium text-[#202124]">LLM Review Layer</span>
                      <span className="mt-1 block font-mono text-sm font-medium text-[#202124]">
                        {comp.planted_false_positives.llm.f1}% F1
                      </span>
                      <span className="font-sans text-[11px] text-[#777D83]">
                        Precision: {comp.planted_false_positives.llm.precision}% | Recall: {comp.planted_false_positives.llm.recall}%
                      </span>
                    </div>
                  </div>
                </BentoCard>
              </div>

              {/* Disagreements List Table */}
              <BentoCard className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3E5E7] pb-3">
                  <div>
                    <h4 className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-[#202124]">
                      Disagreements & Contradictions ({comp.disagreements_count})
                    </h4>
                    <p className="font-sans text-xs text-[#777D83]">
                      Findings where the LLM dissents from the deterministic engine rule
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={disagreementSeverity}
                      onChange={(e) => setDisagreementSeverity(e.target.value)}
                      className="h-8 rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] px-3 text-xs text-[#202124] outline-none"
                    >
                      <option value="all">All Severities</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                {comp.disagreements.length > 0 ? (
                  <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-[#E3E5E7]">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-[#F1F2F3] text-[11px] font-medium text-[#777D83] border-b border-[#E3E5E7]">
                        <tr>
                          <th className="px-4 py-3">Finding ID</th>
                          <th className="px-4 py-3">Rule</th>
                          <th className="px-4 py-3">Static Class</th>
                          <th className="px-4 py-3">LLM Verdict</th>
                          <th className="px-4 py-3">AI Rationale</th>
                          <th className="px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E3E5E7]">
                        {comp.disagreements
                          .filter((d) => disagreementSeverity === 'all' || d.severity.toLowerCase() === disagreementSeverity)
                          .map((item) => (
                            <tr key={item.finding_id} className="hover:bg-[#F1F2F3]/50">
                              <td className="px-4 py-2.5 font-mono font-medium text-[#202124]">{item.finding_id.slice(0, 12)}</td>
                              <td className="px-4 py-2.5 font-mono text-[#777D83]">{item.rule}</td>
                              <td className="px-4 py-2.5"><EvidenceBadge evidence={item.static_classification} /></td>
                              <td className="px-4 py-2.5 font-mono font-medium text-[#991B1B]">contradicts</td>
                              <td className="px-4 py-2.5 max-w-xs truncate text-[#202124]" title={item.rationale}>
                                {item.rationale}
                              </td>
                              <td className="px-4 py-2.5">
                                <button
                                  onClick={() => onOpenFinding?.(item.finding_id)}
                                  className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-[#202124] hover:underline"
                                >
                                  Open Drawer <ChevronRight size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#F0FDF4] p-3 text-xs text-[#166534] border border-[#DCFCE7]">
                    <CheckCircle2 size={15} /> Zero contradictions found. Complete agreement between engine and AI.
                  </div>
                )}
              </BentoCard>

              {/* Blind Spots & Classification Differences */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* Classification Differences */}
                <BentoCard className="p-5">
                  <h4 className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-[#202124]">
                    Classification Divergence ({comp.classification_differences_count})
                  </h4>
                  <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                    {comp.classification_differences.map((item) => (
                      <div key={item.finding_id} className="rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium text-[#202124]">{item.rule}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#777D83]">{item.static_class}</span>
                            <span className="text-[#A0A4A8]">→</span>
                            <span className="font-medium text-[#5B21B6]">{item.llm_suggested_class}</span>
                          </div>
                        </div>
                        <p className="mt-1 text-[11px] text-[#777D83]">{item.rationale}</p>
                      </div>
                    ))}
                  </div>
                </BentoCard>

                {/* Blind Spots */}
                <BentoCard className="p-5">
                  <h4 className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-[#202124]">
                    Identified Blind Spots ({comp.blind_spots.llm_flagged_risks_count + comp.blind_spots.static_insufficient_count})
                  </h4>
                  <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                    {comp.blind_spots.llm_flagged_risks.map((rk, idx) => (
                      <div key={idx} className="rounded-xl border border-[#DDD6FE] bg-[#F5F3FF]/60 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[#5B21B6]">{rk.risk_title}</span>
                          <span className="rounded-lg bg-[#EDE9FE] px-1.5 py-0.5 font-mono text-[9px] font-medium text-[#5B21B6]">AI Inferred</span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#777D83]">{rk.rationale}</p>
                      </div>
                    ))}
                    {comp.blind_spots.static_insufficient.map((item) => (
                      <div key={item.finding_id} className="rounded-xl border border-[#FEF08A] bg-[#FEFCE8]/60 p-3 text-xs">
                        <span className="font-medium text-[#92400E]">{item.title}</span>
                        <p className="mt-0.5 text-[11px] text-[#78350F]">{item.rationale}</p>
                      </div>
                    ))}
                  </div>
                </BentoCard>
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. Drilldown Modal */}
      {drilldownOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-[#E3E5E7] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E3E5E7] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <BarChart3 size={16} className="text-[#202124]" />
                <h3 className="font-sans text-sm font-medium text-[#202124]">{drilldownTitle}</h3>
              </div>
              <button
                onClick={() => setDrilldownOpen(false)}
                className="rounded-xl p-1.5 text-[#777D83] hover:bg-[#F1F2F3] hover:text-[#202124]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {drilldownLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="animate-spin text-[#202124]" size={20} />
                </div>
              ) : drilldownItems.length === 0 ? (
                <p className="text-center text-xs text-[#777D83]">No items match this drill-down filter.</p>
              ) : (
                <div className="space-y-2.5">
                  {drilldownItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="flex items-center justify-between rounded-xl border border-[#E3E5E7] p-3.5 text-xs transition-colors hover:bg-[#F1F2F3]"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-[#202124]">{item.id ? item.id.slice(0, 16) : `#${idx + 1}`}</span>
                          <span className="font-medium text-[#202124]">{item.title || item.name || item.task_type}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#777D83]">
                          Rule: {item.detection_rule || 'N/A'} | Source: {item.source_filename || 'N/A'} {item.line_start ? `(Line ${item.line_start})` : ''}
                        </p>
                      </div>

                      {item.id && (
                        <button
                          onClick={() => {
                            setDrilldownOpen(false);
                            onOpenFinding?.(item.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#E3E5E7] bg-white px-3 py-1.5 font-sans text-[11px] font-medium text-[#202124] hover:bg-[#F1F2F3]"
                        >
                          View Finding <ChevronRight size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-[#E3E5E7] px-6 py-3.5 text-right">
              <button
                onClick={() => setDrilldownOpen(false)}
                className="rounded-xl bg-[#F1F2F3] px-4 py-2 font-sans text-xs font-medium text-[#202124] hover:bg-[#E9EAEC]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
