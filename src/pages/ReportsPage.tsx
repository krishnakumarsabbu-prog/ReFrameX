import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertCircle, X, FileText, Download, Printer,
  ChevronDown, ChevronRight, CheckCircle2, Info,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import StatusBadge from '@/components/StatusBadge';
import { api, type Application, type Report } from '@/api/client';

const REPORT_SECTIONS = [
  { key: 'executive_summary', label: 'Executive Summary' },
  { key: 'application_overview', label: 'Application Overview' },
  { key: 'artifact_inventory', label: 'Artifact Inventory' },
  { key: 'component_inventory', label: 'Component Inventory' },
  { key: 'dependency_analysis', label: 'Dependency Analysis' },
  { key: 'domain_assessments', label: 'Eight Domain Assessments' },
  { key: 'migration_complexity', label: 'Migration Complexity' },
  { key: 'assessment_confidence', label: 'Assessment Confidence' },
  { key: 'migration_readiness', label: 'Migration Readiness' },
  { key: 'major_risks', label: 'Major Risks' },
  { key: 'evidence_gaps', label: 'Evidence Gaps and Unsupported Artifacts' },
  { key: 'component_recommendations', label: 'Component Recommendations' },
  { key: 'refactoring_considerations', label: 'Refactoring Considerations' },
  { key: 'prioritized_next_steps', label: 'Prioritized Next Steps' },
  { key: 'parser_coverage_and_accuracy', label: 'Parser Coverage and Accuracy' },
  { key: 'automation_and_ai_statement', label: 'Automation and AI-Usage Statement' },
  { key: 'limitations_and_assumptions', label: 'Limitations and Assumptions' },
  { key: 'versions', label: 'Ruleset, Model and Parser Versions' },
  { key: 'reviewer_changes', label: 'Reviewer Changes' },
  { key: 'measured_metrics', label: 'Measured Business-Value Metrics' },
];

export default function ReportsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['executive_summary']));
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set(REPORT_SECTIONS.map((s) => s.key)));

  const loadApps = useCallback(async () => {
    try {
      const data = await api.listApplications();
      setApps(data);
      setActiveApp(data.find((a) => a.is_active) ?? data[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    }
  }, []);

  const loadReport = useCallback(async (appId: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.getReport(appId);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate report');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);
  useEffect(() => { if (activeApp) loadReport(activeApp.id); }, [activeApp, loadReport]);

  async function handleSelectApp(id: string) {
    try {
      await api.updateApplication(id, { is_active: true });
      await loadApps();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to select application');
    }
  }

  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSectionSelection(key: string) {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleExport(format: 'json' | 'html') {
    if (!activeApp) return;
    try {
      await api.exportReport(activeApp.id, format);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    }
  }

  function handlePrint() {
    window.print();
  }

  if (apps.length === 0 && !loading) {
    return (
      <>
        <PageHeader title="Assessment Reports" breadcrumb={['ReframeX', 'Reports']} />
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent"><FileText size={28} /></div>
          <h2 className="text-xl font-semibold text-ink mb-2">No applications to report</h2>
          <p className="text-ink-muted max-w-sm">Create an application, upload artifacts, and run an assessment to generate executive reports.</p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Assessment Reports"
        breadcrumb={['ReframeX', 'Reports']}
        action={
          <div className="flex items-center gap-2">
            {activeApp && (
              <div className="relative">
                <select
                  value={activeApp.id}
                  onChange={(e) => handleSelectApp(e.target.value)}
                  className="inner-glass rounded-pill px-3 py-1.5 pr-8 text-xs font-medium text-ink-muted appearance-none cursor-pointer hover:bg-white/35 transition-colors"
                >
                  {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
              </div>
            )}
            <button
              onClick={() => handleExport('json')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill inner-glass text-xs font-medium text-ink-muted hover:bg-white/35 transition-colors"
            >
              <Download size={13} /> JSON
            </button>
            <button
              onClick={() => handleExport('html')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill inner-glass text-xs font-medium text-ink-muted hover:bg-white/35 transition-colors"
            >
              <Download size={13} /> HTML
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
            >
              <Printer size={13} /> Print
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-tile bg-severity-high/10 text-severity-high text-sm">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 size={24} className="animate-spin" /></div>
      ) : report ? (
        <div className="space-y-4">
          <BentoCard className="p-4" dense>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-accent" />
                <div>
                  <div className="text-sm font-semibold text-ink">
                    {report.report_metadata.application_name}
                  </div>
                  <div className="text-xs text-ink-soft">
                    Generated {new Date(report.report_metadata.generated_at).toLocaleString()}
                    {report.report_metadata.assessment_version && ` | Assessment v${report.report_metadata.assessment_version}`}
                  </div>
                </div>
              </div>
              <StatusBadge
                status={report.executive_summary.has_assessment ? 'Assessed' : 'Not Assessed'}
              />
            </div>
          </BentoCard>

          <BentoCard className="p-4" dense>
            <div className="flex items-center gap-2 mb-3">
              <Info size={14} className="text-ink-soft" />
              <span className="text-xs font-semibold text-ink-muted">Report Sections — toggle to include in view</span>
              <button
                onClick={() => setSelectedSections(new Set(REPORT_SECTIONS.map((s) => s.key)))}
                className="ml-auto text-[10px] text-accent hover:underline"
              >Select all</button>
              <button
                onClick={() => setSelectedSections(new Set())}
                className="text-[10px] text-ink-soft hover:underline"
              >Clear</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {REPORT_SECTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => toggleSectionSelection(s.key)}
                  className={`px-2.5 py-1 rounded-pill text-[10px] font-medium transition-colors ${
                    selectedSections.has(s.key)
                      ? 'bg-accent/15 text-accent border border-accent/30'
                      : 'inner-glass text-ink-soft border border-transparent hover:bg-white/30'
                  }`}
                >
                  {selectedSections.has(s.key) && <CheckCircle2 size={10} className="inline mr-1" />}
                  {s.label}
                </button>
              ))}
            </div>
          </BentoCard>

          {REPORT_SECTIONS.filter((s) => selectedSections.has(s.key)).map((section) => {
            const data = (report as Record<string, any>)[section.key];
            const expanded = expandedSections.has(section.key);
            return (
              <BentoCard key={section.key} className="overflow-hidden" dense>
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/40 transition-colors"
                >
                  {expanded ? <ChevronDown size={14} className="text-ink-soft" /> : <ChevronRight size={14} className="text-ink-soft" />}
                  <h3 className="text-sm font-semibold text-ink">{section.label}</h3>
                </button>
                {expanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-solid-border/40">
                    <ReportSectionRenderer sectionKey={section.key} data={data} />
                  </div>
                )}
              </BentoCard>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

function ReportSectionRenderer({ sectionKey, data }: { sectionKey: string; data: any }) {
  if (data === null || data === undefined) {
    return <p className="text-xs text-ink-soft py-2">No data available for this section.</p>;
  }

  switch (sectionKey) {
    case 'executive_summary':
      return <ExecutiveSummaryView data={data as Report['executive_summary']} />;
    case 'application_overview':
      return <KeyValueView data={data as Record<string, any>} />;
    case 'artifact_inventory':
      return <InventoryView data={data as Record<string, any>} />;
    case 'component_inventory':
      return <InventoryView data={data as Record<string, any>} />;
    case 'dependency_analysis':
      return <DependencyView data={data as Record<string, any>} />;
    case 'domain_assessments':
      return <DomainView data={data as Record<string, any>} />;
    case 'migration_complexity':
    case 'assessment_confidence':
    case 'migration_readiness':
      return <MeasureView data={data as Record<string, any>} />;
    case 'major_risks':
      return <RisksView data={data as Record<string, any>} />;
    case 'evidence_gaps':
      return <EvidenceGapsView data={data as Record<string, any>} />;
    case 'component_recommendations':
      return <RecommendationsView data={data as Record<string, any>} />;
    case 'refactoring_considerations':
      return <ConsiderationsView data={data as Record<string, any>} />;
    case 'prioritized_next_steps':
      return <NextStepsView data={data as Record<string, any>} />;
    case 'parser_coverage_and_accuracy':
      return <ParserCoverageView data={data as Record<string, any>} />;
    case 'automation_and_ai_statement':
      return <KeyValueView data={data as Record<string, any>} />;
    case 'limitations_and_assumptions':
      return <LimitationsView data={data as Record<string, any>} />;
    case 'versions':
      return <VersionsView data={data as Record<string, any>} />;
    case 'reviewer_changes':
      return <ReviewerChangesView data={data as Record<string, any>} />;
    case 'measured_metrics':
      return <MeasuredMetricsView data={data as Record<string, any>} />;
    default:
      return <JsonFallback data={data} />;
  }
}

function KvRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex gap-3 py-1.5 text-xs">
      <span className="text-ink-soft font-medium min-w-[180px] shrink-0">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function DictTable({ data, keyLabel = 'Key', valLabel = 'Count' }: { data: Record<string, number>; keyLabel?: string; valLabel?: string }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <p className="text-xs text-ink-soft py-1">No data.</p>;
  return (
    <table className="w-full text-xs my-2">
      <thead><tr className="text-ink-soft"><th className="text-left py-1 font-medium">{keyLabel}</th><th className="text-right py-1 font-medium">{valLabel}</th></tr></thead>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-t border-solid-border/30">
            <td className="py-1 text-ink">{k}</td>
            <td className="py-1 text-right text-ink-muted">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExecutiveSummaryView({ data }: { data: Report['executive_summary'] }) {
  return (
    <div className="py-2">
      <KvRow label="Application" value={data.application_name} />
      <KvRow label="Complexity" value={data.complexity_score !== null ? `${data.complexity_score} — ${data.complexity_classification}` : 'Not assessed'} />
      <KvRow label="Confidence" value={data.confidence_score !== null ? `${data.confidence_score} — ${data.confidence_classification}` : 'Not assessed'} />
      <KvRow label="Readiness" value={data.readiness_score !== null ? `${data.readiness_score} — ${data.readiness_classification}` : 'Not assessed'} />
      <KvRow label="Artifacts" value={data.artifact_count} />
      <KvRow label="Components" value={data.component_count} />
      <KvRow label="Dependencies" value={data.dependency_count} />
      <KvRow label="Findings" value={data.finding_count} />
      <KvRow label="Unknown Evidence Items" value={data.unknown_evidence_count} />
      <KvRow label="High-Severity Findings" value={data.high_severity_finding_count} />
      <KvRow label="Assessment Version" value={data.assessment_version ?? 'N/A'} />
      <KvRow label="Computed At" value={data.computed_at ? new Date(data.computed_at).toLocaleString() : 'N/A'} />
      <div className="mt-2 p-2.5 rounded-tile bg-accent-soft/30 text-xs text-ink-muted">{data.note}</div>
    </div>
  );
}

function KeyValueView({ data }: { data: Record<string, any> }) {
  return (
    <div className="py-2">
      {Object.entries(data || {}).map(([k, v]) => (
        <KvRow key={k} label={k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} value={String(v)} />
      ))}
    </div>
  );
}

function InventoryView({ data }: { data: Record<string, any> }) {
  const d = data || {};
  return (
    <div className="py-2 space-y-3">
      <KvRow label="Total" value={d.total_artifacts ?? d.total_components ?? 'N/A'} />
      {d.by_category && <div><div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">By Category</div><DictTable data={d.by_category as Record<string, number>} /></div>}
      {d.by_type && <div><div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">By Type</div><DictTable data={d.by_type as Record<string, number>} /></div>}
      {d.by_technology && <div><div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">By Technology</div><DictTable data={d.by_technology as Record<string, number>} /></div>}
      {d.by_evidence_class && <div><div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">By Evidence Class</div><DictTable data={d.by_evidence_class as Record<string, number>} /></div>}
      {d.by_support_level && <div><div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">By Support Level</div><DictTable data={d.by_support_level as Record<string, number>} /></div>}
    </div>
  );
}

function DependencyView({ data }: { data: Record<string, any> }) {
  const d = data || {};
  return (
    <div className="py-2 space-y-3">
      <KvRow label="Total Dependencies" value={d.total_dependencies ?? 0} />
      <KvRow label="Unresolved Targets" value={d.unresolved_targets ?? 0} />
      {d.by_relationship_type && <DictTable data={d.by_relationship_type as Record<string, number>} keyLabel="Relationship Type" />}
    </div>
  );
}

function DomainView({ data }: { data: Record<string, any> }) {
  const domains = data as Record<string, { label: string; complexity: { score: number | null; classification: string }; confidence: { score: number | null; classification: string }; readiness: { score: number | null; classification: string } }>;
  if (!domains) return <p className="text-xs text-ink-soft py-2">No domain data.</p>;
  return (
    <table className="w-full text-xs my-2">
      <thead><tr className="text-ink-soft">
        <th className="text-left py-1 font-medium">Domain</th>
        <th className="text-center py-1 font-medium">Complexity</th>
        <th className="text-center py-1 font-medium">Confidence</th>
        <th className="text-center py-1 font-medium">Readiness</th>
      </tr></thead>
      <tbody>
        {Object.entries(domains).map(([key, d]) => (
          <tr key={key} className="border-t border-solid-border/30">
            <td className="py-1.5 text-ink">{d.label}</td>
            <td className="py-1.5 text-center text-ink-muted">{d.complexity?.score ?? 'N/A'} <span className="text-[10px]">({d.complexity?.classification})</span></td>
            <td className="py-1.5 text-center text-ink-muted">{d.confidence?.score ?? 'N/A'} <span className="text-[10px]">({d.confidence?.classification})</span></td>
            <td className="py-1.5 text-center text-ink-muted">{d.readiness?.score ?? 'N/A'} <span className="text-[10px]">({d.readiness?.classification})</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MeasureView({ data }: { data: Record<string, any> }) {
  const d = data || {};
  return (
    <div className="py-2">
      <KvRow label="Score" value={d.score ?? 'N/A'} />
      <KvRow label="Classification" value={d.classification ?? 'N/A'} />
      <KvRow label="Fired Rules" value={d.fired_rules_count ?? 0} />
      {Array.isArray(d.positive_factors) && d.positive_factors.length > 0 && (
        <div className="mt-2"><div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">Positive Factors</div><ul className="space-y-0.5">{(d.positive_factors as string[]).map((f, i) => <li key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-success shrink-0">+</span>{f}</li>)}</ul></div>
      )}
      {Array.isArray(d.negative_factors) && d.negative_factors.length > 0 && (
        <div className="mt-2"><div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">Negative Factors</div><ul className="space-y-0.5">{(d.negative_factors as string[]).map((f, i) => <li key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-severity-high shrink-0">-</span>{f}</li>)}</ul></div>
      )}
    </div>
  );
}

function RisksView({ data }: { data: Record<string, any> }) {
  const d = data || {};
  const high = (d.high_severity_risks as Array<Record<string, string>>) || [];
  const medium = (d.medium_severity_risks as Array<Record<string, string>>) || [];
  return (
    <div className="py-2 space-y-2">
      <div className="flex gap-4 text-xs">
        <span className="text-severity-high font-medium">High: {d.high_severity_count ?? 0}</span>
        <span className="text-severity-medium font-medium">Medium: {d.medium_severity_count ?? 0}</span>
      </div>
      {high.map((r, i) => (
        <div key={`h${i}`} className="p-2.5 rounded-tile bg-severity-high/8 border border-severity-high/20">
          <div className="text-xs font-medium text-ink">{r.title}</div>
          <div className="text-[11px] text-ink-muted mt-0.5">{r.explanation}</div>
        </div>
      ))}
      {medium.map((r, i) => (
        <div key={`m${i}`} className="p-2.5 rounded-tile bg-severity-medium/8 border border-severity-medium/20">
          <div className="text-xs font-medium text-ink">{r.title}</div>
          <div className="text-[11px] text-ink-muted mt-0.5">{r.explanation}</div>
        </div>
      ))}
      {high.length === 0 && medium.length === 0 && <p className="text-xs text-ink-soft">No risks identified.</p>}
    </div>
  );
}

function EvidenceGapsView({ data }: { data: Record<string, any> }) {
  const d = data || {};
  return (
    <div className="py-2 space-y-3">
      <KvRow label="Total Unknown Findings" value={d.total_unknown_findings ?? 0} />
      {d.by_type && <DictTable data={d.by_type as Record<string, number>} keyLabel="Finding Type" />}
      {Array.isArray(d.unsupported_artifacts) && d.unsupported_artifacts.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">Unsupported Artifacts</div>
          <ul className="space-y-0.5">
            {(d.unsupported_artifacts as Array<Record<string, string>>).map((a, i) => (
              <li key={i} className="text-xs text-ink-muted">{a.filename} ({a.category}, {a.support_level})</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RecommendationsView({ data }: { data: Record<string, any> }) {
  const d = data || {};
  return (
    <div className="py-2 space-y-2">
      <KvRow label="Total Recommendations" value={d.total ?? 0} />
      {d.by_category && <DictTable data={d.by_category as Record<string, number>} keyLabel="Category" />}
    </div>
  );
}

function ConsiderationsView({ data }: { data: Record<string, any> }) {
  const d = data || {};
  return (
    <div className="py-2 space-y-2">
      <KvRow label="Complexity" value={d.complexity_classification ?? 'N/A'} />
      <KvRow label="Readiness" value={d.readiness_classification ?? 'N/A'} />
      {Array.isArray(d.considerations) && (
        <ul className="space-y-0.5 mt-2">
          {(d.considerations as string[]).map((c, i) => <li key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-accent shrink-0">•</span>{c}</li>)}
        </ul>
      )}
    </div>
  );
}

function NextStepsView({ data }: { data: Record<string, any> }) {
  const d = data || {};
  const groups = (d.groups || {}) as Record<string, Array<Record<string, any>>>;
  return (
    <div className="py-2 space-y-3">
      <KvRow label="Total Items" value={d.total_items ?? 0} />
      {Object.entries(groups).map(([group, items]) => (
        <div key={group}>
          <div className="text-xs font-semibold text-ink mb-1">{group}</div>
          <ul className="space-y-0.5">
            {items.map((item, i) => (
              <li key={i} className="text-xs text-ink-muted flex gap-2">
                <span className="text-accent shrink-0 font-medium">[{item.priority}]</span>
                <span>{item.action}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ParserCoverageView({ data }: { data: Record<string, any> }) {
  const d = data || {};
  return (
    <div className="py-2 space-y-2">
      <KvRow label="Total Artifacts" value={d.total_artifacts ?? 0} />
      <KvRow label="Parsed" value={d.parsed_artifacts ?? 0} />
      <KvRow label="Unsupported" value={d.unsupported_artifacts ?? 0} />
      <KvRow label="Components Extracted" value={d.components_extracted ?? 0} />
      {d.note && <div className="mt-2 p-2.5 rounded-tile bg-accent-soft/30 text-xs text-ink-muted">{d.note as string}</div>}
    </div>
  );
}

function LimitationsView({ data }: { data: Record<string, any> }) {
  const d = data || {};
  return (
    <div className="py-2 space-y-3">
      {Array.isArray(d.assessment_limitations) && d.assessment_limitations.length > 0 && (
        <div><div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">Assessment Limitations</div><ul className="space-y-0.5">{(d.assessment_limitations as string[]).map((l, i) => <li key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-accent shrink-0">•</span>{l}</li>)}</ul></div>
      )}
      {Array.isArray(d.missing_information) && d.missing_information.length > 0 && (
        <div><div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">Missing Information</div><ul className="space-y-0.5">{(d.missing_information as string[]).map((l, i) => <li key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-severity-medium shrink-0">!</span>{l}</li>)}</ul></div>
      )}
      {Array.isArray(d.general_limitations) && (
        <div><div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">General Limitations</div><ul className="space-y-0.5">{(d.general_limitations as string[]).map((l, i) => <li key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-ink-soft shrink-0">•</span>{l}</li>)}</ul></div>
      )}
    </div>
  );
}

function VersionsView({ data }: { data: Record<string, any> }) {
  const d = data || {};
  return (
    <div className="py-2 space-y-2">
      <KvRow label="Model Version" value={d.model_version} />
      <KvRow label="Ruleset ID" value={d.ruleset_id} />
      <KvRow label="Ruleset Version" value={d.ruleset_version} />
      <KvRow label="Assessment Version" value={d.assessment_version} />
      <KvRow label="Computed At" value={d.computed_at ? new Date(d.computed_at as string).toLocaleString() : 'N/A'} />
      {d.parser_versions && <DictTable data={d.parser_versions as Record<string, number>} keyLabel="Parser" valLabel="Version" />}
    </div>
  );
}

function ReviewerChangesView({ data }: { data: Record<string, any> }) {
  const d = data || {};
  const actions = (d.reviewer_actions || []) as Array<Record<string, string>>;
  return (
    <div className="py-2 space-y-2">
      <KvRow label="Total Reviewer Actions" value={d.total_reviewer_actions ?? 0} />
      {actions.length > 0 && (
        <table className="w-full text-xs my-2">
          <thead><tr className="text-ink-soft"><th className="text-left py-1">Action</th><th className="text-left py-1">Finding</th><th className="text-left py-1">Reviewer</th></tr></thead>
          <tbody>
            {actions.map((ra, i) => (
              <tr key={i} className="border-t border-solid-border/30">
                <td className="py-1 text-ink">{ra.action}</td>
                <td className="py-1 text-ink-muted truncate max-w-[200px]">{ra.finding_title}</td>
                <td className="py-1 text-ink-muted">{ra.reviewer_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {actions.length === 0 && <p className="text-xs text-ink-soft">No reviewer actions recorded.</p>}
    </div>
  );
}

function MeasuredMetricsView({ data }: { data: Record<string, any> }) {
  const d = data || {};
  return (
    <div className="py-2 space-y-2">
      <KvRow label="Artifacts Processed" value={d.artifacts_processed ?? 0} />
      <KvRow label="Components Discovered" value={d.components_discovered ?? 0} />
      <KvRow label="Dependencies Discovered" value={d.dependencies_discovered ?? 0} />
      <KvRow label="Analysis Runtime (ms)" value={d.analysis_runtime_ms ?? 0} />
      <KvRow label="Assessment Runtime (ms)" value={d.assessment_runtime_ms ?? 0} />
      <KvRow label="Total Findings" value={d.total_findings ?? 0} />
      <KvRow label="Items Needing Specialist Input" value={d.items_needing_specialist_input ?? 0} />
      {d.findings_by_evidence_class && <DictTable data={d.findings_by_evidence_class as Record<string, number>} keyLabel="Evidence Class" />}
      {d.note && <div className="mt-2 p-2.5 rounded-tile bg-accent-soft/30 text-xs text-ink-muted">{d.note as string}</div>}
    </div>
  );
}

function JsonFallback({ data }: { data: unknown }) {
  return <pre className="text-[10px] text-ink-muted overflow-auto max-h-60 p-2 rounded-tile inner-glass">{JSON.stringify(data, null, 2)}</pre>;
}
