import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip,
  PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import {
  Loader2, AlertCircle, X, RefreshCw, ChevronDown, ChevronRight,
  Sliders, Activity, Gauge, ListChecks, ScrollText, Lightbulb, FileWarning,
  AlertTriangle, Info, Calculator,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import RingProgress from '@/components/RingProgress';
import CategoryExplanationModal from '@/components/CategoryExplanationModal';
import RuleAuditModal from '@/components/RuleAuditModal';
import {
  api, type Application, type Assessment, type DomainBreakdown,
  type RulesResponse, type RuleInfo, type WhatIfResponse, type RuleFiring, type DomainScore,
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
  high: '#DC2626', medium: '#D97706', low: '#166534', info: '#2563EB',
};
const SCORE_COLORS = { complexity: '#F59E0B', confidence: '#3B82F6', readiness: '#10B981' } as const;
const MEASURE_LABELS: Record<string, string> = {
  complexity: 'Complexity', confidence: 'Evidence Completeness', readiness: 'Readiness',
};
const IMPACT_LABELS: Record<string, { label: string; color: string }> = {
  positive: { label: 'Positive', color: '#166534' }, negative: { label: 'Negative', color: '#DC2626' },
};
const CHART_TEXT = { fontSize: 10, fill: '#777D83', fontFamily: 'JetBrains Mono' } as const;

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

type ScoreKind = keyof typeof SCORE_COLORS;
const MEASURES: ScoreKind[] = ['complexity', 'confidence', 'readiness'];

export default function AssessmentPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [breakdown, setBreakdown] = useState<Record<string, DomainBreakdown>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drillKind, setDrillKind] = useState<ScoreKind | null>(null);
  const [drillDomain, setDrillDomain] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showRuleAudit, setShowRuleAudit] = useState(false);
  const [infoDomain, setInfoDomain] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    try {
      const data = await api.listApplications();
      setApps(data);
      setActiveApp(resolveActiveApp(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    }
  }, []);

  const loadAssessment = useCallback(async (appId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [assess, bd] = await Promise.all([
        api.getAssessment(appId),
        api.getDomainBreakdown(appId).catch(() => ({} as Record<string, DomainBreakdown>)),
      ]);
      setAssessment(assess);
      setBreakdown(bd ?? {});
    } catch {
      setAssessment(null);
      setBreakdown({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);
  useEffect(() => { if (activeApp) loadAssessment(activeApp.id); }, [activeApp, loadAssessment]);

  async function handleSelectApp(id: string) {
    setStoredActiveAppId(id);
    try {
      await api.updateApplication(id, { is_active: true });
      await loadApps();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to select application');
    }
  }

  async function handleRun() {
    if (!activeApp) return;
    setRunning(true);
    setError(null);
    try {
      const assess = await api.runAssessment(activeApp.id);
      setAssessment(assess);
      const bd = await api.getDomainBreakdown(activeApp.id).catch(() => ({}));
      setBreakdown(bd);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assessment failed');
    } finally {
      setRunning(false);
    }
  }

  const domainBarData = DOMAIN_ORDER.map((id) => {
    const ds = assessment?.domain_scores?.[id]?.complexity;
    const bd = breakdown[id];
    return {
      domain: id,
      label: bd?.label ?? DOMAIN_LABELS[id] ?? id,
      score: ds?.has_evidence && ds.score != null ? ds.score : 0,
      hasEvidence: Boolean(ds?.has_evidence),
    };
  });

  const radarData = DOMAIN_ORDER.map((id) => {
    const s = assessment?.domain_scores?.[id];
    const bd = breakdown[id];
    return {
      domain: (bd?.label ?? DOMAIN_LABELS[id] ?? id).split(' ')[0],
      complexity: s?.complexity?.has_evidence && s.complexity.score != null ? s.complexity.score : 0,
      confidence: s?.confidence?.has_evidence && s.confidence.score != null ? s.confidence.score : 0,
      readiness: s?.readiness?.has_evidence && s.readiness.score != null ? s.readiness.score : 0,
    };
  });

  const severityCounts = (assessment?.fired_rules ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.severity] = (acc[r.severity] || 0) + 1;
    return acc;
  }, {});
  const severityChartData = Object.entries(severityCounts).map(([sev, count]) => ({
    label: sev.charAt(0).toUpperCase() + sev.slice(1), value: count, color: SEVERITY_COLORS[sev] ?? '#777D83',
  }));

  if (apps.length === 0 && !loading) {
    return (
      <>
        <PageHeader title="Complexity Assessment" breadcrumb={['ReFrameX', 'Assessment']} />
        <BentoCard className="mx-auto flex max-w-xl flex-col items-center p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E3E5E7] bg-[#F1F2F3] text-[#202124]">
            <Gauge size={24} />
          </div>
          <h2 className="mb-2 text-xl font-medium tracking-tight text-[#202124]">No applications to assess</h2>
          <p className="max-w-sm text-xs leading-relaxed text-[#777D83]">
            Create an application and upload artifacts first, then run a complexity assessment to see domain scores here.
          </p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Complexity Assessment"
        breadcrumb={['ReFrameX', 'Assessment']}
        action={
          <div className="flex items-center gap-2.5">
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
            <button
              onClick={() => setShowRules(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3.5 py-2 text-xs font-semibold text-indigo-900 shadow-2xs transition-all hover:bg-indigo-100"
            >
              <Sliders size={13} className="text-indigo-600" /> Rule Studio
            </button>
            <button
              onClick={() => setShowRuleAudit(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2 text-xs font-semibold text-blue-900 shadow-2xs transition-all hover:bg-blue-100"
              title="Audit rule evaluations: view fired rules, skipped rules with clause traces, and reasons"
            >
              <ScrollText size={13} className="text-blue-600" /> Rule Audit & Trace
            </button>
            <button
              onClick={handleRun}
              disabled={running || !activeApp}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-600/20 transition-all hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50"
            >
              {running ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {running ? 'Assessing...' : 'Run Assessment'}
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#991B1B]">
          <AlertCircle size={15} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#777D83]">
          <Loader2 size={24} className="animate-spin text-[#202124]" />
        </div>
      ) : !assessment ? (
        <BentoCard className="mx-auto flex max-w-xl flex-col items-center p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E3E5E7] bg-[#F1F2F3] text-[#202124]">
            <Gauge size={24} />
          </div>
          <h2 className="mb-2 text-xl font-medium tracking-tight text-[#202124]">No assessment yet</h2>
          <p className="mb-6 max-w-sm text-xs leading-relaxed text-[#777D83]">
            Run an assessment to score complexity, confidence, and readiness across all eight domains using the ReFrameX ruleset.
          </p>
          <button
            onClick={handleRun}
            disabled={running || !activeApp}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#202124] px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#333538] disabled:opacity-50"
          >
            {running ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Run Assessment
          </button>
        </BentoCard>
      ) : (
        <div className="space-y-6">
          {/* Score rings */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <ScoreRingCard
              kind="complexity"
              score={assessment.complexity_score}
              classification={assessment.complexity_classification}
              domainsAssessed={assessment.domains_assessed ?? 8}
              onClick={() => setDrillKind('complexity')}
              onInfoClick={() => setInfoDomain('composite')}
            />
            <ScoreRingCard
              kind="confidence"
              score={assessment.confidence_score}
              classification={assessment.confidence_classification}
              onClick={() => setDrillKind('confidence')}
              onInfoClick={() => setInfoDomain('composite')}
            />
            <ScoreRingCard
              kind="readiness"
              score={assessment.readiness_score}
              classification={assessment.readiness_classification}
              onClick={() => setDrillKind('readiness')}
              onInfoClick={() => setInfoDomain('composite')}
            />
          </div>

          {/* Model & Normalization Formula Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-blue-50/40 via-white to-indigo-50/40 px-5 py-3.5 text-xs shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="font-mono font-bold text-indigo-900">{assessment.model_version}</span>
              <span className="text-slate-300">|</span>
              <span className="font-mono text-slate-600">Ruleset: <span className="font-semibold text-slate-800">{assessment.ruleset_id} (v{assessment.ruleset_version})</span></span>
              <span className="text-slate-300">|</span>
              <span className="font-mono text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">Rules Loaded: {assessment.rule_counts?.total ?? assessment.fired_rules.length} derived</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="font-mono text-[11px] text-slate-500">
                Normalization: saturating (hyperbolic): 100 × raw / (raw + 20)
              </div>
              <button
                type="button"
                onClick={() => setInfoDomain('composite')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                <Calculator size={12} /> Formula & Rules Explainer
              </button>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <BentoCard className="p-6 lg:col-span-2">
              <h3 className="mb-5 text-[13px] font-medium uppercase tracking-[0.08em] text-[#202124]">
                Domain Complexity Breakdown
              </h3>
              {domainBarData.length > 0 ? (
                <div style={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer>
                    <BarChart data={domainBarData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                      <XAxis type="number" axisLine={false} tickLine={false} tick={CHART_TEXT} domain={[0, 100]} />
                      <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} tick={CHART_TEXT} width={150} />
                      <Tooltip cursor={{ fill: 'rgba(25,30,35,0.03)' }} contentStyle={softGlassTooltipStyle} />
                      <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={14}>
                        {domainBarData.map((d, i) => (
                          <Cell key={i} fill={d.hasEvidence ? '#4F46E5' : '#E2E8F0'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart />}
            </BentoCard>
            <BentoCard className="p-6">
              <h3 className="mb-5 text-[13px] font-medium uppercase tracking-[0.08em] text-[#202124]">
                Risk Distribution
              </h3>
              {severityChartData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <div style={{ width: 120, height: 120 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={severityChartData} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={36} outerRadius={54} paddingAngle={3} stroke="none">
                          {severityChartData.map((s, i) => <Cell key={i} fill={s.color} />)}
                        </Pie>
                        <Tooltip contentStyle={softGlassTooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2.5">
                    {severityChartData.map((s) => (
                      <div key={s.label} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                          <span className="text-[#777D83]">{s.label}</span>
                        </div>
                        <span className="font-mono font-medium tabular-nums text-[#202124]">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <EmptyChart />}
            </BentoCard>
          </div>

          {/* Radar */}
          <BentoCard className="p-6">
            <h3 className="mb-5 text-[13px] font-medium uppercase tracking-[0.08em] text-[#202124]">
              Domain Score Radar
            </h3>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <RadarChart data={radarData} outerRadius={105}>
                  <PolarGrid stroke="#E3E5E7" />
                  <PolarAngleAxis dataKey="domain" tick={{ fontSize: 10, fill: '#777D83', fontFamily: 'JetBrains Mono' }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#A0A4A8', fontFamily: 'JetBrains Mono' }} />
                  <Radar name="Complexity" dataKey="complexity" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.18} />
                  <Radar name="Confidence" dataKey="confidence" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.18} />
                  <Radar name="Readiness" dataKey="readiness" stroke="#10B981" fill="#10B981" fillOpacity={0.18} />
                  <Tooltip contentStyle={softGlassTooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </BentoCard>

          {/* Domain cards */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#202124]">
                Domain Detail
              </h3>
              <button
                type="button"
                onClick={() => setInfoDomain('composite')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <Info size={13} className="text-blue-600" />
                <span>How domains are calculated</span>
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {DOMAIN_ORDER.map((id) => (
                <DomainCard
                  key={id}
                  domainId={id}
                  scores={assessment.domain_scores?.[id] ?? {}}
                  label={breakdown[id]?.label ?? DOMAIN_LABELS[id] ?? id}
                  onClick={() => setDrillDomain(id)}
                  onOpenInfo={(dId) => setInfoDomain(dId)}
                />
              ))}
            </div>
          </div>

          {/* Applied rules */}
          <BentoCard className="p-6">
            <h3 className="mb-5 flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.08em] text-[#202124]">
              <ListChecks size={16} className="text-[#202124]" /> Applied Rules
              <span className="font-mono text-xs font-normal text-[#777D83]">({assessment.fired_rules.length})</span>
            </h3>
            {assessment.fired_rules.length > 0 ? (
              <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                {assessment.fired_rules.map((rule) => <RuleRow key={`${rule.rule_id}-${rule.domain}`} rule={rule} />)}
              </div>
            ) : (
              <div className="flex items-center justify-center py-10 text-xs text-[#A0A4A8]">
                No rules fired — the application scored cleanly against the ruleset.
              </div>
            )}
          </BentoCard>

          {/* Missing / limitations / next steps */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <InfoListCard title="Missing Information" icon={<FileWarning size={16} className="text-amber-500" />} items={assessment.missing_information} bullet="•" bulletColor="text-amber-500" topBorder="border-t-4 border-amber-500" />
            <InfoListCard title="Assessment Limitations" icon={<AlertTriangle size={16} className="text-rose-500" />} items={assessment.assessment_limitations} bullet="•" bulletColor="text-rose-500" topBorder="border-t-4 border-rose-500" />
            <InfoListCard title="Recommended Next Steps" icon={<Lightbulb size={16} className="text-emerald-500" />} items={assessment.recommended_next_steps} bullet="→" bulletColor="text-emerald-500" topBorder="border-t-4 border-emerald-500" />
          </div>

          {/* Meta */}
          <BentoCard className="p-5" dense>
            <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-[#777D83]">
              <span>ASSESSED AT: <span className="font-medium text-[#202124]">{assessment.computed_at}</span></span>
              <span>RULESET: <span className="font-medium text-[#202124]">{assessment.ruleset_version}</span></span>
              <span>MODEL: <span className="font-medium text-[#202124]">{assessment.model_version}</span></span>
            </div>
          </BentoCard>
        </div>
      )}

      {drillKind && assessment && <DrillDrawer kind={drillKind} assessment={assessment} onClose={() => setDrillKind(null)} />}
      {drillDomain && assessment && (
        <DomainDrawer
          domainId={drillDomain}
          assessment={assessment}
          breakdown={breakdown[drillDomain]}
          onClose={() => setDrillDomain(null)}
          onOpenInfo={(dId) => setInfoDomain(dId)}
        />
      )}
      {showRules && activeApp && <RuleStudioModal appId={activeApp.id} onClose={() => setShowRules(false)} />}
      {showRuleAudit && activeApp && (
        <RuleAuditModal
          appId={activeApp.id}
          appName={activeApp.name}
          onClose={() => setShowRuleAudit(false)}
        />
      )}
      <CategoryExplanationModal
        isOpen={!!infoDomain}
        domainId={infoDomain}
        assessment={assessment}
        onClose={() => setInfoDomain(null)}
      />
    </>
  );
}

function ScoreRingCard({
  kind,
  score,
  classification,
  domainsAssessed,
  onClick,
  onInfoClick,
}: {
  kind: ScoreKind;
  score: number;
  classification: string;
  domainsAssessed?: number;
  onClick: () => void;
  onInfoClick?: () => void;
}) {
  const color = SCORE_COLORS[kind];
  const hint = kind === 'complexity'
    ? `Complexity based on ${domainsAssessed ?? 8} of 8 domains`
    : kind === 'confidence'
      ? 'Evidence completeness across 8 domains'
      : 'higher = better';
  const topBorder = kind === 'complexity'
    ? 'border-t-4 border-amber-500'
    : kind === 'confidence'
      ? 'border-t-4 border-blue-500'
      : 'border-t-4 border-emerald-500';

  const cardTitle = kind === 'confidence'
    ? 'Evidence completeness measures whether all 8 architecture domains have parsed evidence, penalizing unevidenced domains, inferred/assumed evidence classes, and parse errors.'
    : undefined;

  return (
    <BentoCard
      title={cardTitle}
      className={`flex items-center gap-5 p-6 cursor-pointer hover:shadow-md transition-all ${topBorder}`}
      onClick={onClick}
    >
      <RingProgress value={score} size={96} color={color} sublabel="/ 100" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{MEASURE_LABELS[kind]}</div>
          {onInfoClick && (
            <button
              type="button"
              title={`View ${MEASURE_LABELS[kind]} formula and proof`}
              onClick={(e) => {
                e.stopPropagation();
                onInfoClick();
              }}
              className="rounded p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Info size={13} />
            </button>
          )}
        </div>
        <div className="mt-1 font-sans text-base font-bold text-slate-900">{classification}</div>
        <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>
        <div className="mt-2.5 inline-flex items-center gap-1 font-mono text-[11px] font-semibold" style={{ color }}>
          <ChevronRight size={12} /> Drill down
        </div>
      </div>
    </BentoCard>
  );
}

function DomainCard({
  domainId,
  scores,
  label,
  onClick,
  onOpenInfo,
}: {
  domainId: string;
  scores: Record<string, DomainScore>;
  label: string;
  onClick: () => void;
  onOpenInfo: (domainId: string) => void;
}) {
  const anyEvidence = MEASURES.some((m) => scores[m]?.has_evidence);
  return (
    <BentoCard className="p-5 cursor-pointer hover:border-[#CBD5E1]" onClick={onClick}>
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <h4 className="text-xs font-medium text-[#202124] leading-snug truncate">{label}</h4>
          <button
            type="button"
            title={`View ${label} calculation formula & rules`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenInfo(domainId);
            }}
            className="rounded-md p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
          >
            <Info size={13} />
          </button>
        </div>
        {!anyEvidence && (
          <span className="rounded-lg border border-[#DDD6FE] bg-[#F5F3FF] px-2 py-0.5 font-mono text-[9px] font-medium text-[#5B21B6]">
            Not assessed
          </span>
        )}
      </div>
      <div className="flex items-center gap-6">
        {MEASURES.map((m) => {
          const s = scores[m];
          return (
            <div key={m} className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#A0A4A8]">{MEASURE_LABELS[m]}</span>
              <span className="font-mono text-base font-normal tabular-nums leading-tight" style={{ color: s?.has_evidence && s.score != null ? SCORE_COLORS[m] : '#A0A4A8' }}>
                {s?.has_evidence && s.score != null ? s.score : '—'}
              </span>
            </div>
          );
        })}
        <button className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-medium text-[#202124] shrink-0 hover:underline">
          <ChevronRight size={12} /> Details
        </button>
      </div>
    </BentoCard>
  );
}

function RuleRow({ rule }: { rule: RuleFiring }) {
  const [open, setOpen] = useState(false);
  const impact = IMPACT_LABELS[rule.impact] ?? { label: rule.impact, color: '#777D83' };
  const sevColor = SEVERITY_COLORS[rule.severity] ?? '#777D83';
  return (
    <div className="overflow-hidden rounded-xl border border-[#E3E5E7] bg-white">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-[#F1F2F3]/60">
        <ChevronRight size={13} className={`shrink-0 text-[#A0A4A8] transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="max-w-[180px] shrink-0 truncate font-mono text-xs font-medium text-[#202124]">{rule.rule_id}</span>
        <span className="flex-1 truncate text-xs text-[#202124]">{rule.description}</span>
        <span className="shrink-0 rounded-lg px-2 py-0.5 font-mono text-[10px] font-medium" style={{ background: `${sevColor}15`, color: sevColor, border: `1px solid ${sevColor}30` }}>
          {rule.severity}
        </span>
        <span className="shrink-0 rounded-lg px-2 py-0.5 font-mono text-[10px] font-medium" style={{ background: `${impact.color}15`, color: impact.color, border: `1px solid ${impact.color}30` }}>
          {impact.label}
        </span>
        <span className="shrink-0 font-mono text-xs font-medium tabular-nums" style={{ color: impact.color }}>
          {rule.points > 0 ? '+' : ''}{rule.points}
        </span>
      </button>
      {open && (
        <div className="space-y-3.5 border-t border-[#E3E5E7] bg-[#F1F2F3]/70 p-4">
          <p className="text-xs leading-relaxed text-[#777D83]">{rule.explanation}</p>
          <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-3">
            <Meta label="Domain" value={DOMAIN_LABELS[rule.domain] ?? rule.domain} />
            <Meta label="Measure" value={MEASURE_LABELS[rule.measure] ?? rule.measure} />
            <Meta label="Weight" value={String(rule.weight)} />
          </div>
          {rule.recommendation && (
            <div className="rounded-xl border border-[#DCFCE7] bg-[#F0FDF4] p-3 text-xs text-[#166534]">
              <span className="font-semibold">Recommendation: </span>{rule.recommendation}
            </div>
          )}
          {rule.upgrade_guidance && (
            <div className="rounded-xl border border-[#FEF08A] bg-[#FEFCE8] p-3 text-xs text-[#92400E]">
              <span className="font-semibold">Upgrade guidance: </span>{rule.upgrade_guidance}
            </div>
          )}
          {rule.evidence_refs.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[#777D83]">
                <ScrollText size={12} /> Evidence References
              </div>
              <div className="space-y-2">
                {rule.evidence_refs.map((ref, i) => (
                  <div key={i} className="rounded-xl border border-[#E3E5E7] bg-white p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-mono text-[10px] font-medium text-[#202124]">{ref.rule}</span>
                      <span className="font-mono text-[10px] text-[#A0A4A8]">Line {ref.line_start}{ref.line_end !== ref.line_start ? `–${ref.line_end}` : ''}</span>
                    </div>
                    {ref.snippet && <pre className="font-mono text-[10px] text-[#202124] whitespace-pre-wrap break-all">{ref.snippet}</pre>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E3E5E7] bg-white p-2.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#A0A4A8]">{label}</div>
      <div className="font-mono text-xs font-medium text-[#202124] truncate">{value}</div>
    </div>
  );
}

function InfoListCard({ title, icon, items, bullet, bulletColor, topBorder }: { title: string; icon: React.ReactNode; items: string[]; bullet: string; bulletColor: string; topBorder?: string }) {
  return (
    <BentoCard className={`p-6 ${topBorder ?? ''}`}>
      <h3 className="mb-4 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] text-slate-800">
        {icon} {title}
      </h3>
      {items.length > 0 ? (
        <ul className="space-y-2.5">
          {items.map((m, i) => (
            <li key={i} className="flex gap-2 text-xs text-[#777D83]">
              <span className={`${bulletColor} shrink-0 mt-0.5 font-bold`}>{bullet}</span>
              <span>{m}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-[#A0A4A8]">None recorded.</p>}
    </BentoCard>
  );
}

function DrillDrawer({ kind, assessment, onClose }: { kind: ScoreKind; assessment: Assessment; onClose: () => void }) {
  const color = SCORE_COLORS[kind];
  const score = kind === 'complexity' ? assessment.complexity_score : kind === 'confidence' ? assessment.confidence_score : assessment.readiness_score;
  const classification = kind === 'complexity' ? assessment.complexity_classification : kind === 'confidence' ? assessment.confidence_classification : assessment.readiness_classification;
  const relatedRules = assessment.fired_rules.filter((r) => r.measure === kind);

  return (
    <DrawerShell title={`${MEASURE_LABELS[kind]} Drill-Down`} subtitle={classification} onClose={onClose}>
      <div className="mb-6 flex justify-center">
        <RingProgress value={score} size={120} color={color} sublabel="/ 100" label={MEASURE_LABELS[kind]} />
      </div>
      <div className="space-y-4">
        <h4 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-[#777D83]">
          Related Rules ({relatedRules.length})
        </h4>
        <div className="space-y-2.5">
          {relatedRules.map((rule) => <RuleRow key={`${rule.rule_id}-${rule.domain}`} rule={rule} />)}
        </div>
      </div>
    </DrawerShell>
  );
}

function DomainDrawer({ domainId, assessment, breakdown, onClose, onOpenInfo }: {
  domainId: string; assessment: Assessment; breakdown?: DomainBreakdown; onClose: () => void; onOpenInfo: (domainId: string) => void;
}) {
  const label = breakdown?.label ?? DOMAIN_LABELS[domainId] ?? domainId;
  const relatedRules = assessment.fired_rules.filter((r) => r.domain === domainId);

  return (
    <DrawerShell
      title={label}
      subtitle="Domain Assessment Detail"
      onClose={onClose}
      actionButton={
        <button
          type="button"
          onClick={() => onOpenInfo(domainId)}
          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
        >
          <Info size={13} /> Formula Proof
        </button>
      }
    >
      <div className="mb-6 grid grid-cols-3 gap-3">
        {MEASURES.map((m) => {
          const ds = assessment.domain_scores?.[domainId]?.[m];
          return (
            <div key={m} className="rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] p-3 text-center">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#777D83]">{MEASURE_LABELS[m]}</span>
              <div className="mt-1 font-mono text-xl font-medium tabular-nums" style={{ color: ds?.has_evidence ? SCORE_COLORS[m] : '#A0A4A8' }}>
                {ds?.has_evidence && ds.score != null ? ds.score : '—'}
              </div>
            </div>
          );
        })}
      </div>
      <div className="space-y-3.5">
        <h4 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-[#777D83]">
          Applied Domain Rules ({relatedRules.length})
        </h4>
        <div className="space-y-2.5">
          {relatedRules.map((rule) => <RuleRow key={`${rule.rule_id}-${rule.domain}`} rule={rule} />)}
        </div>
      </div>
    </DrawerShell>
  );
}

function RuleStudioModal({ appId, onClose }: { appId: string; onClose: () => void }) {
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRules().then((res: RulesResponse) => {
      setRules(res.rules);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#202124]/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl border border-[#E3E5E7] bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between border-b border-[#E3E5E7] pb-4">
          <h2 className="text-base font-medium text-[#202124]">ReFrameX Rule Studio</h2>
          <button onClick={onClose} className="rounded-xl p-1 text-[#777D83] hover:bg-[#F1F2F3]"><X size={16} /></button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#202124]" /></div>
        ) : (
          <div className="max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
            {rules.map((r) => (
              <div key={r.rule_id} className="rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium text-[#202124]">{r.rule_id}</span>
                  <span className="font-mono text-[10px] text-[#777D83]">{r.domain} · Weight: {r.weight}</span>
                </div>
                <p className="mt-1 text-[#202124]">{r.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DrawerShell({ title, subtitle, onClose, actionButton, children }: { title: string; subtitle?: string; onClose: () => void; actionButton?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#202124]/30 backdrop-blur-sm" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-[#E3E5E7] bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between border-b border-[#E3E5E7] pb-4">
          <div>
            <h2 className="text-base font-medium text-[#202124]">{title}</h2>
            {subtitle && <p className="font-mono text-xs text-[#777D83]">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {actionButton}
            <button onClick={onClose} className="rounded-xl p-1.5 text-[#777D83] hover:bg-[#F1F2F3]"><X size={18} /></button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-40 items-center justify-center text-xs text-[#A0A4A8]">
      No data available for this chart.
    </div>
  );
}
