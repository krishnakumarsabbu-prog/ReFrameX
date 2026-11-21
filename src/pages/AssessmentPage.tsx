import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip,
  PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import {
  Loader2, AlertCircle, X, RefreshCw, ChevronDown, ChevronRight,
  Sliders, Activity, Gauge, ListChecks, ScrollText, Lightbulb, FileWarning,
  AlertTriangle, Info,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import RingProgress from '@/components/RingProgress';
import {
  api, type Application, type Assessment, type DomainBreakdown,
  type RulesResponse, type RuleInfo, type WhatIfResponse, type RuleFiring, type DomainScore,
} from '@/api/client';

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
  high: '#E88555', medium: '#E8A838', low: '#4D8F86', info: '#8A8A93',
};
const SCORE_COLORS = { complexity: '#E88555', confidence: '#4D8F86', readiness: '#5B9E6A' } as const;
const MEASURE_LABELS: Record<string, string> = {
  complexity: 'Complexity', confidence: 'Confidence', readiness: 'Readiness',
};
const IMPACT_LABELS: Record<string, { label: string; color: string }> = {
  positive: { label: 'Positive', color: '#5B9E6A' }, negative: { label: 'Negative', color: '#E88555' },
};
const CHART_TEXT = { fontSize: 11, fill: '#8A8A93' } as const;
const TOOLTIP_STYLE = { background: 'rgba(255,255,255,0.97)', border: '1px solid #D9E3EB', borderRadius: '12px', fontSize: '12px' } as const;

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

  const loadApps = useCallback(async () => {
    try {
      const data = await api.listApplications();
      setApps(data);
      setActiveApp(data.find((a) => a.is_active) ?? data[0] ?? null);
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
      const result = await api.runAssessment(activeApp.id);
      setAssessment(result);
      setBreakdown(await api.getDomainBreakdown(activeApp.id).catch(() => ({} as Record<string, DomainBreakdown>)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assessment failed');
    } finally {
      setRunning(false);
    }
  }

  // Derived data
  const severityCounts = assessment?.fired_rules.reduce<Record<string, number>>((acc, r) => {
    acc[r.severity] = (acc[r.severity] ?? 0) + 1; return acc;
  }, {}) ?? {};
  const severityChartData = Object.entries(severityCounts).map(([sev, count]) => ({
    label: sev.charAt(0).toUpperCase() + sev.slice(1), value: count, color: SEVERITY_COLORS[sev] ?? '#8A8A93',
  }));
  const domainBarData = DOMAIN_ORDER.map((id) => {
    const ds = assessment?.domain_scores?.[id]?.['complexity'];
    return { id, label: DOMAIN_LABELS[id] ?? id, score: ds?.score ?? 0, hasEvidence: ds?.has_evidence ?? false };
  }).filter((d) => d.hasEvidence || d.score > 0);
  const radarData = DOMAIN_ORDER.map((id) => {
    const ds = assessment?.domain_scores?.[id];
    return {
      domain: DOMAIN_LABELS[id]?.replace(/ &.*/, '') ?? id,
      complexity: ds?.['complexity']?.score ?? 0,
      confidence: ds?.['confidence']?.score ?? 0,
      readiness: ds?.['readiness']?.score ?? 0,
    };
  });

  if (apps.length === 0 && !loading) {
    return (
      <>
        <PageHeader title="Complexity Assessment" breadcrumb={['ReframeX', 'Assessment']} />
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent"><Gauge size={28} /></div>
          <h2 className="text-xl font-semibold text-ink mb-2">No applications to assess</h2>
          <p className="text-ink-muted max-w-sm">Create an application and upload artifacts first, then run a complexity assessment to see domain scores here.</p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Complexity Assessment"
        breadcrumb={['ReframeX', 'Assessment']}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={activeApp?.id ?? ''}
                onChange={(e) => handleSelectApp(e.target.value)}
                className="inner-glass rounded-pill px-3 py-1.5 pr-8 text-xs font-medium text-ink-muted appearance-none cursor-pointer hover:bg-white/35 transition-colors"
              >
                {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
            </div>
            <button onClick={() => setShowRules(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-pill inner-glass text-ink-muted text-sm font-medium hover:bg-white/35 transition-colors">
              <Sliders size={14} /> Rule Studio
            </button>
            <button onClick={handleRun} disabled={running || !activeApp} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors">
              {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {running ? 'Assessing...' : 'Run Assessment'}
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
      ) : !assessment ? (
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto" dense>
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent"><Gauge size={28} /></div>
          <h2 className="text-xl font-semibold text-ink mb-2">No assessment yet</h2>
          <p className="text-ink-muted max-w-sm mb-6">Run an assessment to score complexity, confidence, and readiness across all eight domains using the ReframeX ruleset.</p>
          <button onClick={handleRun} disabled={running || !activeApp} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-pill bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors">
            {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Run Assessment
          </button>
        </BentoCard>
      ) : (
        <div className="space-y-5">
          {/* Score rings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <ScoreRingCard kind="complexity" score={assessment.complexity_score} classification={assessment.complexity_classification} onClick={() => setDrillKind('complexity')} />
            <ScoreRingCard kind="confidence" score={assessment.confidence_score} classification={assessment.confidence_classification} onClick={() => setDrillKind('confidence')} />
            <ScoreRingCard kind="readiness" score={assessment.readiness_score} classification={assessment.readiness_classification} onClick={() => setDrillKind('readiness')} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <BentoCard className="lg:col-span-2 p-6">
              <h3 className="text-sm font-semibold text-ink mb-4">Domain Complexity Breakdown</h3>
              {domainBarData.length > 0 ? (
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer>
                    <BarChart data={domainBarData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                      <XAxis type="number" axisLine={false} tickLine={false} tick={CHART_TEXT} domain={[0, 100]} />
                      <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} tick={CHART_TEXT} width={140} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.2)' }} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={16}>
                        {domainBarData.map((d, i) => <Cell key={i} fill={d.hasEvidence ? '#E88555' : '#D9C1A2'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart />}
            </BentoCard>
            <BentoCard className="p-6">
              <h3 className="text-sm font-semibold text-ink mb-4">Risk Distribution</h3>
              {severityChartData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <div style={{ width: 130, height: 130 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={severityChartData} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={35} outerRadius={58} paddingAngle={3}>
                          {severityChartData.map((s, i) => <Cell key={i} fill={s.color} />)}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {severityChartData.map((s) => (
                      <div key={s.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} /><span className="text-xs text-ink-muted">{s.label}</span></div>
                        <span className="text-sm font-semibold text-ink">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <EmptyChart />}
            </BentoCard>
          </div>

          {/* Radar */}
          <BentoCard className="p-6">
            <h3 className="text-sm font-semibold text-ink mb-4">Domain Score Radar</h3>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <RadarChart data={radarData} outerRadius={110}>
                  <PolarGrid stroke="rgba(255,255,255,0.3)" />
                  <PolarAngleAxis dataKey="domain" tick={{ fontSize: 10, fill: '#8A8A93' }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#A89B94' }} />
                  <Radar name="Complexity" dataKey="complexity" stroke="#E88555" fill="#E88555" fillOpacity={0.25} />
                  <Radar name="Confidence" dataKey="confidence" stroke="#4D8F86" fill="#4D8F86" fillOpacity={0.25} />
                  <Radar name="Readiness" dataKey="readiness" stroke="#5B9E6A" fill="#5B9E6A" fillOpacity={0.25} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </BentoCard>

          {/* Domain cards */}
          <div>
            <h3 className="text-sm font-semibold text-ink mb-3">Domain Detail</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DOMAIN_ORDER.map((id) => (
                <DomainCard key={id} domainId={id} scores={assessment.domain_scores?.[id] ?? {}} label={breakdown[id]?.label ?? DOMAIN_LABELS[id] ?? id} onClick={() => setDrillDomain(id)} />
              ))}
            </div>
          </div>

          {/* Applied rules */}
          <BentoCard className="p-6">
            <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
              <ListChecks size={16} className="text-accent" /> Applied Rules
              <span className="text-xs text-ink-soft font-normal">({assessment.fired_rules.length})</span>
            </h3>
            {assessment.fired_rules.length > 0 ? (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {assessment.fired_rules.map((rule) => <RuleRow key={`${rule.rule_id}-${rule.domain}`} rule={rule} />)}
              </div>
            ) : (
              <div className="flex items-center justify-center py-10 text-ink-soft text-sm">No rules fired — the application scored cleanly against the ruleset.</div>
            )}
          </BentoCard>

          {/* Missing / limitations / next steps */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <InfoListCard title="Missing Information" icon={<FileWarning size={16} className="text-severity-medium" />} items={assessment.missing_information} bullet="•" bulletColor="text-severity-medium" />
            <InfoListCard title="Assessment Limitations" icon={<AlertTriangle size={16} className="text-severity-medium" />} items={assessment.assessment_limitations} bullet="•" bulletColor="text-severity-medium" />
            <InfoListCard title="Recommended Next Steps" icon={<Lightbulb size={16} className="text-severity-low" />} items={assessment.recommended_next_steps} bullet="→" bulletColor="text-severity-low" />
          </div>

          {/* Meta */}
          <BentoCard className="p-4" dense>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] text-ink-soft">
              <span>Model: <span className="text-ink-muted">{assessment.model_version}</span></span>
              <span>Ruleset: <span className="text-ink-muted">{assessment.ruleset_id} v{assessment.ruleset_version}</span></span>
              <span>Computed: <span className="text-ink-muted">{new Date(assessment.computed_at).toLocaleString()}</span></span>
              <span>Duration: <span className="text-ink-muted">{(assessment.duration_ms / 1000).toFixed(2)}s</span></span>
            </div>
          </BentoCard>
        </div>
      )}

      {drillKind && assessment && <DrillDrawer kind={drillKind} assessment={assessment} onClose={() => setDrillKind(null)} />}
      {drillDomain && assessment && <DomainDrawer domainId={drillDomain} assessment={assessment} breakdown={breakdown[drillDomain]} onClose={() => setDrillDomain(null)} />}
      {showRules && activeApp && <RuleStudioModal appId={activeApp.id} onClose={() => setShowRules(false)} />}
    </>
  );
}

/* ---- Score ring card ---- */
function ScoreRingCard({ kind, score, classification, onClick }: { kind: ScoreKind; score: number; classification: string; onClick: () => void }) {
  const color = SCORE_COLORS[kind];
  const hint = kind === 'complexity' ? 'higher = more complex' : 'higher = better';
  return (
    <BentoCard className="p-6 flex items-center gap-5" onClick={onClick}>
      <RingProgress value={score} size={104} color={color} sublabel="/ 100" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-ink-soft uppercase tracking-wide">{MEASURE_LABELS[kind]}</div>
        <div className="text-base font-semibold text-ink mt-1">{classification}</div>
        <div className="text-[11px] text-ink-soft mt-1">{hint}</div>
        <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium" style={{ color }}><ChevronRight size={12} /> Drill down</div>
      </div>
    </BentoCard>
  );
}

/* ---- Domain card ---- */
function DomainCard({ scores, label, onClick }: { domainId: string; scores: Record<string, DomainScore>; label: string; onClick: () => void }) {
  const anyEvidence = MEASURES.some((m) => scores[m]?.has_evidence);
  return (
    <BentoCard className="p-5" onClick={onClick}>
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-sm font-semibold text-ink leading-snug">{label}</h4>
        {!anyEvidence && <span className="inline-flex px-2 py-0.5 rounded-pill text-[10px] font-medium bg-evidence-unknown/15 text-evidence-unknown shrink-0">Not assessed</span>}
      </div>
      <div className="flex items-center gap-5">
        {MEASURES.map((m) => {
          const s = scores[m];
          return (
            <div key={m} className="flex flex-col">
              <span className="text-[10px] text-ink-soft uppercase tracking-wide">{MEASURE_LABELS[m]}</span>
              <span className="text-lg font-semibold leading-tight" style={{ color: s?.has_evidence && s.score != null ? SCORE_COLORS[m] : '#A89B94' }}>
                {s?.has_evidence && s.score != null ? s.score : '—'}
              </span>
            </div>
          );
        })}
        <button className="ml-auto text-[11px] font-medium text-accent inline-flex items-center gap-0.5 shrink-0"><ChevronRight size={12} /> Details</button>
      </div>
    </BentoCard>
  );
}

/* ---- Rule row (expandable) ---- */
function RuleRow({ rule }: { rule: RuleFiring }) {
  const [open, setOpen] = useState(false);
  const impact = IMPACT_LABELS[rule.impact] ?? { label: rule.impact, color: '#8A8A93' };
  const sevColor = SEVERITY_COLORS[rule.severity] ?? '#8A8A93';
  return (
    <div className="rounded-tile bg-white/30 border border-solid-border/50 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/40 transition-colors">
        <ChevronRight size={14} className={`text-ink-soft shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="text-xs font-mono text-accent shrink-0 truncate max-w-[180px]">{rule.rule_id}</span>
        <span className="text-xs text-ink-muted flex-1 truncate">{rule.description}</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-medium shrink-0" style={{ background: `${sevColor}22`, color: sevColor }}>{rule.severity}</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-medium shrink-0" style={{ background: `${impact.color}22`, color: impact.color }}>{impact.label}</span>
        <span className="text-xs font-semibold shrink-0" style={{ color: impact.color }}>{rule.points > 0 ? '+' : ''}{rule.points}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-solid-border/40 space-y-3">
          <p className="text-xs text-ink-muted pt-2">{rule.explanation}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <Meta label="Domain" value={DOMAIN_LABELS[rule.domain] ?? rule.domain} />
            <Meta label="Measure" value={MEASURE_LABELS[rule.measure] ?? rule.measure} />
            <Meta label="Weight" value={String(rule.weight)} />
          </div>
          {rule.recommendation && <div className="text-xs text-ink-muted px-3 py-2 rounded-tile bg-severity-low/10"><span className="font-medium text-severity-low">Recommendation: </span>{rule.recommendation}</div>}
          {rule.upgrade_guidance && <div className="text-xs text-ink-muted px-3 py-2 rounded-tile bg-severity-medium/10"><span className="font-medium text-severity-medium">Upgrade guidance: </span>{rule.upgrade_guidance}</div>}
          {rule.evidence_refs.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1.5 flex items-center gap-1"><ScrollText size={12} /> Evidence</div>
              <div className="space-y-1.5">
                {rule.evidence_refs.map((ref, i) => (
                  <div key={i} className="px-2.5 py-1.5 rounded-tile bg-white/30 border border-solid-border/40">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-medium text-accent">{ref.rule}</span>
                      <span className="text-[10px] text-ink-soft">Line {ref.line_start}{ref.line_end !== ref.line_start ? `–${ref.line_end}` : ''}</span>
                    </div>
                    {ref.snippet && <pre className="text-[10px] font-mono text-ink-muted whitespace-pre-wrap break-all">{ref.snippet}</pre>}
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
    <div className="px-2.5 py-1.5 rounded-tile bg-white/20">
      <div className="text-[10px] text-ink-soft">{label}</div>
      <div className="text-xs font-medium text-ink">{value}</div>
    </div>
  );
}

/* ---- Info list card (missing/limitations/next steps) ---- */
function InfoListCard({ title, icon, items, bullet, bulletColor }: { title: string; icon: React.ReactNode; items: string[]; bullet: string; bulletColor: string }) {
  return (
    <BentoCard className="p-6">
      <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">{icon} {title}</h3>
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((m, i) => (
            <li key={i} className="text-xs text-ink-muted flex gap-2">
              <span className={`${bulletColor} shrink-0 mt-0.5`}>{bullet}</span><span>{m}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-ink-soft">None recorded.</p>}
    </BentoCard>
  );
}

/* ---- Drill drawer (per score kind) ---- */
function DrillDrawer({ kind, assessment, onClose }: { kind: ScoreKind; assessment: Assessment; onClose: () => void }) {
  const color = SCORE_COLORS[kind];
  const score = kind === 'complexity' ? assessment.complexity_score : kind === 'confidence' ? assessment.confidence_score : assessment.readiness_score;
  const classification = kind === 'complexity' ? assessment.complexity_classification : kind === 'confidence' ? assessment.confidence_classification : assessment.readiness_classification;
  const relatedRules = assessment.fired_rules.filter((r) => r.measure === kind);
  const domainRows = DOMAIN_ORDER.map((id) => {
    const ds = assessment.domain_scores?.[id]?.[kind];
    return { label: DOMAIN_LABELS[id] ?? id, score: ds?.score, has: ds?.has_evidence ?? false };
  }).filter((d) => d.has);
  const factors = kind === 'complexity' ? { neg: assessment.negative_factors, pos: assessment.positive_factors } : null;

  return (
    <DrawerShell title={`${MEASURE_LABELS[kind]} Drill-Down`} subtitle={classification} onClose={onClose}>
      <div className="flex justify-center mb-6"><RingProgress value={score} size={140} color={color} sublabel="/ 100" label={MEASURE_LABELS[kind]} /></div>
      <Section title="Contributing Domains">
        {domainRows.length > 0 ? (
          <div className="space-y-2">
            {domainRows.map((d, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-tile bg-white/20">
                <span className="text-xs text-ink-muted">{d.label}</span>
                <span className="text-sm font-semibold" style={{ color }}>{d.score ?? '—'}</span>
              </div>
            ))}
          </div>
        ) : <Empty>No domains with evidence for this measure.</Empty>}
      </Section>
      {factors && (factors.neg.length > 0 || factors.pos.length > 0) && (
        <Section title="Factors">
          {factors.neg.length > 0 && <FactorList title="Negative factors" items={factors.neg} color="#E88555" />}
          {factors.pos.length > 0 && <FactorList title="Positive factors" items={factors.pos} color="#5B9E6A" />}
        </Section>
      )}
      <Section title={`Fired Rules (${relatedRules.length})`}>
        {relatedRules.length > 0 ? (
          <div className="space-y-2">{relatedRules.map((r) => <RuleRow key={`${r.rule_id}-${r.domain}`} rule={r} />)}</div>
        ) : <Empty>No rules fired for this measure.</Empty>}
      </Section>
    </DrawerShell>
  );
}

/* ---- Domain drawer ---- */
function DomainDrawer({ domainId, assessment, breakdown, onClose }: { domainId: string; assessment: Assessment; breakdown?: DomainBreakdown; onClose: () => void }) {
  const label = breakdown?.label ?? DOMAIN_LABELS[domainId] ?? domainId;
  const ds = assessment.domain_scores?.[domainId] ?? {};
  const fired = assessment.fired_rules.filter((r) => r.domain === domainId);
  const refs = breakdown ? MEASURES.flatMap((m) => breakdown.scores[m]?.evidence_refs ?? []) : [];

  return (
    <DrawerShell title={label} subtitle={domainId} onClose={onClose}>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {MEASURES.map((m) => {
          const s = ds[m];
          return (
            <div key={m} className="flex flex-col items-center py-3 rounded-tile bg-white/20">
              <span className="text-[10px] text-ink-soft uppercase tracking-wide">{MEASURE_LABELS[m]}</span>
              <span className="text-2xl font-semibold mt-1" style={{ color: s?.has_evidence && s.score != null ? SCORE_COLORS[m] : '#A89B94' }}>{s?.has_evidence && s.score != null ? s.score : '—'}</span>
              <span className="text-[10px] text-ink-soft mt-0.5">{s?.classification ?? 'N/A'}</span>
            </div>
          );
        })}
      </div>

      {MEASURES.some((m) => (ds[m]?.positive_factors.length ?? 0) > 0) && (
        <Section title="Positive Factors">
          <ul>{MEASURES.flatMap((m) => (ds[m]?.positive_factors ?? []).map((f, i) => <li key={`${m}-${i}`} className="text-xs text-ink-muted flex gap-2 py-1"><span className="text-severity-low shrink-0">+</span><span>{f}</span></li>))}</ul>
        </Section>
      )}
      {MEASURES.some((m) => (ds[m]?.negative_factors.length ?? 0) > 0) && (
        <Section title="Negative Factors">
          <ul>{MEASURES.flatMap((m) => (ds[m]?.negative_factors ?? []).map((f, i) => <li key={`${m}-${i}`} className="text-xs text-ink-muted flex gap-2 py-1"><span className="text-severity-high shrink-0">−</span><span>{f}</span></li>))}</ul>
        </Section>
      )}
      {MEASURES.some((m) => (ds[m]?.not_evidenced_notes.length ?? 0) > 0) && (
        <Section title="Not Evidenced Notes">
          <ul>{MEASURES.flatMap((m) => (ds[m]?.not_evidenced_notes ?? []).map((n, i) => <li key={`${m}-${i}`} className="text-xs text-ink-muted flex gap-2 py-1"><Info size={12} className="text-ink-soft shrink-0 mt-0.5" /><span>{n}</span></li>))}</ul>
        </Section>
      )}

      <Section title={`Fired Rules (${fired.length})`}>
        {fired.length > 0 ? <div className="space-y-2">{fired.map((r) => <RuleRow key={`${r.rule_id}-${r.measure}`} rule={r} />)}</div> : <Empty>No rules fired in this domain.</Empty>}
      </Section>

      {refs.length > 0 && (
        <Section title="Evidence References">
          <div className="space-y-1.5">
            {refs.map((ref, i) => (
              <div key={i} className="px-2.5 py-1.5 rounded-tile bg-white/30 border border-solid-border/40">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-medium text-accent">{ref.rule}</span>
                  <span className="text-[10px] text-ink-soft">Line {ref.line_start}{ref.line_end !== ref.line_start ? `–${ref.line_end}` : ''}</span>
                </div>
                {ref.snippet && <pre className="text-[10px] font-mono text-ink-muted whitespace-pre-wrap break-all">{ref.snippet}</pre>}
              </div>
            ))}
          </div>
        </Section>
      )}
    </DrawerShell>
  );
}

/* ---- Rule Studio modal ---- */
function RuleStudioModal({ appId, onClose }: { appId: string; onClose: () => void }) {
  const [rules, setRules] = useState<RulesResponse | null>(null);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [whatif, setWhatif] = useState<WhatIfResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getRules().then((res) => {
      setRules(res);
      const init: Record<string, number> = {};
      res.rules.forEach((r) => { init[r.rule_id] = r.weight; });
      setOverrides(init);
    }).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load rules')).finally(() => setLoading(false));
  }, []);

  const grouped = DOMAIN_ORDER.map((id) => ({ id, label: DOMAIN_LABELS[id] ?? id, rules: rules?.rules.filter((r) => r.domain === id) ?? [] })).filter((g) => g.rules.length > 0);
  const changedCount = rules ? rules.rules.filter((r) => overrides[r.rule_id] !== r.weight).length : 0;

  async function handleRunWhatIf() {
    setRunning(true); setError(null);
    try { setWhatif(await api.runWhatIf(appId, overrides)); }
    catch (e) { setError(e instanceof Error ? e.message : 'What-if failed'); }
    finally { setRunning(false); }
  }

  function resetAll() {
    if (!rules) return;
    const init: Record<string, number> = {};
    rules.rules.forEach((r) => { init[r.rule_id] = r.weight; });
    setOverrides(init); setWhatif(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass w-full max-w-4xl max-h-[88vh] flex flex-col rounded-bento overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-solid-border/50">
          <div>
            <h2 className="text-lg font-semibold text-ink flex items-center gap-2"><Sliders size={18} className="text-accent" /> Rule Studio</h2>
            <p className="text-xs text-ink-soft mt-0.5">Adjust rule weights and preview score impact. What-if results are temporary and not persisted.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/40"><X size={18} /></button>
        </div>

        {error && <div className="mx-6 mt-4 flex items-center gap-2 px-4 py-2.5 rounded-tile bg-severity-high/10 text-severity-high text-xs"><AlertCircle size={14} /> {error}</div>}

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20 text-ink-muted"><Loader2 size={24} className="animate-spin" /></div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-ink-soft">{rules?.ruleset_info.ruleset_id} v{rules?.ruleset_info.version} · {rules?.rules.length} rules</span>
                <button onClick={resetAll} className="text-xs text-accent hover:underline">Reset all</button>
              </div>
              <div className="space-y-5">
                {grouped.map((g) => (
                  <div key={g.id}>
                    <h4 className="text-xs font-semibold text-ink mb-2 uppercase tracking-wide">{g.label}</h4>
                    <div className="space-y-1.5">
                      {g.rules.map((r) => <RuleWeightRow key={r.rule_id} rule={r} value={overrides[r.rule_id] ?? r.weight} onChange={(v) => setOverrides((prev) => ({ ...prev, [r.rule_id]: v }))} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {whatif && (
              <div className="px-6 py-4 border-t border-solid-border/50 bg-white/20">
                <h4 className="text-xs font-semibold text-ink mb-3 uppercase tracking-wide">What-If Comparison</h4>
                <div className="grid grid-cols-2 gap-4">
                  <WhatIfSide title="Before" assessment={whatif.before} />
                  <WhatIfSide title="After" assessment={whatif.after} highlight />
                </div>
                <p className="text-[10px] text-ink-soft mt-3 flex items-center gap-1"><Info size={11} /> What-if results are temporary and not persisted.</p>
              </div>
            )}

            <div className="flex items-center justify-between px-6 py-4 border-t border-solid-border/50">
              <span className="text-xs text-ink-soft">{changedCount > 0 ? `${changedCount} weight${changedCount === 1 ? '' : 's'} changed` : 'No changes'}</span>
              <button onClick={handleRunWhatIf} disabled={running || changedCount === 0} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors">
                {running ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />} Run What-If
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RuleWeightRow({ rule, value, onChange }: { rule: RuleInfo; value: number; onChange: (v: number) => void }) {
  const changed = value !== rule.weight;
  const sevColor = SEVERITY_COLORS[rule.severity] ?? '#8A8A93';
  const impact = IMPACT_LABELS[rule.impact] ?? { label: rule.impact, color: '#8A8A93' };
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-tile bg-white/20">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-accent shrink-0">{rule.rule_id}</span>
          <span className="text-xs text-ink-muted truncate">{rule.description}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="inline-flex px-1.5 py-0 rounded-pill text-[9px] font-medium" style={{ background: `${sevColor}22`, color: sevColor }}>{rule.severity}</span>
          <span className="inline-flex px-1.5 py-0 rounded-pill text-[9px] font-medium" style={{ background: `${impact.color}22`, color: impact.color }}>{impact.label}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input type="range" min={0} max={50} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-24 accent-[#0D7490]" />
        <span className={`text-xs font-mono w-7 text-right ${changed ? 'text-accent font-semibold' : 'text-ink-muted'}`}>{value}</span>
      </div>
    </div>
  );
}

function WhatIfSide({ title, assessment, highlight }: { title: string; assessment: Assessment; highlight?: boolean }) {
  const score = (k: ScoreKind) => k === 'complexity' ? assessment.complexity_score : k === 'confidence' ? assessment.confidence_score : assessment.readiness_score;
  return (
    <div className={`rounded-tile p-3 ${highlight ? 'bg-accent-soft' : 'bg-white/20'}`}>
      <div className="text-xs font-semibold text-ink mb-2">{title}</div>
      <div className="space-y-1.5">
        {MEASURES.map((m) => (
          <div key={m} className="flex items-center justify-between">
            <span className="text-[11px] text-ink-soft">{MEASURE_LABELS[m]}</span>
            <span className="text-sm font-semibold" style={{ color: SCORE_COLORS[m] }}>{score(m)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1.5 border-t border-solid-border/40">
          <span className="text-[11px] text-ink-soft">Rules fired</span>
          <span className="text-sm font-semibold text-ink">{assessment.fired_rules.length}</span>
        </div>
      </div>
    </div>
  );
}

/* ---- Shared primitives ---- */
function DrawerShell({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="dense-surface w-full max-w-xl h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()} style={{ borderRadius: 0 }}>
        <div className="flex items-center justify-between mb-5">
          <div><h2 className="text-lg font-semibold text-ink">{title}</h2>{subtitle && <p className="text-xs text-ink-soft mt-0.5">{subtitle}</p>}</div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/40"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mb-5"><h3 className="text-xs font-semibold text-ink mb-2 uppercase tracking-wide">{title}</h3>{children}</div>;
}

function FactorList({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div className="mb-3">
      <div className="text-[11px] font-medium mb-1" style={{ color }}>{title}</div>
      <ul className="space-y-1">{items.map((f, i) => <li key={i} className="text-xs text-ink-muted flex gap-2 py-1"><span className="shrink-0" style={{ color }}>•</span><span>{f}</span></li>)}</ul>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-ink-soft py-3 text-center">{children}</div>;
}

function EmptyChart() {
  return <div className="flex items-center justify-center h-48 text-ink-soft text-sm">No data available</div>;
}
