import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip,
  PieChart, Pie,
} from 'recharts';
import {
  Sparkles, Loader2, AlertCircle, X, RefreshCw, ChevronDown,
  Boxes, FileSearch, Zap, AlertTriangle, CheckCircle2, Info,
  Code2, Database, Layers, ScrollText, Cpu, Shield,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import StatusBadge from '@/components/StatusBadge';
import {
  api, type Application, type Component, type AnalysisSummary,
  type ParserCoverageReport, type ParserCoverageEntry,
} from '@/api/client';
import type { EvidenceClass } from '@/types';

const EVIDENCE_COLORS: Record<string, string> = {
  'Evidence-based': '#4D8F86',
  'Inferred': '#E8A838',
  'Assumed': '#C99C6D',
  'Unknown': '#A89B94',
};

const TECH_COLORS = ['#4D8F86', '#E8A838', '#C99C6D', '#547C7B', '#A9784E', '#D9C1A2', '#E88555', '#8A8A93'];

const CAPABILITY_LABELS: Record<string, string> = {
  FULL_EXTRACT: 'Full Extract',
  PARTIAL_EXTRACT: 'Partial Extract',
  DETECT_ONLY: 'Detect Only',
};

const CAPABILITY_BADGE: Record<string, string> = {
  FULL_EXTRACT: 'bg-severity-low/15 text-severity-low',
  PARTIAL_EXTRACT: 'bg-severity-medium/15 text-severity-medium',
  DETECT_ONLY: 'bg-evidence-unknown/15 text-evidence-unknown',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  'program_id': <Code2 size={14} />,
  'division': <Layers size={14} />,
  'section': <Layers size={14} />,
  'paragraph': <Layers size={14} />,
  'call': <Zap size={14} />,
  'static_call': <Zap size={14} />,
  'dynamic_call': <Zap size={14} />,
  'exec_sql': <Database size={14} />,
  'exec_cics': <Cpu size={14} />,
  'copy': <FileSearch size={14} />,
  'goto': <AlertTriangle size={14} />,
  'perform': <RefreshCw size={14} />,
  'sql_statement': <Database size={14} />,
  'table': <Database size={14} />,
  'create_table': <Database size={14} />,
  'create_index': <Database size={14} />,
  'create_view': <Database size={14} />,
  'create_procedure': <Database size={14} />,
  'job': <Boxes size={14} />,
  'exec_step': <Cpu size={14} />,
  'dd_statement': <FileSearch size={14} />,
  'if_then_else': <AlertTriangle size={14} />,
  'record_layout': <Layers size={14} />,
  'field': <FileSearch size={14} />,
  'mapset': <ScrollText size={14} />,
  'map': <ScrollText size={14} />,
  'map_field': <ScrollText size={14} />,
  'define_cluster': <Database size={14} />,
  'csect': <Cpu size={14} />,
  'dbd': <Database size={14} />,
  'psb': <Database size={14} />,
  'segment': <Layers size={14} />,
  'racf_user': <Shield size={14} />,
  'racf_resource': <Shield size={14} />,
  'alter': <AlertTriangle size={14} />,
  'unsupported_artifact': <AlertTriangle size={14} />,
};

export default function IntelligencePage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [coverage, setCoverage] = useState<ParserCoverageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterEvidence, setFilterEvidence] = useState<string>('all');
  const [filterTech, setFilterTech] = useState<string>('all');
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [showCoverage, setShowCoverage] = useState(false);

  const loadApps = useCallback(async () => {
    try {
      const data = await api.listApplications();
      setApps(data);
      const active = data.find((a) => a.is_active) ?? data[0] ?? null;
      setActiveApp(active);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    }
  }, []);

  const loadAnalysis = useCallback(async (appId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [summ, comps, cov] = await Promise.all([
        api.getAnalysisSummary(appId),
        api.getComponents(appId),
        api.getParserCoverage(appId),
      ]);
      setSummary(summ);
      setComponents(comps);
      setCoverage(cov);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);
  useEffect(() => { if (activeApp) loadAnalysis(activeApp.id); }, [activeApp, loadAnalysis]);

  async function handleSelectApp(id: string) {
    try {
      await api.updateApplication(id, { is_active: true });
      await loadApps();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to select application');
    }
  }

  async function handleAnalyze() {
    if (!activeApp) return;
    setAnalyzing(true);
    setError(null);
    try {
      await api.reanalyze(activeApp.id);
      await loadAnalysis(activeApp.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  const types = summary ? Object.keys(summary.by_type).sort() : [];
  const technologies = summary ? Object.keys(summary.by_technology).sort() : [];
  const evidenceClasses = summary ? Object.keys(summary.by_evidence_class).sort() : [];

  const filtered = components.filter((c) => {
    if (filterType !== 'all' && c.component_type !== filterType) return false;
    if (filterEvidence !== 'all' && c.evidence_class !== filterEvidence) return false;
    if (filterTech !== 'all' && c.technology !== filterTech) return false;
    return true;
  });

  const techChartData = technologies.map((t, i) => ({
    label: t,
    value: summary!.by_technology[t],
    fill: TECH_COLORS[i % TECH_COLORS.length],
  }));

  const evidenceChartData = evidenceClasses.map((e) => ({
    label: e,
    value: summary!.by_evidence_class[e],
    color: EVIDENCE_COLORS[e] ?? '#A89B94',
  }));

  if (apps.length === 0 && !loading) {
    return (
      <>
        <PageHeader title="Application Intelligence" breadcrumb={['ReframeX', 'Application Intelligence']} />
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent">
            <Sparkles size={28} />
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">No applications to analyze</h2>
          <p className="text-ink-muted max-w-sm">
            Create an application and upload artifacts first, then run analysis to see extracted components here.
          </p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Application Intelligence"
        breadcrumb={['ReframeX', 'Application Intelligence']}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={activeApp?.id ?? ''}
                onChange={(e) => handleSelectApp(e.target.value)}
                className="inner-glass rounded-pill px-3 py-1.5 pr-8 text-xs font-medium text-ink-muted appearance-none cursor-pointer hover:bg-white/35 transition-colors"
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !activeApp}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {analyzing ? 'Analyzing...' : 'Run Analysis'}
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

      {/* Static extraction notice */}
      <BentoCard className="p-3 mb-5" dense>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <Info size={14} className="text-accent shrink-0" />
          <span>
            Extraction is <strong>static and regex/rule-based</strong> — not full semantic compilation.
            Every component is classified by evidence strength and traced to its source location.
          </span>
        </div>
      </BentoCard>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-ink-muted">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : !summary || summary.components_extracted === 0 ? (
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto" dense>
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent">
            <Sparkles size={28} />
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">No analysis yet</h2>
          <p className="text-ink-muted max-w-sm mb-6">
            Run analysis to extract components from uploaded artifacts. The engine will identify programs, calls, SQL statements, JCL steps, and more.
          </p>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-pill bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Run Analysis
          </button>
        </BentoCard>
      ) : (
        <div className="space-y-5">
          {/* Summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryTile label="Components Extracted" value={String(summary.components_extracted)} icon={<Boxes size={16} />} />
            <SummaryTile label="Artifacts Processed" value={String(summary.artifacts_processed)} icon={<FileSearch size={16} />} />
            <SummaryTile label="Warnings" value={String(summary.warnings_count)} icon={<AlertTriangle size={16} />} />
            <SummaryTile label="Duration" value={summary.duration_ms != null ? `${(summary.duration_ms / 1000).toFixed(2)}s` : '—'} icon={<Zap size={16} />} />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Technology distribution bar chart */}
            <BentoCard className="lg:col-span-2 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-ink">Technology Distribution</h3>
              </div>
              {techChartData.length > 0 ? (
                <div style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer>
                    <BarChart data={techChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8A8A93' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8A8A93' }} width={40} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.2)' }}
                        contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #E2DED8', borderRadius: '12px', fontSize: '12px' }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {techChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyChart />
              )}
            </BentoCard>

            {/* Evidence classification pie */}
            <BentoCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-ink">Evidence Classification</h3>
              </div>
              {evidenceChartData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <div style={{ width: 130, height: 130 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={evidenceChartData} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={35} outerRadius={58} paddingAngle={3}>
                          {evidenceChartData.map((slice, i) => (
                            <Cell key={i} fill={slice.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #E2DED8', borderRadius: '12px', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {evidenceChartData.map((slice) => (
                      <div key={slice.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: slice.color }} />
                          <span className="text-xs text-ink-muted">{slice.label}</span>
                        </div>
                        <span className="text-sm font-semibold text-ink">{slice.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyChart />
              )}
            </BentoCard>
          </div>

          {/* Parser coverage toggle */}
          <div>
            <button
              onClick={() => setShowCoverage(!showCoverage)}
              className="flex items-center gap-2 text-sm font-semibold text-ink hover:text-accent transition-colors"
            >
              <ChevronDown size={16} className={`transition-transform ${showCoverage ? 'rotate-180' : ''}`} />
              Parser Coverage Report
            </button>
            {showCoverage && coverage && (
              <div className="mt-3 space-y-4">
                {/* Coverage summary tiles */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SummaryTile label="Total Artifacts" value={String(coverage.total_artifacts)} icon={<FileSearch size={16} />} />
                  <SummaryTile label="Full Extract" value={String(coverage.by_capability['FULL_EXTRACT'] ?? 0)} icon={<CheckCircle2 size={16} />} />
                  <SummaryTile label="Partial Extract" value={String(coverage.by_capability['PARTIAL_EXTRACT'] ?? 0)} icon={<Info size={16} />} />
                  <SummaryTile label="Detect Only" value={String(coverage.by_capability['DETECT_ONLY'] ?? 0)} icon={<AlertTriangle size={16} />} />
                </div>

                {/* Registered parsers */}
                {coverage.parsers.length > 0 && (
                  <BentoCard className="p-4" dense>
                    <h4 className="text-xs font-semibold text-ink mb-3 uppercase tracking-wide">Registered Parsers</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {coverage.parsers.map((p) => (
                        <div key={p.name} className="flex items-center justify-between px-3 py-2 rounded-tile bg-white/30">
                          <div>
                            <div className="text-sm font-medium text-ink">{p.name}</div>
                            <div className="text-[10px] text-ink-soft">{p.supported_categories}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-pill text-[10px] font-medium ${CAPABILITY_BADGE[p.capability] ?? ''}`}>
                              {CAPABILITY_LABELS[p.capability] ?? p.capability}
                            </span>
                            <span className="text-[10px] text-ink-soft">v{p.version}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </BentoCard>
                )}

                {/* Per-artifact coverage table */}
                <BentoCard className="overflow-hidden" dense>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-solid-border text-left text-xs text-ink-soft uppercase tracking-wide">
                          <th className="px-4 py-3 font-medium">Filename</th>
                          <th className="px-4 py-3 font-medium">Category</th>
                          <th className="px-4 py-3 font-medium">Parser</th>
                          <th className="px-4 py-3 font-medium">Capability</th>
                          <th className="px-4 py-3 font-medium">Components</th>
                          <th className="px-4 py-3 font-medium">Warnings</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coverage.entries.map((entry) => (
                          <tr key={entry.artifact_id} className="border-b border-solid-border/50 hover:bg-white/40 transition-colors">
                            <td className="px-4 py-3 font-medium text-ink truncate max-w-[200px]">{entry.filename}</td>
                            <td className="px-4 py-3 text-ink-muted">{entry.category}</td>
                            <td className="px-4 py-3 text-ink-muted text-xs">{entry.parser_name ?? '—'}</td>
                            <td className="px-4 py-3">
                              {entry.capability && (
                                <span className={`inline-flex px-2 py-0.5 rounded-pill text-xs font-medium ${CAPABILITY_BADGE[entry.capability] ?? ''}`}>
                                  {CAPABILITY_LABELS[entry.capability] ?? entry.capability}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-ink font-medium">{entry.components_extracted}</td>
                            <td className="px-4 py-3 text-ink-muted">{entry.warnings}</td>
                            <td className="px-4 py-3"><StatusBadge>{entry.parse_status}</StatusBadge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </BentoCard>

                {/* Unsupported artifacts */}
                {coverage.unsupported_artifacts.length > 0 && (
                  <BentoCard className="p-4" dense>
                    <h4 className="text-xs font-semibold text-ink mb-3 uppercase tracking-wide flex items-center gap-2">
                      <AlertTriangle size={14} className="text-severity-medium" />
                      Unsupported / Detect-Only Artifacts
                    </h4>
                    <div className="space-y-2">
                      {coverage.unsupported_artifacts.map((entry) => (
                        <div key={entry.artifact_id} className="flex items-center justify-between py-2 px-3 rounded-tile bg-white/20">
                          <div className="flex items-center gap-2">
                            <FileSearch size={14} className="text-ink-soft" />
                            <span className="text-sm font-medium text-ink">{entry.filename}</span>
                            <span className="text-[10px] text-ink-soft">{entry.category}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.parser_name && <span className="text-xs text-ink-muted">{entry.parser_name}</span>}
                            <span className="text-[10px] text-ink-soft">{entry.parse_status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </BentoCard>
                )}
              </div>
            )}
          </div>

          {/* Component inventory */}
          <div>
            <h3 className="text-sm font-semibold text-ink mb-3">Component Inventory</h3>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <FilterSelect label="Type" value={filterType} onChange={setFilterType} options={types} />
              <FilterSelect label="Evidence" value={filterEvidence} onChange={setFilterEvidence} options={evidenceClasses} />
              <FilterSelect label="Technology" value={filterTech} onChange={setFilterTech} options={technologies} />
              <span className="text-xs text-ink-soft ml-auto">{filtered.length} of {components.length}</span>
            </div>

            {/* Component table */}
            <BentoCard className="overflow-hidden" dense>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-solid-border text-left text-xs text-ink-soft uppercase tracking-wide">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Technology</th>
                      <th className="px-4 py-3 font-medium">Source</th>
                      <th className="px-4 py-3 font-medium">Lines</th>
                      <th className="px-4 py-3 font-medium">Evidence</th>
                      <th className="px-4 py-3 font-medium">Parser</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 200).map((comp) => (
                      <tr
                        key={comp.id}
                        onClick={() => setSelectedComponent(comp)}
                        className="border-b border-solid-border/50 hover:bg-white/40 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-ink-soft shrink-0">{TYPE_ICONS[comp.component_type] ?? <Boxes size={14} />}</span>
                            <span className="font-medium text-ink truncate max-w-[200px]">{comp.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-muted text-xs">{comp.component_type}</td>
                        <td className="px-4 py-3 text-ink-muted text-xs">{comp.technology}</td>
                        <td className="px-4 py-3 text-ink-muted text-xs truncate max-w-[150px]">{comp.source_filename}</td>
                        <td className="px-4 py-3 text-ink-muted text-xs">{comp.line_start}{comp.line_end !== comp.line_start ? `–${comp.line_end}` : ''}</td>
                        <td className="px-4 py-3"><StatusBadge evidence={comp.evidence_class as EvidenceClass} /></td>
                        <td className="px-4 py-3 text-ink-soft text-[10px]">{comp.parser_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length > 200 && (
                <div className="px-4 py-3 text-xs text-ink-soft text-center border-t border-solid-border/50">
                  Showing first 200 of {filtered.length} components — use filters to narrow results
                </div>
              )}
            </BentoCard>
          </div>
        </div>
      )}

      {selectedComponent && (
        <ComponentDrawer
          component={selectedComponent}
          onClose={() => setSelectedComponent(null)}
        />
      )}
    </>
  );
}

function SummaryTile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <BentoCard className="p-4" dense>
      <div className="flex items-center justify-between mb-1">
        <span className="text-ink-soft">{icon}</span>
      </div>
      <div className="text-2xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-ink-soft mt-1">{label}</div>
    </BentoCard>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="inner-glass rounded-pill px-3 py-1.5 pr-8 text-xs font-medium text-ink-muted appearance-none cursor-pointer"
      >
        <option value="all">All {label.toLowerCase()}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-48 text-ink-soft text-sm">
      No data available
    </div>
  );
}

function ComponentDrawer({ component, onClose }: { component: Component; onClose: () => void }) {
  const propEntries = Object.entries(component.detected_properties);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="dense-surface w-full max-w-xl h-full overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
        style={{ borderRadius: 0 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {TYPE_ICONS[component.component_type] ?? <Boxes size={18} className="text-accent" />}
            <div>
              <h2 className="text-lg font-semibold text-ink">{component.name}</h2>
              <p className="text-xs text-ink-soft">{component.component_type} · {component.technology}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/40"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <Detail label="Evidence Class" value={component.evidence_class} />
          <Detail label="Source File" value={component.source_filename} />
          <Detail label="Line Range" value={`${component.line_start}–${component.line_end}`} />
          <Detail label="Parser" value={`${component.parser_name} v${component.parser_version}`} />
        </div>

        {/* Evidence references */}
        {component.evidence_refs.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-ink mb-2 uppercase tracking-wide flex items-center gap-2">
              <ScrollText size={14} /> Evidence References
            </h3>
            <div className="space-y-2">
              {component.evidence_refs.map((ref, i) => (
                <div key={i} className="px-3 py-2 rounded-tile bg-white/30 border border-solid-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-accent">{ref.rule}</span>
                    <span className="text-[10px] text-ink-soft">Line {ref.line_start}{ref.line_end !== ref.line_start ? `–${ref.line_end}` : ''}</span>
                  </div>
                  {ref.snippet && (
                    <pre className="text-[11px] font-mono text-ink-muted whitespace-pre-wrap break-all">{ref.snippet}</pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detected properties */}
        {propEntries.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-ink mb-2 uppercase tracking-wide">Detected Properties</h3>
            <div className="space-y-1">
              {propEntries.map(([key, val]) => (
                <div key={key} className="flex items-center justify-between py-1.5 px-3 rounded-tile bg-white/20">
                  <span className="text-xs text-ink-soft">{key}</span>
                  <span className="text-xs font-medium text-ink">{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {component.warnings.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-ink mb-2 uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle size={14} className="text-severity-medium" /> Warnings
            </h3>
            <div className="space-y-1">
              {component.warnings.map((w, i) => (
                <div key={i} className="text-xs text-severity-medium py-1.5 px-3 rounded-tile bg-severity-medium/10">
                  {w}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Component ID */}
        <div className="mt-6 pt-4 border-t border-solid-border/50">
          <div className="text-[10px] text-ink-soft">Component ID (deterministic)</div>
          <div className="text-xs font-mono text-ink-muted mt-1 break-all">{component.id}</div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-ink-soft block">{label}</span>
      <span className="text-sm text-ink font-medium break-all">{value}</span>
    </div>
  );
}
