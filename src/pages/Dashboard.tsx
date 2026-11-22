import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Boxes,
  ChevronRight, Clock3, FileCheck2, Filter, Gauge, GitBranch,
  Search, ShieldAlert, Sparkles, Zap, Loader2, AlertCircle, RefreshCw,
} from 'lucide-react';
import BentoCard from '@/components/BentoCard';
import StatusBadge from '@/components/StatusBadge';
import ReadinessBadge from '@/components/ReadinessBadge';
import ComplexityBar from '@/components/ComplexityBar';
import ConfidenceBar from '@/components/ConfidenceBar';
import EvidenceBadge from '@/components/EvidenceBadge';
import { api, type DashboardSummary } from '@/api/client';

interface DashboardProps {
  activeTab: string;
}

const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-50';
const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-all active:scale-[0.98]';

const softGlassTooltipStyle = {
  backgroundColor: '#FFFFFF',
  color: '#202124',
  border: '1px solid #E3E5E7',
  borderRadius: '12px',
  boxShadow: '0 8px 24px rgba(25, 30, 35, 0.08)',
  fontSize: '11px',
  fontFamily: '"JetBrains Mono", monospace',
  padding: '8px 12px',
} as const;

export default function Dashboard({ activeTab }: DashboardProps) {
  const navigate = useNavigate();
  const greeting = getGreeting();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = () => {
    setLoading(true);
    setError(null);
    api.getDashboardSummary()
      .then((data) => setSummary(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load portfolio metrics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#777D83]">
            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30 shrink-0 animate-pulse" />
            <span>MIGRATION INTELLIGENCE</span>
            <ChevronRight size={11} className="text-[#CBD5E1]" />
            <span className="text-[#202124] font-medium">LIVE PORTFOLIO</span>
          </div>
          <h1 className="font-sans text-2xl font-medium tracking-tight text-[#202124] md:text-3xl">
            {greeting}, ReFrameX
          </h1>
          <p className="mt-1 text-xs text-[#777D83]">
            Live portfolio metrics and modernization readiness computed directly from the repository database.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2 font-mono text-[11px] font-medium text-emerald-800 shadow-[0_1px_3px_rgba(25,30,35,0.04)]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            Database: {summary ? `${summary.total_applications} applications` : 'Connecting...'}
          </span>
          <button onClick={() => navigate('/applications')} className={primaryButton}>
            <Boxes size={14} /> Applications <ArrowUpRight size={13} />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
          <p className="font-mono text-xs text-slate-500">Aggregating portfolio metrics from database...</p>
        </div>
      ) : error || !summary ? (
        <BentoCard className="p-8 text-center">
          <AlertCircle className="mx-auto mb-3 text-rose-500" size={32} />
          <h3 className="font-medium text-slate-900">Portfolio Data Unavailable</h3>
          <p className="mt-1 text-xs text-slate-500">{error ?? 'Unable to connect to database summary service.'}</p>
          <button onClick={fetchDashboardData} className={`${secondaryButton} mt-4`}>
            <RefreshCw size={13} /> Retry
          </button>
        </BentoCard>
      ) : (
        <>
          {activeTab === 'overview' && <OverviewTab summary={summary} navigate={navigate} />}
          {activeTab === 'risks' && <RisksTab summary={summary} navigate={navigate} />}
          {activeTab === 'actions' && <ActionsTab summary={summary} navigate={navigate} />}
        </>
      )}
    </>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function OverviewTab({ summary, navigate }: { summary: DashboardSummary; navigate: (path: string) => void }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');

  const summaryMetrics = [
    {
      id: 'components',
      label: 'Total Components',
      value: summary.total_components.toLocaleString(),
      note: 'Across the portfolio',
      Icon: Boxes,
      isDeps: false,
      isHighRisk: false,
      isComplexity: false,
    },
    {
      id: 'deps',
      label: 'Dependencies',
      value: summary.total_dependencies.toLocaleString(),
      note: 'Mapped relationships',
      Icon: GitBranch,
      isDeps: true,
      isHighRisk: false,
      isComplexity: false,
    },
    {
      id: 'highrisk',
      label: 'High-Risk Findings',
      value: summary.high_risk_findings_count.toLocaleString(),
      note: 'Require mitigation',
      Icon: ShieldAlert,
      isDeps: false,
      isHighRisk: true,
      isComplexity: false,
    },
    {
      id: 'avgcomplexity',
      label: 'Avg. Complexity',
      value: `${summary.avg_complexity}`,
      unit: '/100',
      note: 'Migration complexity',
      Icon: Gauge,
      isDeps: false,
      isHighRisk: false,
      isComplexity: true,
    },
  ];

  const filteredAssessments = useMemo(() => summary.recent_assessments.filter((assessment) => {
    const matchesQuery = `${assessment.application} ${assessment.readiness}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === 'All statuses' || assessment.status === statusFilter;
    return matchesQuery && matchesStatus;
  }), [summary.recent_assessments, query, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Top 3 Cards Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <PortfolioCard summary={summary} navigate={navigate} />

        {/* Portfolio Snapshot Tile */}
        <BentoCard className="flex flex-col justify-between p-6 lg:col-span-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#202124]">
                Portfolio snapshot
              </h2>
              <p className="mt-0.5 text-xs text-[#777D83]">Key indicators across the estate</p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] text-[#202124]">
              <Activity size={15} />
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {summaryMetrics.map((item) => (
              <MetricTile key={item.id} {...item} />
            ))}
          </div>
        </BentoCard>

        <ReadinessCard summary={summary} />
      </div>

      {/* Discovery & Assessments Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <EvidenceCard summary={summary} />
        <AssessmentsCard
          assessments={filteredAssessments}
          query={query}
          onQueryChange={setQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          onOpenAll={() => navigate('/reports')}
        />
      </div>

      {/* Assessment Domains & Priority Insights Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DomainsCard summary={summary} navigate={navigate} />
        <InsightsCard summary={summary} navigate={navigate} />
      </div>
    </div>
  );
}

function PortfolioCard({ summary, navigate }: { summary: DashboardSummary; navigate: (path: string) => void }) {
  return (
    <BentoCard className="flex min-h-[260px] flex-col justify-between p-6 lg:col-span-4 border-t-4 border-indigo-500 bg-gradient-to-b from-indigo-50/20 to-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-indigo-700">
            Active Portfolio
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl sm:text-4xl font-bold leading-none tracking-tight text-slate-900 tabular-nums">
              {summary.total_applications}
            </span>
            <span className="text-xs font-semibold text-slate-500">applications</span>
          </div>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 shadow-2xs">
          <Boxes size={18} />
        </span>
      </div>

      <div className="mt-6 flex-1">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-slate-600 font-medium">Component inventory</span>
          <span className="font-mono text-xs font-bold tabular-nums text-indigo-700">
            {summary.total_components.toLocaleString()} components
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[85%] rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500" />
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Discovery across {summary.portfolios_count} business domains</span>
          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-700 tabular-nums bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <ArrowUpRight size={12} /> {summary.total_artifacts} artifacts
          </span>
        </div>
      </div>

      <div className="mt-6 flex gap-2.5 pt-3 border-t border-slate-100">
        <button onClick={() => navigate('/artifacts')} className={`${primaryButton} flex-1`}>
          <FileCheck2 size={13} /> Explore artifacts
        </button>
        <button onClick={() => navigate('/applications')} className={`${secondaryButton} flex-1`}>
          View applications <ArrowRight size={13} />
        </button>
      </div>
    </BentoCard>
  );
}

function MetricTile({
  label, value, unit, note, Icon, isHighRisk, isComplexity, isDeps,
}: {
  label: string;
  value: string;
  unit?: string;
  note: string;
  Icon: typeof Boxes;
  isHighRisk?: boolean;
  isComplexity?: boolean;
  isDeps?: boolean;
}) {
  const tileStyle = isHighRisk
    ? 'bg-rose-50/50 border-rose-200/80 hover:bg-rose-50'
    : isComplexity
      ? 'bg-amber-50/50 border-amber-200/80 hover:bg-amber-50'
      : isDeps
        ? 'bg-teal-50/50 border-teal-200/80 hover:bg-teal-50'
        : 'bg-blue-50/50 border-blue-200/80 hover:bg-blue-50';

  const valueColor = isHighRisk
    ? 'text-rose-700'
    : isComplexity
      ? 'text-amber-800'
      : isDeps
        ? 'text-teal-800'
        : 'text-blue-800';

  const iconColor = isHighRisk
    ? 'text-rose-600'
    : isComplexity
      ? 'text-amber-600'
      : isDeps
        ? 'text-teal-600'
        : 'text-blue-600';

  return (
    <div className={`flex min-h-[104px] flex-col justify-between rounded-xl border p-3.5 transition-all shadow-2xs ${tileStyle}`}>
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-[11px] font-semibold leading-tight text-slate-700 truncate">
          {label}
        </span>
        <Icon size={15} className={`shrink-0 ${iconColor}`} />
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`font-mono text-2xl font-bold leading-none tracking-tight tabular-nums ${valueColor}`}>
          {value}
        </span>
        {unit && <span className="font-mono text-[11px] font-semibold text-slate-500">{unit}</span>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-1">
        <span className="truncate text-[10px] text-slate-500 font-medium">{note}</span>
      </div>
    </div>
  );
}

function ReadinessCard({ summary }: { summary: DashboardSummary }) {
  const total = summary.readiness_distribution.reduce((sum, slice) => sum + slice.value, 0);
  const readyCount = summary.readiness_distribution.find((slice) => slice.label.includes('Ready for Planning') || slice.label.includes('Ready for Detailed Planning'))?.value ?? 0;
  const readyPercent = total > 0 ? Math.round((readyCount / total) * 100) : 0;

  return (
    <BentoCard className="flex min-h-[260px] flex-col justify-between p-6 lg:col-span-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#202124]">
            Migration readiness
          </h2>
          <p className="mt-0.5 text-xs text-[#777D83]">Assessment status across applications</p>
        </div>
        <span className="rounded-lg border border-[#E3E5E7] bg-[#F1F2F3] px-2.5 py-0.5 font-mono text-[10px] font-medium text-[#777D83]">
          {summary.total_applications} applications
        </span>
      </div>

      <div className="mt-4 flex items-center gap-4 sm:gap-6">
        <div className="relative h-[124px] w-[124px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={summary.readiness_distribution}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={44}
                outerRadius={58}
                paddingAngle={3}
                stroke="none"
              >
                {summary.readiness_distribution.map((slice) => (
                  <Cell key={slice.label} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={softGlassTooltipStyle}
                formatter={(value: number) => [`${value} Apps`, 'Count']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-normal tracking-tight text-[#202124] tabular-nums">
              {readyPercent}%
            </span>
            <span className="font-mono text-[8px] uppercase tracking-wider text-[#777D83]">
              planning ready
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          {summary.readiness_distribution.map((slice) => (
            <div key={slice.label}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-[#777D83]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="truncate">{slice.label}</span>
                </span>
                <span className="font-mono text-xs font-medium tabular-nums text-[#202124]">
                  {slice.value}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#E3E5E7]">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: total > 0 ? `${(slice.value / total) * 100}%` : '0%',
                    backgroundColor: slice.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </BentoCard>
  );
}

function EvidenceCard({ summary }: { summary: DashboardSummary }) {
  const confidence = summary.avg_confidence;

  return (
    <BentoCard className="p-6 lg:col-span-4 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#202124]">
              Component discovery
            </h2>
            <p className="mt-0.5 text-xs text-[#777D83]">Inventory breakdown by application</p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] text-[#202124]">
            <Activity size={14} />
          </span>
        </div>

        <div className="-ml-3 mt-4 h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summary.component_trend} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#777D83', fontFamily: 'JetBrains Mono' }} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: '#777D83', fontFamily: 'JetBrains Mono' }}
                width={38}
              />
              <Tooltip
                formatter={(value: number) => [value.toLocaleString(), 'Components']}
                contentStyle={softGlassTooltipStyle}
                cursor={{ fill: 'rgba(25,30,35,0.03)' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {summary.component_trend.map((entry, index) => (
                  <Cell
                    key={entry.label}
                    fill={index === summary.component_trend.length - 1 ? '#4F46E5' : '#CBD5E1'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-[#E3E5E7]">
        <div className="flex items-end justify-between gap-2">
          <div>
            <span className="font-mono text-2xl font-normal tracking-tight text-[#202124] tabular-nums">
              {confidence}%
            </span>
            <span className="ml-1.5 text-[11px] text-[#777D83]">evidence completeness</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-lg border border-[#E3E5E7] bg-[#F1F2F3] px-2.5 py-0.5 font-mono text-[10px] font-medium text-[#202124]">
            <ArrowUpRight size={11} /> Portfolio avg.
          </span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#E3E5E7]">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-500"
            style={{ width: `${Math.min(confidence, 100)}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#E3E5E7] bg-[#F1F2F3]/70 p-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Domains</p>
            <p className="mt-1 font-mono text-base font-normal text-[#202124] tabular-nums">
              {summary.domains.length}
            </p>
          </div>
          <div className="rounded-xl border border-[#E3E5E7] bg-[#F1F2F3]/70 p-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#777D83]">High-risk</p>
            <p className="mt-1 font-mono text-base font-normal text-[#DC2626] tabular-nums">
              {summary.high_risk_findings_count}
            </p>
          </div>
        </div>
      </div>
    </BentoCard>
  );
}

function AssessmentsCard({
  assessments, query, onQueryChange, statusFilter, onStatusChange, onOpenAll,
}: {
  assessments: DashboardSummary['recent_assessments'];
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  onOpenAll: () => void;
}) {
  return (
    <BentoCard className="min-w-0 p-6 lg:col-span-8 flex flex-col justify-between">
      <div>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#202124]">
              Recent assessments
            </h2>
            <p className="mt-0.5 text-xs text-[#777D83]">Latest application readiness reviews in database</p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A4A8]" />
              <input
                type="search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search assessments"
                aria-label="Search assessments"
                className="h-8 w-full rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] pl-8 pr-3 text-xs text-[#202124] placeholder:text-[#A0A4A8] outline-none transition-all focus:border-[#202124] focus:bg-white focus:ring-2 focus:ring-[#C5F45A]/40"
              />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(event) => onStatusChange(event.target.value)}
                aria-label="Filter assessments by status"
                className="h-8 appearance-none rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] pl-3 pr-8 text-xs font-medium text-[#202124] outline-none transition-all focus:border-[#202124] focus:bg-white"
              >
                <option>All statuses</option>
                <option>Complete</option>
                <option>In Progress</option>
                <option>Pending</option>
              </select>
              <Filter size={11} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#A0A4A8]" />
            </div>
          </div>
        </div>

        <div className="-mx-1 overflow-x-auto rounded-xl border border-[#E3E5E7]">
          <table className="w-full min-w-[620px] text-left">
            <thead>
              <tr className="border-b border-[#E3E5E7] bg-[#F1F2F3]">
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Application</th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Readiness</th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Complexity</th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Evidence</th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Status</th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E5E7] bg-white">
              {assessments.map((assessment) => (
                <tr
                  key={assessment.id}
                  className="h-12 transition-colors hover:bg-[#F1F2F3]/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#E3E5E7] bg-[#F1F2F3] text-[#202124]">
                        <Boxes size={12} />
                      </span>
                      <span className="font-mono text-xs font-medium text-[#202124]">
                        {assessment.application}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ReadinessBadge status={assessment.readiness} />
                  </td>
                  <td className="px-4 py-3">
                    <ComplexityBar score={assessment.complexity} />
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceBar percentage={assessment.confidence} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={assessment.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[#777D83] tabular-nums">
                      <Clock3 size={11} className="text-[#A0A4A8]" /> {assessment.date}
                    </span>
                  </td>
                </tr>
              ))}
              {assessments.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[#777D83]">
                    No assessments match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#E3E5E7]">
        <button
          onClick={onOpenAll}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#202124] transition-colors hover:underline"
        >
          View assessment reports <ArrowRight size={13} />
        </button>
      </div>
    </BentoCard>
  );
}

function DomainsCard({ summary, navigate }: { summary: DashboardSummary; navigate: (path: string) => void }) {
  return (
    <BentoCard className="p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#202124]">
            Assessment domains
          </h2>
          <p className="mt-0.5 text-xs text-[#777D83]">Readiness across modernization workstreams</p>
        </div>
        <button
          onClick={() => navigate('/complexity')}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#202124] transition-colors hover:underline"
        >
          Details <ArrowRight size={12} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.domains.map((domain) => (
          <button
            key={domain.id}
            onClick={() => navigate('/complexity')}
            className="rounded-xl border border-[#E3E5E7] bg-[#F1F2F3]/70 p-3.5 text-left transition-all hover:border-[#CBD5E1] hover:bg-white active:scale-[0.98]"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[10px] font-medium uppercase tracking-[0.06em] text-[#777D83]">{domain.shortLabel}</span>
              <span className="font-mono text-xs font-medium tabular-nums text-[#202124]">{domain.readiness}%</span>
            </div>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[#E3E5E7]">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${domain.readiness}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-[9px] text-[#A0A4A8] tabular-nums">
              {domain.components} components
            </p>
          </button>
        ))}
      </div>
    </BentoCard>
  );
}

function InsightsCard({ summary, navigate }: { summary: DashboardSummary; navigate: (path: string) => void }) {
  return (
    <BentoCard className="p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#202124]">
            Priority insights
          </h2>
          <p className="mt-0.5 text-xs text-[#777D83]">Real architectural risks from findings inventory</p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] text-[#202124]">
          <Sparkles size={14} />
        </span>
      </div>
      <div className="space-y-2.5">
        {summary.top_risks.slice(0, 2).map((risk) => (
          <button
            key={risk.id}
            onClick={() => navigate('/risks')}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#E3E5E7] bg-white p-3 text-left transition-colors hover:bg-[#F1F2F3] hover:border-[#CBD5E1]"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <ShieldAlert size={15} className="shrink-0 text-[#DC2626]" />
              <span className="min-w-0">
                <span className="block truncate font-mono text-xs font-medium text-[#202124]">{risk.component}</span>
                <span className="block truncate font-mono text-[10px] text-[#777D83]">{risk.application} · {risk.category}</span>
              </span>
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <EvidenceBadge evidence={risk.evidence as any} />
              <StatusBadge severity={risk.severity as any} />
            </div>
          </button>
        ))}
        {summary.recommended_actions.slice(0, 1).map((action) => (
          <button
            key={action.id}
            onClick={() => navigate('/recommendations')}
            className="flex w-full items-center gap-2.5 rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] p-3 text-left transition-colors hover:bg-[#E9EAEC]"
          >
            <Zap size={14} className="shrink-0 text-[#202124]" />
            <span className="line-clamp-1 flex-1 text-xs font-medium text-[#202124]">{action.action}</span>
            <ArrowRight size={12} className="shrink-0 text-[#777D83]" />
          </button>
        ))}
        {summary.top_risks.length === 0 && summary.recommended_actions.length === 0 && (
          <div className="py-6 text-center text-xs text-slate-400">
            No priority risks detected. The portfolio is scoring cleanly.
          </div>
        )}
      </div>
    </BentoCard>
  );
}

function RisksTab({ summary, navigate }: { summary: DashboardSummary; navigate: (path: string) => void }) {
  const counts = [
    { label: 'High severity', value: summary.risk_counts?.high ?? 0, color: 'text-[#DC2626]' },
    { label: 'Medium severity', value: summary.risk_counts?.medium ?? 0, color: 'text-[#D97706]' },
    { label: 'Low severity', value: summary.risk_counts?.low ?? 0, color: 'text-[#166534]' },
    { label: 'Assumed / Unknown', value: summary.risk_counts?.unknown_evidence ?? 0, color: 'text-[#5B21B6]' },
  ];

  return (
    <div className="space-y-6">
      <BentoCard className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#202124]">
              Risk register summary
            </h2>
            <p className="mt-0.5 text-xs text-[#777D83]">Prioritized assessment findings from database.</p>
          </div>
          <ShieldAlert size={16} className="text-[#DC2626]" />
        </div>
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {counts.map((count) => (
            <div key={count.label} className="rounded-xl border border-[#E3E5E7] bg-[#F1F2F3]/70 p-4">
              <div className={`font-mono text-2xl font-normal leading-none tabular-nums ${count.color}`}>{count.value}</div>
              <div className="mt-1.5 text-xs text-[#777D83]">{count.label}</div>
            </div>
          ))}
        </div>
        <div className="space-y-2.5">
          {summary.top_risks.map((risk) => (
            <div
              key={risk.id}
              className="flex flex-col justify-between gap-3 rounded-xl border border-[#E3E5E7] bg-white px-4 py-3.5 transition-colors hover:bg-[#F1F2F3]/60 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                <ShieldAlert size={15} className="shrink-0 text-[#DC2626]" />
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs font-medium text-[#202124]">{risk.component}</div>
                  <div className="font-mono text-[10px] text-[#777D83]">{risk.application} · {risk.category}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-6 sm:pl-0">
                <EvidenceBadge evidence={risk.evidence as any} />
                <StatusBadge severity={risk.severity as any} />
              </div>
            </div>
          ))}
          {summary.top_risks.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              No findings recorded in database.
            </div>
          )}
        </div>
        <button
          onClick={() => navigate('/risks')}
          className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-[#202124] transition-colors hover:underline"
        >
          Open full risk register <ArrowRight size={13} />
        </button>
      </BentoCard>
    </div>
  );
}

function ActionsTab({ summary, navigate }: { summary: DashboardSummary; navigate: (path: string) => void }) {
  return (
    <div className="space-y-6">
      <BentoCard className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#202124]">
              Recommended action queue
            </h2>
            <p className="mt-0.5 text-xs text-[#777D83]">Practical next steps synthesized from assessment records.</p>
          </div>
          <Zap size={16} className="text-[#202124]" />
        </div>
        <div className="space-y-2.5">
          {summary.recommended_actions.map((action, index) => (
            <div
              key={action.id}
              className="flex items-start gap-3.5 rounded-xl border border-[#E3E5E7] bg-white p-4 transition-colors hover:bg-[#F1F2F3]/60"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#202124] font-mono text-xs font-medium text-white">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium leading-snug text-[#202124]">{action.action}</div>
                <div className="mt-1 font-mono text-[10px] text-[#777D83]">
                  {action.application} · Effort: {action.effort}
                </div>
              </div>
              <span className={`shrink-0 font-mono text-[11px] font-medium ${action.priority === 'High' ? 'text-[#DC2626]' : 'text-[#D97706]'
                }`}>
                {action.priority}
              </span>
            </div>
          ))}
          {summary.recommended_actions.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              No recommended actions pending.
            </div>
          )}
        </div>
        <button
          onClick={() => navigate('/recommendations')}
          className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-[#202124] transition-colors hover:underline"
        >
          Open recommendations <ArrowRight size={13} />
        </button>
      </BentoCard>
    </div>
  );
}
