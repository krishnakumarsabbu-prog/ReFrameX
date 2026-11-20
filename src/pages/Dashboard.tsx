import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip,
  PieChart, Pie,
} from 'recharts';
import { Boxes as BoxesIcon, Link2 as DepsIcon, AlertTriangle as RiskIcon,
  Gauge as GaugeIcon, ShieldCheck as ShieldIcon,
  Plus as PlusIcon, Clock, Zap, TrendingUp, Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import MetricCard from '@/components/MetricCard';
import RingProgress from '@/components/RingProgress';
import StatusBadge from '@/components/StatusBadge';
import {
  kpis, componentTrend, readinessDistribution, domains,
  recentAssessments, topRisks, recommendedActions,
} from '@/mock-data';

interface DashboardProps {
  activeTab: string;
}

export default function Dashboard({ activeTab }: DashboardProps) {
  const navigate = useNavigate();
  const kpiIcons = [
    <BoxesIcon size={16} key="0" />,
    <BoxesIcon size={16} key="1" />,
    <DepsIcon size={16} key="2" />,
    <RiskIcon size={16} key="3" />,
    <GaugeIcon size={16} key="4" />,
    <ShieldIcon size={16} key="5" />,
  ];

  return (
    <>
      <PageHeader
        title="Executive Dashboard"
        breadcrumb={['ReframeX', 'Executive Dashboard']}
        action={
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-amber-200/40 border border-amber-300/30 text-xs font-medium text-ink-muted">
            <Sparkles size={12} /> Illustrative demo data
          </span>
        }
      />

      {activeTab === 'overview' && <OverviewTab kpiIcons={kpiIcons} navigate={navigate} />}
      {activeTab === 'risks' && <RisksTab navigate={navigate} />}
      {activeTab === 'actions' && <ActionsTab />}
    </>
  );
}

function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[10px] font-medium bg-amber-200/40 text-ink-muted">
      Demo data
    </span>
  );
}

function OverviewTab({ kpiIcons, navigate }: { kpiIcons: React.ReactNode[]; navigate: (path: string) => void }) {
  return (
    <div className="space-y-5">
      {/* Hero bento row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Total components — large card with bar chart */}
        <BentoCard className="lg:col-span-2 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-ink mb-1">Total Components</h3>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-semibold text-ink tracking-tight">1,842</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-severity-low/15 text-severity-low text-xs font-medium">
                  <TrendingUp size={12} /> +38 this month
                </span>
              </div>
            </div>
            <DemoBadge />
          </div>
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={componentTrend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8A8A93' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8A8A93' }} width={50} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.2)' }}
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid #E2DED8',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="rgba(255,255,255,0.7)">
                  {componentTrend.map((entry, i) => (
                    <Cell key={i} fill={i === componentTrend.length - 1 ? 'rgb(232,85,43)' : 'rgba(255,255,255,0.65)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </BentoCard>

        {/* Migration readiness distribution */}
        <BentoCard className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink">Migration Readiness</h3>
            <DemoBadge />
          </div>
          <div className="flex items-center gap-4">
            <div style={{ width: 140, height: 140 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={readinessDistribution}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={62}
                    paddingAngle={3}
                  >
                    {readinessDistribution.map((slice, i) => (
                      <Cell key={i} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.95)',
                      border: '1px solid #E2DED8',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {readinessDistribution.map((slice) => (
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
        </BentoCard>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, i) => (
          <MetricCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            unit={kpi.unit}
            trend={kpi.trend}
            trendDirection={kpi.trendDirection}
            hint={kpi.hint}
            icon={kpiIcons[i]}
          />
        ))}
      </div>

      {/* Domain ring cards — bento grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink">Assessment Domains</h3>
          <DemoBadge />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {domains.map((domain) => (
            <BentoCard key={domain.id} className="p-5 flex flex-col items-center" onClick={() => navigate('/complexity')}>
              <RingProgress value={domain.readiness} size={100} stroke={9} sublabel="readiness" />
              <span className="text-xs font-medium text-ink text-center mt-3 leading-tight">{domain.shortLabel}</span>
              <div className="flex items-center gap-3 mt-3 text-[10px] text-ink-soft">
                <span>Cx {domain.complexity}</span>
                <span>·</span>
                <span>{domain.components} comp</span>
              </div>
            </BentoCard>
          ))}
          {/* Ghost add card */}
          <button
            onClick={() => navigate('/applications')}
            className="rounded-bento border-2 border-dashed border-white/40 hover:border-accent/50 flex flex-col items-center justify-center p-5 min-h-[180px] transition-all duration-200 hover:bg-white/10"
          >
            <PlusIcon size={24} className="text-ink-soft mb-2" />
            <span className="text-xs font-medium text-ink-muted">Add application</span>
          </button>
        </div>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent assessments */}
        <BentoCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink">Recent Assessments</h3>
            <DemoBadge />
          </div>
          <div className="space-y-3">
            {recentAssessments.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-white/20 last:border-0">
                <div>
                  <div className="text-sm font-medium text-ink">{a.application}</div>
                  <div className="text-[10px] text-ink-soft flex items-center gap-1 mt-0.5">
                    <Clock size={10} /> {a.date}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-xs font-medium text-ink">Cx {a.complexity}</div>
                    <div className="text-[10px] text-ink-soft">Cf {a.confidence}%</div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              </div>
            ))}
          </div>
        </BentoCard>

        {/* Top risks */}
        <BentoCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink">Top Risks</h3>
            <DemoBadge />
          </div>
          <div className="space-y-3">
            {topRisks.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-white/20 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink truncate">{r.component}</div>
                  <div className="text-[10px] text-ink-soft truncate">{r.application} · {r.category}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge evidence={r.evidence} />
                  <StatusBadge severity={r.severity} />
                </div>
              </div>
            ))}
          </div>
        </BentoCard>

        {/* Recommended actions */}
        <BentoCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink">Recommended Actions</h3>
            <DemoBadge />
          </div>
          <div className="space-y-3">
            {recommendedActions.map((act) => (
              <div key={act.id} className="py-2 border-b border-white/20 last:border-0">
                <div className="flex items-start gap-2">
                  <Zap size={14} className="text-accent mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-ink leading-snug">{act.action}</div>
                    <div className="text-[10px] text-ink-soft mt-1">{act.application} · {act.effort}</div>
                  </div>
                  <span className={`text-[10px] font-medium shrink-0 ${
                    act.priority === 'High' ? 'text-severity-high' : 'text-severity-medium'
                  }`}>
                    {act.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </BentoCard>
      </div>
    </div>
  );
}

function RisksTab({ navigate }: { navigate: (path: string) => void }) {
  return (
    <div className="space-y-5">
      <BentoCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink">Risk Register Summary</h3>
          <DemoBadge />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-3xl font-semibold text-severity-high">12</div>
            <div className="text-xs text-ink-soft mt-1">High severity</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-semibold text-severity-medium">28</div>
            <div className="text-xs text-ink-soft mt-1">Medium severity</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-semibold text-severity-low">15</div>
            <div className="text-xs text-ink-soft mt-1">Low severity</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-semibold text-evidence-unknown">19</div>
            <div className="text-xs text-ink-soft mt-1">Unknown / missing</div>
          </div>
        </div>
        <div className="space-y-2">
          {topRisks.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-3 px-4 rounded-2xl bg-white/20 hover:bg-white/30 transition-colors">
              <div className="flex items-center gap-3">
                <AlertTriangle size={16} className="text-severity-high shrink-0" />
                <div>
                  <div className="text-sm font-medium text-ink">{r.component}</div>
                  <div className="text-[10px] text-ink-soft">{r.application} · {r.category}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge evidence={r.evidence} />
                <StatusBadge severity={r.severity} />
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => navigate('/risks')}
          className="mt-4 flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
        >
          View all risks <ArrowRight size={14} />
        </button>
      </BentoCard>
    </div>
  );
}

function ActionsTab() {
  return (
    <div className="space-y-5">
      <BentoCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink">Action Queue</h3>
          <DemoBadge />
        </div>
        <div className="space-y-3">
          {recommendedActions.map((act, i) => (
            <div key={act.id} className="flex items-start gap-4 py-4 px-4 rounded-2xl bg-white/20 hover:bg-white/30 transition-colors">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-accent-soft text-accent text-xs font-semibold shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink leading-snug">{act.action}</div>
                <div className="text-[10px] text-ink-soft mt-1">{act.application} · {act.effort}</div>
              </div>
              <span className={`text-xs font-medium shrink-0 ${
                act.priority === 'High' ? 'text-severity-high' : 'text-severity-medium'
              }`}>
                {act.priority}
              </span>
            </div>
          ))}
        </div>
      </BentoCard>
    </div>
  );
}
