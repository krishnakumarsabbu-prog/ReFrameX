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
import { resolveActiveApp, setStoredActiveAppId } from '@/utils/activeApp';
import type { EvidenceClass } from '@/types';

const EVIDENCE_COLORS: Record<string, string> = {
  'Evidence-based': '#10B981',
  'Inferred': '#3B82F6',
  'Assumed': '#F59E0B',
  'Unknown': '#8B5CF6',
};

const TECH_COLORS = ['#3B82F6', '#6366F1', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6'];

const softGlassTooltipStyle = {
  backgroundColor: '#FFFFFF',
  color: '#202124',
  border: '1px solid #E3E5E7',
  borderRadius: '12px',
  boxShadow: '0 8px 24px rgba(25, 30, 35, 0.08)',
  fontSize: '12px',
  fontFamily: 'Inter, sans-serif',
  padding: '8px 12px',
} as const;

const CAPABILITY_LABELS: Record<string, string> = {
  FULL_EXTRACT: 'Full Extract',
  PARTIAL_EXTRACT: 'Partial Extract',
  DETECT_ONLY: 'Detect Only',
};

const CAPABILITY_BADGE: Record<string, string> = {
  FULL_EXTRACT: 'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]',
  PARTIAL_EXTRACT: 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]',
  DETECT_ONLY: 'bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]',
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
      const active = resolveActiveApp(data);
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
    setStoredActiveAppId(id);
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
    color: EVIDENCE_COLORS[e] ?? '#94A3B8',
  }));

  if (apps.length === 0 && !loading) {
    return (
      <>
        <PageHeader title="Application Intelligence" breadcrumb={['ReFrameX', 'Application Intelligence']} />
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#F1F2F3] border border-[#E3E5E7] flex items-center justify-center mb-5 text-[#202124]">
            <Sparkles size={28} />
          </div>
          <h2 className="text-xl font-medium text-[#202124] mb-2">No applications to analyze</h2>
          <p className="text-[#777D83] max-w-sm">
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
        breadcrumb={['ReFrameX', 'Application Intelligence']}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={activeApp?.id ?? ''}
                onChange={(e) => handleSelectApp(e.target.value)}
                className="h-9 rounded-xl border border-[#E3E5E7] bg-white px-3.5 py-1.5 pr-8 text-xs font-medium text-[#202124] shadow-sm appearance-none cursor-pointer hover:border-[#202124] transition-colors outline-none"
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A0A4A8] pointer-events-none" />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !activeApp}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-semibold hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 transition-all shadow-sm shadow-indigo-600/20"
            >
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {analyzing ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] text-xs font-medium">
          <AlertCircle size={15} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Static extraction notice */}
      <BentoCard className="p-4 mb-5" dense>
        <div className="flex items-center gap-2 text-xs text-[#777D83]">
          <Info size={14} className="text-[#202124] shrink-0" />
          <span>
            Extraction is <strong>static and regex/rule-based</strong> — not full semantic compilation.
            Every component is classified by evidence strength and traced to its source location.
          </span>
        </div>
      </BentoCard>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#777D83]">
          <Loader2 size={24} className="animate-spin text-[#202124]" />
        </div>
      ) : !summary || summary.components_extracted === 0 ? (
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto" dense>
          <div className="w-16 h-16 rounded-2xl bg-[#F1F2F3] border border-[#E3E5E7] flex items-center justify-center mb-5 text-[#202124]">
            <Sparkles size={28} />
          </div>
          <h2 className="text-xl font-medium text-[#202124] mb-2">No analysis yet</h2>
          <p className="text-[#777D83] max-w-sm mb-6 text-xs">
            Run analysis to extract components from uploaded artifacts. The engine will identify programs, calls, SQL statements, JCL steps, and more.
          </p>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#202124] text-white text-xs font-medium hover:bg-black disabled:opacity-50 transition-colors shadow-sm"
          >
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Run Analysis
          </button>
        </BentoCard>
      ) : (
        <div className="space-y-5">
          {/* Summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryTile label="Components Extracted" value={String(summary.components_extracted)} icon={<Boxes size={16} />} color="blue" />
            <SummaryTile label="Artifacts Processed" value={String(summary.artifacts_processed)} icon={<FileSearch size={16} />} color="teal" />
            <SummaryTile label="Warnings" value={String(summary.warnings_count)} icon={<AlertTriangle size={16} />} color="amber" />
            <SummaryTile label="Duration" value={summary.duration_ms != null ? `${(summary.duration_ms / 1000).toFixed(2)}s` : '—'} icon={<Zap size={16} />} color="purple" />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Technology distribution bar chart */}
            <BentoCard className="lg:col-span-2 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-medium text-[#202124]">Technology Distribution</h3>
              </div>
              {techChartData.length > 0 ? (
                <div style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer>
                    <BarChart data={techChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#777D83' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#777D83' }} width={40} />
                      <Tooltip
                        cursor={{ fill: 'rgba(25,30,35,0.03)' }}
                        contentStyle={softGlassTooltipStyle}
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
                <h3 className="text-base font-medium text-[#202124]">Evidence Classification</h3>
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
                        <Tooltip contentStyle={softGlassTooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {evidenceChartData.map((slice) => (
                      <div key={slice.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: slice.color }} />
                          <span className="text-xs text-[#777D83]">{slice.label}</span>
                        </div>
                        <span className="text-sm font-medium text-[#202124] tabular-nums">{slice.value}</span>
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
              className="flex items-center gap-2 text-sm font-medium text-[#202124] hover:text-black transition-colors"
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
                  <BentoCard className="p-5" dense>
                    <h4 className="text-xs font-medium text-[#202124] mb-3 uppercase tracking-wide">Registered Parsers</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {coverage.parsers.map((p) => (
                        <div key={p.name} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-[#E3E5E7] bg-[#FAFAFA]">
                          <div>
                            <div className="text-sm font-medium text-[#202124]">{p.name}</div>
                            <div className="text-[10px] text-[#777D83]">{p.supported_categories}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-medium ${CAPABILITY_BADGE[p.capability] ?? ''}`}>
                              {CAPABILITY_LABELS[p.capability] ?? p.capability}
                            </span>
                            <span className="text-[10px] text-[#A0A4A8]">v{p.version}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </BentoCard>
                )}

                {/* Per-artifact coverage table */}
                <BentoCard className="overflow-hidden p-0" dense>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#E3E5E7] bg-[#F1F2F3] text-left text-[11px] font-medium text-[#777D83] uppercase tracking-wide">
                          <th className="px-4 py-3">Filename</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Parser</th>
                          <th className="px-4 py-3">Capability</th>
                          <th className="px-4 py-3">Components</th>
                          <th className="px-4 py-3">Warnings</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E3E5E7]">
                        {coverage.entries.map((entry) => (
                          <tr key={entry.artifact_id} className="hover:bg-[#F1F2F3]/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-[#202124] truncate max-w-[200px]">{entry.filename}</td>
                            <td className="px-4 py-3 text-[#777D83]">{entry.category}</td>
                            <td className="px-4 py-3 text-[#777D83]">{entry.parser_name ?? '—'}</td>
                            <td className="px-4 py-3">
                              {entry.capability && (
                                <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-medium ${CAPABILITY_BADGE[entry.capability] ?? ''}`}>
                                  {CAPABILITY_LABELS[entry.capability] ?? entry.capability}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[#202124] font-medium tabular-nums">{entry.components_extracted}</td>
                            <td className="px-4 py-3 text-[#777D83] tabular-nums">{entry.warnings}</td>
                            <td className="px-4 py-3"><StatusBadge>{entry.parse_status}</StatusBadge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </BentoCard>

                {/* Unsupported artifacts */}
                {coverage.unsupported_artifacts.length > 0 && (
                  <BentoCard className="p-5" dense>
                    <h4 className="text-xs font-medium text-[#202124] mb-3 uppercase tracking-wide flex items-center gap-2">
                      <AlertTriangle size={14} className="text-[#D97706]" />
                      Unsupported / Detect-Only Artifacts
                    </h4>
                    <div className="space-y-2">
                      {coverage.unsupported_artifacts.map((entry) => (
                        <div key={entry.artifact_id} className="flex items-center justify-between py-2 px-3.5 rounded-xl border border-[#E3E5E7] bg-[#FAFAFA]">
                          <div className="flex items-center gap-2">
                            <FileSearch size={14} className="text-[#777D83]" />
                            <span className="text-sm font-medium text-[#202124]">{entry.filename}</span>
                            <span className="text-[10px] text-[#A0A4A8]">{entry.category}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.parser_name && <span className="text-xs text-[#777D83]">{entry.parser_name}</span>}
                            <span className="text-[10px] text-[#A0A4A8]">{entry.parse_status}</span>
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
            <h3 className="text-base font-medium text-[#202124] mb-3">Component Inventory</h3>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <FilterSelect label="Type" value={filterType} onChange={setFilterType} options={types} />
              <FilterSelect label="Evidence" value={filterEvidence} onChange={setFilterEvidence} options={evidenceClasses} />
              <FilterSelect label="Technology" value={filterTech} onChange={setFilterTech} options={technologies} />
              <span className="text-xs text-[#777D83] ml-auto">{filtered.length} of {components.length}</span>
            </div>

            {/* Component table */}
            <BentoCard className="overflow-hidden p-0" dense>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#E3E5E7] bg-[#F1F2F3] text-left text-[11px] font-medium text-[#777D83] uppercase tracking-wide">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Technology</th>
                      <th className="px-4 py-3 font-medium">Source</th>
                      <th className="px-4 py-3 font-medium">Lines</th>
                      <th className="px-4 py-3 font-medium">Evidence</th>
                      <th className="px-4 py-3 font-medium">Parser</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E5E7]">
                    {filtered.slice(0, 200).map((comp) => (
                      <tr
                        key={comp.id}
                        onClick={() => setSelectedComponent(comp)}
                        className="hover:bg-[#F1F2F3]/50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[#777D83] shrink-0">{TYPE_ICONS[comp.component_type] ?? <Boxes size={14} />}</span>
                            <span className="font-medium text-[#202124] truncate max-w-[200px]">{comp.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#777D83]">{comp.component_type}</td>
                        <td className="px-4 py-3 text-[#777D83]">{comp.technology}</td>
                        <td className="px-4 py-3 text-[#777D83] truncate max-w-[150px]">{comp.source_filename}</td>
                        <td className="px-4 py-3 text-[#777D83]">{comp.line_start}{comp.line_end !== comp.line_start ? `–${comp.line_end}` : ''}</td>
                        <td className="px-4 py-3"><StatusBadge evidence={comp.evidence_class as EvidenceClass} /></td>
                        <td className="px-4 py-3 text-[#A0A4A8] text-[10px]">{comp.parser_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length > 200 && (
                <div className="px-4 py-3 text-xs text-[#777D83] text-center border-t border-[#E3E5E7]">
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

function SummaryTile({ label, value, icon, color = 'blue' }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  const colorMap: Record<string, { topBorder: string; iconColor: string }> = {
    blue: { topBorder: 'border-t-4 border-blue-500', iconColor: 'text-blue-600' },
    teal: { topBorder: 'border-t-4 border-teal-500', iconColor: 'text-teal-600' },
    amber: { topBorder: 'border-t-4 border-amber-500', iconColor: 'text-amber-600' },
    purple: { topBorder: 'border-t-4 border-purple-500', iconColor: 'text-purple-600' },
  };
  const theme = colorMap[color] || colorMap.blue;

  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs ${theme.topBorder} hover:shadow-sm transition-all`}>
      <div className="mb-2 flex items-center justify-between">
        <span className={theme.iconColor}>{icon}</span>
      </div>
      <div className="font-mono text-2xl font-bold leading-none tabular-nums text-slate-900">{value}</div>
      <div className="mt-2 text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] pl-3 pr-8 text-xs font-medium text-[#777D83] outline-none hover:border-[#202124] focus:border-[#202124] transition-colors"
      >
        <option value="all">All {label.toLowerCase()}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={11} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A0A4A8]" />
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-48 text-[#A0A4A8] text-sm">
      No data available
    </div>
  );
}

function ComponentDrawer({ component, onClose }: { component: Component; onClose: () => void }) {
  const propEntries = Object.entries(component.detected_properties);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#202124]/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl h-full overflow-y-auto p-6 bg-white border-l border-[#E3E5E7] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#E3E5E7]">
          <div className="flex items-center gap-2">
            {TYPE_ICONS[component.component_type] ?? <Boxes size={18} className="text-[#202124]" />}
            <div>
              <h2 className="text-base font-medium text-[#202124]">{component.name}</h2>
              <p className="text-xs text-[#777D83]">{component.component_type} · {component.technology}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#777D83]"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <Detail label="Evidence Class" value={component.evidence_class} />
          <Detail label="Source File" value={component.source_filename} />
          <Detail label="Line Range" value={`${component.line_start}–${component.line_end}`} />
          <Detail label="Parser" value={`${component.parser_name} v${component.parser_version}`} />
        </div>

        {/* Evidence references */}
        {component.evidence_refs.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-medium text-[#202124] mb-2 uppercase tracking-wide flex items-center gap-2">
              <ScrollText size={14} /> Evidence References
            </h3>
            <div className="space-y-2">
              {component.evidence_refs.map((ref, i) => (
                <div key={i} className="px-3 py-2 rounded-xl bg-[#FAFAFA] border border-[#E3E5E7]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-medium text-[#202124]">{ref.rule}</span>
                    <span className="text-[10px] text-[#777D83]">Line {ref.line_start}{ref.line_end !== ref.line_start ? `–${ref.line_end}` : ''}</span>
                  </div>
                  {ref.snippet && (
                    <pre className="text-[11px] font-mono text-[#202124] whitespace-pre-wrap break-all">{ref.snippet}</pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detected properties */}
        {propEntries.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-medium text-[#202124] mb-2 uppercase tracking-wide">Detected Properties</h3>
            <div className="space-y-1">
              {propEntries.map(([key, val]) => (
                <div key={key} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-[#FAFAFA] border border-[#E3E5E7]">
                  <span className="text-xs text-[#777D83]">{key}</span>
                  <span className="text-xs font-medium text-[#202124]">{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {component.warnings.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-medium text-[#D97706] mb-2 uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle size={14} className="text-[#D97706]" /> Warnings
            </h3>
            <div className="space-y-1">
              {component.warnings.map((w, i) => (
                <div key={i} className="text-xs text-[#92400E] py-1.5 px-3 rounded-lg bg-[#FFFBEB] border border-[#FDE68A]">
                  {w}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Component ID */}
        <div className="mt-6 pt-4 border-t border-[#E3E5E7]">
          <div className="text-[10px] text-[#A0A4A8]">Component ID (deterministic)</div>
          <div className="text-xs font-mono text-[#777D83] mt-1 break-all">{component.id}</div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E3E5E7] p-2.5 bg-[#FAFAFA]">
      <span className="text-[10px] text-[#777D83] block uppercase font-medium">{label}</span>
      <span className="text-xs text-[#202124] font-medium break-all mt-0.5 block">{value}</span>
    </div>
  );
}
