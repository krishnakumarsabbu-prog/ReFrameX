import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, CalendarDays,
  ChevronRight, Clock3, FileCheck2, Filter, Gauge, GitBranch,
  Search, ShieldAlert, Sparkles, Zap,
} from 'lucide-react';
import BentoCard from '@/components/BentoCard';
import StatusBadge from '@/components/StatusBadge';
import {
  componentTrend, domains, kpis, readinessDistribution, recentAssessments,
  recommendedActions, topRisks,
} from '@/mock-data';
import type { RecentAssessment } from '@/types';

interface DashboardProps {
  activeTab: string;
}

export default function Dashboard({ activeTab }: DashboardProps) {
  const navigate = useNavigate();
  const greeting = getGreeting();

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-7">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-ink-muted mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-severity-low" />
            MIGRATION INTELLIGENCE
            <ChevronRight size={13} className="text-ink-soft" />
            OVERVIEW
          </div>
          <h1 className="text-3xl md:text-[2.4rem] font-semibold text-ink tracking-tight leading-tight">
            {greeting}, ReFrameX
          </h1>
          <p className="text-sm text-ink-muted mt-1.5">
            Explore portfolio indicators and see how evidence informs modernization planning.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-pill inner-glass text-xs text-ink-muted">
            <CalendarDays size={14} /> Illustrative demo data
          </span>
          <button
            onClick={() => navigate('/applications')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-pill bg-ink text-white text-sm font-medium hover:bg-ink/85 transition-colors shadow-sm"
          >
            <Boxes size={15} /> Applications <ArrowUpRight size={14} />
          </button>
        </div>
      </header>

      {activeTab === 'overview' && <OverviewTab navigate={navigate} />}
      {activeTab === 'risks' && <RisksTab navigate={navigate} />}
      {activeTab === 'actions' && <ActionsTab navigate={navigate} />}
    </>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function OverviewTab({ navigate }: { navigate: (path: string) => void }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const summaryMetrics = [
    { id: 'components', icon: Boxes, tone: 'teal' as const, note: 'Across the portfolio' },
    { id: 'deps', icon: GitBranch, tone: 'neutral' as const, note: 'Mapped relationships' },
    { id: 'highrisk', icon: ShieldAlert, tone: 'rose' as const, note: 'Require attention' },
    { id: 'avgcomplexity', icon: Gauge, tone: 'neutral' as const, note: 'Migration complexity' },
  ].map((item) => ({ ...item, metric: kpis.find((metric) => metric.id === item.id)! }));

  const assessments = useMemo(() => recentAssessments.filter((assessment) => {
    const matchesQuery = `${assessment.application} ${assessment.readiness}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === 'All statuses' || assessment.status === statusFilter;
    return matchesQuery && matchesStatus;
  }), [query, statusFilter]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <PortfolioCard navigate={navigate} />

        <BentoCard className="lg:col-span-4 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-ink-muted">Portfolio snapshot</p>
              <h2 className="text-sm font-semibold text-ink mt-0.5">Key indicators</h2>
            </div>
            <span className="w-8 h-8 flex items-center justify-center rounded-full bg-white/40 text-ink-muted">
              <Activity size={16} />
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {summaryMetrics.map(({ metric, icon: Icon, tone, note }) => (
              <MetricTile key={metric.id} metric={metric} Icon={Icon} tone={tone} note={note} />
            ))}
          </div>
        </BentoCard>

        <ReadinessCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <EvidenceCard />
        <AssessmentsCard
          assessments={assessments}
          query={query}
          onQueryChange={setQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          onOpenAll={() => navigate('/reports')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DomainsCard navigate={navigate} />
        <InsightsCard navigate={navigate} />
      </div>
    </div>
  );
}

function PortfolioCard({ navigate }: { navigate: (path: string) => void }) {
  const totalComponents = kpis.find((metric) => metric.id === 'components');
  const totalApplications = kpis.find((metric) => metric.id === 'apps');

  return (
    <BentoCard className="lg:col-span-4 p-5 sm:p-6 flex flex-col justify-between min-h-[242px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-muted">Illustrative portfolio</p>
          <div className="text-4xl sm:text-[2.65rem] font-semibold tracking-tight text-ink mt-2">
            {totalApplications?.value ?? '—'}
            <span className="text-base font-medium text-ink-muted ml-2">applications</span>
          </div>
        </div>
        <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-white/45 text-ink">
          <Boxes size={19} />
        </span>
      </div>

      <div className="mt-4 flex-1 min-h-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-ink-muted">Component inventory</span>
          <span className="text-xs font-medium text-ink">{totalComponents?.value ?? '—'}</span>
        </div>
        <div className="h-2.5 rounded-pill bg-white/40 overflow-hidden">
          <div className="h-full w-[72%] rounded-pill bg-gradient-to-r from-[#0C8F7A] to-[#56C3AF]" />
        </div>
        <div className="flex items-center justify-between mt-2 text-[11px] text-ink-soft">
          <span>Discovery across 6 portfolios</span>
          <span className="inline-flex items-center gap-1 text-severity-low font-medium">
            <ArrowUpRight size={12} /> +38 this month
          </span>
        </div>
      </div>

      <div className="flex gap-2 mt-5">
        <button
          onClick={() => navigate('/artifacts')}
          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-pill bg-ink text-white text-xs sm:text-sm font-medium hover:bg-ink/85 transition-colors"
        >
          <FileCheck2 size={14} /> Explore artifacts
        </button>
        <button
          onClick={() => navigate('/applications')}
          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-pill bg-white/70 text-ink text-xs sm:text-sm font-medium hover:bg-white transition-colors"
        >
          View applications <ArrowRight size={14} />
        </button>
      </div>
    </BentoCard>
  );
}

function MetricTile({
  metric, Icon, tone, note,
}: {
  metric: (typeof kpis)[number];
  Icon: typeof Boxes;
  tone: 'teal' | 'neutral' | 'rose';
  note: string;
}) {
  const toneClass = tone === 'teal'
    ? 'dashboard-metric--teal'
    : tone === 'rose'
      ? 'dashboard-metric--rose'
      : 'dashboard-metric--neutral';
  const TrendIcon = metric.trendDirection === 'down' ? ArrowDownRight : ArrowUpRight;

  return (
    <div className={`dashboard-metric ${toneClass} rounded-2xl p-3.5 min-h-[91px]`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] leading-tight text-ink-muted">{metric.label}</span>
        <Icon size={14} className="shrink-0 text-ink-soft" />
      </div>
      <div className="flex items-baseline gap-1 mt-2">
        <span className="text-2xl font-semibold leading-none text-ink tracking-tight">{metric.value}</span>
        {metric.unit && <span className="text-[11px] text-ink-soft">{metric.unit}</span>}
      </div>
      <div className="flex items-center justify-between gap-1 mt-1.5">
        <span className="text-[10px] text-ink-soft truncate">{note}</span>
        {metric.trend && (
          <span className="inline-flex items-center text-[10px] font-medium text-severity-low shrink-0">
            <TrendIcon size={11} /> {metric.trend}
          </span>
        )}
      </div>
    </div>
  );
}

function ReadinessCard() {
  const readyCount = readinessDistribution.find((slice) => slice.label === 'Ready for Planning')?.value ?? 0;
  const readyPercent = Math.round((readyCount / readinessDistribution.reduce((sum, slice) => sum + slice.value, 0)) * 100);

  return (
    <BentoCard className="lg:col-span-4 p-5 sm:p-6 min-h-[242px]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Migration readiness</p>
          <p className="text-xs text-ink-soft mt-1">Assessment status across applications</p>
        </div>
        <span className="px-2.5 py-1 rounded-pill bg-white/45 text-[10px] text-ink-muted">24 applications</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 mt-4">
        <div className="relative w-[132px] h-[132px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={readinessDistribution}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={62}
                paddingAngle={3}
                stroke="none"
              >
                {readinessDistribution.map((slice) => <Cell key={slice.label} fill={slice.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'rgba(255,255,255,0.96)',
                  border: '1px solid rgba(255,255,255,0.7)',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-semibold tracking-tight text-ink">{readyPercent}%</span>
            <span className="text-[9px] uppercase tracking-wide text-ink-soft">planning ready</span>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          {readinessDistribution.map((slice) => (
            <div key={slice.label}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="flex items-center gap-1.5 text-[11px] text-ink-muted min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                  <span className="truncate">{slice.label}</span>
                </span>
                <span className="text-xs font-semibold text-ink">{slice.value}</span>
              </div>
              <div className="h-1.5 rounded-pill bg-white/45 overflow-hidden">
                <div
                  className="h-full rounded-pill"
                  style={{
                    width: `${(slice.value / readinessDistribution.reduce((sum, item) => sum + item.value, 0)) * 100}%`,
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

function EvidenceCard() {
  const confidence = Number(kpis.find((metric) => metric.id === 'avgconfidence')?.value ?? 0);

  return (
    <BentoCard className="lg:col-span-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">Component discovery</p>
          <p className="text-xs text-ink-soft mt-1">Inventory growth across the last eight months</p>
        </div>
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/40 text-ink-muted">
          <Activity size={15} />
        </span>
      </div>
      <div className="h-[112px] mt-2 -ml-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={componentTrend} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="componentTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0C8F7A" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#4ABBA6" stopOpacity={0.48} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71675E' }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: '#71675E' }}
              width={42}
              domain={[1200, 1900]}
              tickFormatter={(value: number) => `${(value / 1000).toFixed(1)}k`}
            />
            <Tooltip
              formatter={(value: number) => [value.toLocaleString(), 'Components']}
              contentStyle={{
                background: 'rgba(255,255,255,0.96)',
                border: '1px solid rgba(255,255,255,0.7)',
                borderRadius: '12px',
                fontSize: '11px',
              }}
            />
            <Bar dataKey="value" fill="url(#componentTrendFill)" radius={[5, 5, 1, 1]}>
              {componentTrend.map((entry, index) => (
                <Cell key={entry.label} fill={index === componentTrend.length - 1 ? '#0C8F7A' : 'url(#componentTrendFill)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-end justify-between gap-2 mt-1">
        <div>
          <span className="text-2xl font-semibold tracking-tight text-ink">{confidence}%</span>
          <span className="text-[11px] text-ink-soft ml-1.5">evidence confidence</span>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-pill bg-emerald-500/10 text-emerald-700 text-[10px] font-medium">
          <ArrowUpRight size={12} /> Portfolio avg.
        </span>
      </div>
      <div className="h-2 rounded-pill bg-white/45 overflow-hidden mt-2">
        <div
          className="h-full rounded-pill bg-gradient-to-r from-[#0C8F7A] to-[#65C6AE]"
          style={{ width: `${confidence}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="rounded-2xl bg-white/25 p-3">
          <p className="text-[10px] text-ink-soft">Assessment domains</p>
          <p className="text-lg font-semibold text-ink mt-1">{domains.length}</p>
        </div>
        <div className="rounded-2xl bg-white/25 p-3">
          <p className="text-[10px] text-ink-soft">High-risk components</p>
          <p className="text-lg font-semibold text-ink mt-1">{kpis.find((metric) => metric.id === 'highrisk')?.value}</p>
        </div>
      </div>
    </BentoCard>
  );
}

function AssessmentsCard({
  assessments, query, onQueryChange, statusFilter, onStatusChange, onOpenAll,
}: {
  assessments: RecentAssessment[];
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  onOpenAll: () => void;
}) {
  return (
    <BentoCard className="lg:col-span-8 p-5 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-ink">Recent assessments</p>
          <p className="text-xs text-ink-soft mt-1">Latest application readiness reviews</p>
        </div>
        <div className="flex gap-2">
          <label className="relative flex-1 sm:w-40">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search"
              aria-label="Search assessments"
              className="w-full pl-8 pr-3 py-2 rounded-pill bg-white/25 border border-white/35 text-xs text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            />
          </label>
          <label className="relative">
            <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(event) => onStatusChange(event.target.value)}
              aria-label="Filter assessments by status"
              className="appearance-none pl-8 pr-3 py-2 rounded-pill bg-white/25 border border-white/35 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            >
              <option>All statuses</option>
              <option>Complete</option>
              <option>In Progress</option>
              <option>Pending</option>
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[620px] text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-ink-soft border-b border-white/35">
              <th className="font-medium py-2.5 px-2">Application</th>
              <th className="font-medium py-2.5 px-2">Readiness</th>
              <th className="font-medium py-2.5 px-2">Complexity</th>
              <th className="font-medium py-2.5 px-2">Confidence</th>
              <th className="font-medium py-2.5 px-2">Status</th>
              <th className="font-medium py-2.5 px-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {assessments.map((assessment) => (
              <tr key={assessment.id} className="border-b border-white/20 last:border-0 hover:bg-white/15 transition-colors">
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-white/50 flex items-center justify-center text-ink-muted">
                      <Boxes size={13} />
                    </span>
                    <span className="text-xs font-semibold text-ink">{assessment.application}</span>
                  </div>
                </td>
                <td className="py-3 px-2"><StatusBadge status={assessment.readiness} /></td>
                <td className="py-3 px-2 text-xs text-ink-muted">{assessment.complexity}/100</td>
                <td className="py-3 px-2 text-xs text-ink-muted">{assessment.confidence}%</td>
                <td className="py-3 px-2"><StatusBadge status={assessment.status} /></td>
                <td className="py-3 px-2 text-xs text-ink-soft whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5"><Clock3 size={12} /> {assessment.date}</span>
                </td>
              </tr>
            ))}
            {assessments.length === 0 && (
              <tr>
                <td colSpan={6} className="py-9 text-center text-sm text-ink-muted">
                  No assessments match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button
        onClick={onOpenAll}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
      >
        View assessment reports <ArrowRight size={13} />
      </button>
    </BentoCard>
  );
}

function DomainsCard({ navigate }: { navigate: (path: string) => void }) {
  return (
    <BentoCard className="p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-ink">Assessment domains</p>
          <p className="text-xs text-ink-soft mt-1">Readiness by modernization workstream</p>
        </div>
        <button
          onClick={() => navigate('/complexity')}
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
        >
          Details <ArrowRight size={13} />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {domains.slice(0, 8).map((domain) => (
          <button
            key={domain.id}
            onClick={() => navigate('/complexity')}
            className="text-left rounded-2xl bg-white/20 hover:bg-white/35 p-3 transition-colors"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] text-ink-muted truncate">{domain.shortLabel}</span>
              <span className="text-xs font-semibold text-ink">{domain.readiness}%</span>
            </div>
            <div className="h-1.5 rounded-pill bg-white/45 overflow-hidden mt-2">
              <div
                className="h-full rounded-pill bg-gradient-to-r from-[#148E7D] to-[#73C8B2]"
                style={{ width: `${domain.readiness}%` }}
              />
            </div>
            <p className="text-[9px] text-ink-soft mt-1.5">{domain.components} components</p>
          </button>
        ))}
      </div>
    </BentoCard>
  );
}

function InsightsCard({ navigate }: { navigate: (path: string) => void }) {
  return (
    <BentoCard className="p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-ink">Priority insights</p>
          <p className="text-xs text-ink-soft mt-1">Risks and actions that need attention</p>
        </div>
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-800">
          <Sparkles size={15} />
        </span>
      </div>
      <div className="space-y-2.5">
        {topRisks.slice(0, 2).map((risk) => (
          <button
            key={risk.id}
            onClick={() => navigate('/risks')}
            className="flex items-center justify-between gap-3 w-full rounded-2xl bg-white/20 hover:bg-white/35 p-3 text-left transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0">
              <ShieldAlert size={15} className="text-severity-high shrink-0" />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-ink truncate">{risk.component}</span>
                <span className="block text-[10px] text-ink-soft truncate">{risk.application} · {risk.category}</span>
              </span>
            </span>
            <StatusBadge severity={risk.severity} />
          </button>
        ))}
        {recommendedActions.slice(0, 1).map((action) => (
          <button
            key={action.id}
            onClick={() => navigate('/recommendations')}
            className="flex items-center gap-2.5 w-full rounded-2xl bg-emerald-700/10 hover:bg-emerald-700/15 p-3 text-left transition-colors"
          >
            <Zap size={15} className="text-emerald-800 shrink-0" />
            <span className="text-xs text-ink leading-snug line-clamp-2">{action.action}</span>
            <ArrowRight size={13} className="text-ink-soft shrink-0" />
          </button>
        ))}
      </div>
    </BentoCard>
  );
}

function RisksTab({ navigate }: { navigate: (path: string) => void }) {
  const counts = [
    { label: 'High severity', value: topRisks.filter((risk) => risk.severity === 'high').length, color: 'text-severity-high' },
    { label: 'Medium severity', value: topRisks.filter((risk) => risk.severity === 'medium').length, color: 'text-severity-medium' },
    { label: 'Low severity', value: topRisks.filter((risk) => risk.severity === 'low').length, color: 'text-severity-low' },
    { label: 'Unknown evidence', value: topRisks.filter((risk) => risk.evidence === 'Unknown').length, color: 'text-evidence-unknown' },
  ];

  return (
    <div className="space-y-5">
      <BentoCard className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-ink">Risk register summary</h2>
            <p className="text-xs text-ink-soft mt-1">Prioritize assessment findings by severity and evidence.</p>
          </div>
          <ShieldAlert size={18} className="text-severity-high" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {counts.map((count) => (
            <div key={count.label} className="rounded-2xl bg-white/25 p-4">
              <div className={`text-2xl font-semibold ${count.color}`}>{count.value}</div>
              <div className="text-xs text-ink-soft mt-1">{count.label}</div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {topRisks.map((risk) => (
            <div key={risk.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-4 rounded-2xl bg-white/20 hover:bg-white/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <ShieldAlert size={16} className="text-severity-high shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{risk.component}</div>
                  <div className="text-[10px] text-ink-soft">{risk.application} · {risk.category}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-7 sm:pl-0">
                <StatusBadge evidence={risk.evidence} />
                <StatusBadge severity={risk.severity} />
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => navigate('/risks')}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink transition-colors"
        >
          Open full risk register <ArrowRight size={14} />
        </button>
      </BentoCard>
    </div>
  );
}

function ActionsTab({ navigate }: { navigate: (path: string) => void }) {
  return (
    <div className="space-y-5">
      <BentoCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Recommended action queue</h2>
            <p className="text-xs text-ink-soft mt-1">Practical next steps to reduce migration risk.</p>
          </div>
          <Zap size={17} className="text-amber-700" />
        </div>
        <div className="space-y-2">
          {recommendedActions.map((action, index) => (
            <div key={action.id} className="flex items-start gap-3 sm:gap-4 py-4 px-3 sm:px-4 rounded-2xl bg-white/20 hover:bg-white/30 transition-colors">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-700/10 text-emerald-800 text-xs font-semibold shrink-0">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink leading-snug">{action.action}</div>
                <div className="text-[10px] text-ink-soft mt-1.5">{action.application} · Estimated effort: {action.effort}</div>
              </div>
              <span className={`text-[10px] sm:text-xs font-semibold shrink-0 ${
                action.priority === 'High' ? 'text-severity-high' : 'text-severity-medium'
              }`}>
                {action.priority}
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={() => navigate('/recommendations')}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink transition-colors"
        >
          Open recommendations <ArrowRight size={14} />
        </button>
      </BentoCard>
    </div>
  );
}
