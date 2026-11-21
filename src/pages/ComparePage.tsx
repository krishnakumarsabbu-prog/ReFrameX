import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertCircle, X, Columns3, ChevronDown,
  AlertTriangle, ArrowRight, Info,
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import { api, type Application, type Comparison, type ComparisonAppSummary } from '@/api/client';

const DOMAIN_KEYS = [
  'application_business_logic',
  'data_structures',
  'database_persistence',
  'jobs_batch_orchestration',
  'online_transactions_ui',
  'integration_external_dependencies',
  'security_controls',
  'operational_nonfunctional',
];

const SHORT_LABELS: Record<string, string> = {
  application_business_logic: 'Business Logic',
  data_structures: 'Data Structures',
  database_persistence: 'Database',
  jobs_batch_orchestration: 'Batch & Jobs',
  online_transactions_ui: 'Online & UI',
  integration_external_dependencies: 'Integration',
  security_controls: 'Security',
  operational_nonfunctional: 'Operational',
};

export default function ComparePage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [appAId, setAppAId] = useState<string>('');
  const [appBId, setAppBId] = useState<string>('');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    try {
      const data = await api.listApplications();
      setApps(data);
      if (data.length >= 2) {
        setAppAId(data[0].id);
        setAppBId(data[1].id);
      } else if (data.length === 1) {
        setAppAId(data[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    }
  }, []);

  const loadComparison = useCallback(async () => {
    if (!appAId || !appBId || appAId === appBId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.compareApplications(appAId, appBId);
      setComparison(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to compare applications');
      setComparison(null);
    } finally {
      setLoading(false);
    }
  }, [appAId, appBId]);

  useEffect(() => { loadApps(); }, [loadApps]);
  useEffect(() => { loadComparison(); }, [loadComparison]);

  const radarData = useCallback(() => {
    if (!comparison) return [];
    return DOMAIN_KEYS.map((key) => {
      const a = comparison.application_a.domain_complexity[key];
      const b = comparison.application_b.domain_complexity[key];
      return {
        domain: SHORT_LABELS[key],
        appA: a?.complexity_score ?? 0,
        appB: b?.complexity_score ?? 0,
      };
    });
  }, [comparison]);

  if (apps.length === 0 && !loading) {
    return (
      <>
        <PageHeader title="Application Comparison" breadcrumb={['ReframeX', 'Compare']} />
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent"><Columns3 size={28} /></div>
          <h2 className="text-xl font-semibold text-ink mb-2">No applications to compare</h2>
          <p className="text-ink-muted max-w-sm">Create at least two applications, upload artifacts, and run assessments to compare them.</p>
        </BentoCard>
      </>
    );
  }

  if (apps.length < 2) {
    return (
      <>
        <PageHeader title="Application Comparison" breadcrumb={['ReframeX', 'Compare']} />
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent"><Columns3 size={28} /></div>
          <h2 className="text-xl font-semibold text-ink mb-2">Need at least two applications</h2>
          <p className="text-ink-muted max-w-sm">You currently have {apps.length} application(s). Create at least one more to enable comparison.</p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Application Comparison"
        breadcrumb={['ReframeX', 'Compare']}
        action={
          <div className="flex items-center gap-2">
            <AppSelect
              label="A"
              apps={apps}
              value={appAId}
              onChange={setAppAId}
            />
            <ArrowRight size={14} className="text-ink-soft" />
            <AppSelect
              label="B"
              apps={apps}
              value={appBId}
              onChange={setAppBId}
            />
          </div>
        }
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-tile bg-severity-high/10 text-severity-high text-sm">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {appAId === appBId && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-tile bg-severity-medium/10 text-severity-medium text-sm">
          <Info size={16} /> Select two different applications to compare.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 size={24} className="animate-spin" /></div>
      ) : comparison ? (
        <div className="space-y-4">
          {/* Version warning */}
          {comparison.version_warning && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-tile bg-severity-medium/15 border border-severity-medium/30">
              <AlertTriangle size={18} className="text-severity-medium shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-ink">Version Mismatch Warning</div>
                <p className="text-xs text-ink-muted mt-0.5">{comparison.version_warning.message}</p>
              </div>
            </div>
          )}

          {/* Comparison note */}
          <BentoCard className="p-3" dense>
            <div className="flex items-start gap-2">
              <Info size={14} className="text-ink-soft shrink-0 mt-0.5" />
              <p className="text-xs text-ink-muted">{comparison.comparison_note}</p>
            </div>
          </BentoCard>

          {/* Side-by-side summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AppSummaryCard app={comparison.application_a} label="A" />
            <AppSummaryCard app={comparison.application_b} label="B" />
          </div>

          {/* Delta summary */}
          <BentoCard className="p-5" dense>
            <h3 className="text-sm font-semibold text-ink mb-3">Comparison Deltas (B vs A)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <DeltaTile label="Artifacts" value={comparison.deltas.artifact_count_delta} />
              <DeltaTile label="Components" value={comparison.deltas.component_count_delta} />
              <DeltaTile label="Dependencies" value={comparison.deltas.dependency_count_delta} />
              <DeltaTile label="Findings" value={comparison.deltas.finding_count_delta} />
              <DeltaTile label="Missing Evidence" value={comparison.deltas.missing_evidence_delta} />
              <DeltaTile label="Complexity" value={comparison.deltas.complexity_score_delta} />
              <DeltaTile label="Confidence" value={comparison.deltas.confidence_score_delta} />
              <DeltaTile label="Readiness" value={comparison.deltas.readiness_score_delta} />
            </div>
          </BentoCard>

          {/* Radar chart */}
          <BentoCard className="p-5" dense>
            <h3 className="text-sm font-semibold text-ink mb-3">Domain Complexity Comparison</h3>
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData()}>
                  <PolarGrid stroke="rgba(0,0,0,0.1)" />
                  <PolarAngleAxis dataKey="domain" tick={{ fill: '#6B5B4A', fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#8A7A6A', fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #D9C1A2', borderRadius: 8, fontSize: 12 }}
                  />
                  <Radar name={comparison.application_a.application_name} dataKey="appA" stroke="#0D7490" fill="#0D7490" fillOpacity={0.3} />
                  <Radar name={comparison.application_b.application_name} dataKey="appB" stroke="#7668AE" fill="#7668AE" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: '#0D7490' }} />
                <span className="text-xs text-ink-muted">{comparison.application_a.application_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: '#4D8F86' }} />
                <span className="text-xs text-ink-muted">{comparison.application_b.application_name}</span>
              </div>
            </div>
          </BentoCard>

          {/* Domain delta table */}
          <BentoCard className="p-5" dense>
            <h3 className="text-sm font-semibold text-ink mb-3">Domain Score Deltas</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-ink-soft">
                  <th className="text-left py-1.5 font-medium">Domain</th>
                  <th className="text-center py-1.5 font-medium">Complexity Δ</th>
                  <th className="text-center py-1.5 font-medium">Confidence Δ</th>
                  <th className="text-center py-1.5 font-medium">Readiness Δ</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(comparison.deltas.domain_deltas).map(([key, d]) => (
                  <tr key={key} className="border-t border-solid-border/30">
                    <td className="py-1.5 text-ink">{d.label}</td>
                    <td className="py-1.5 text-center text-ink-muted">{d.complexity_delta !== null ? `${d.complexity_delta > 0 ? '+' : ''}${d.complexity_delta}` : 'N/A'}</td>
                    <td className="py-1.5 text-center text-ink-muted">{d.confidence_delta !== null ? `${d.confidence_delta > 0 ? '+' : ''}${d.confidence_delta}` : 'N/A'}</td>
                    <td className="py-1.5 text-center text-ink-muted">{d.readiness_delta !== null ? `${d.readiness_delta > 0 ? '+' : ''}${d.readiness_delta}` : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </BentoCard>
        </div>
      ) : null}
    </>
  );
}

function AppSelect({ label, apps, value, onChange }: {
  label: string;
  apps: Application[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-accent">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="inner-glass rounded-pill pl-6 pr-7 py-1.5 text-xs font-medium text-ink-muted appearance-none cursor-pointer hover:bg-white/35 transition-colors"
      >
        {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
    </div>
  );
}

function AppSummaryCard({ app, label }: { app: ComparisonAppSummary; label: string }) {
  return (
    <BentoCard className="p-5" dense>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: label === 'A' ? '#0D7490' : '#7668AE' }}>{label}</span>
            <h3 className="text-sm font-semibold text-ink">{app.application_name}</h3>
          </div>
          {app.description && <p className="text-xs text-ink-muted mt-0.5">{app.description}</p>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <ScoreTile label="Complexity" score={app.complexity_score} classification={app.complexity_classification} color="#E88555" />
        <ScoreTile label="Confidence" score={app.confidence_score} classification={app.confidence_classification} color="#4D8F86" />
        <ScoreTile label="Readiness" score={app.readiness_score} classification={app.readiness_classification} color="#5B9E6A" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <StatRow label="Artifacts" value={app.artifact_count} />
        <StatRow label="Components" value={app.component_count} />
        <StatRow label="Dependencies" value={app.dependency_count} />
        <StatRow label="Unresolved Deps" value={app.dependency_unresolved} />
        <StatRow label="Findings" value={app.finding_count} />
        <StatRow label="Missing Evidence" value={app.missing_evidence_count} />
      </div>
      {app.business_domain && <div className="mt-2 text-[11px] text-ink-soft">Domain: {app.business_domain}</div>}
      {app.computed_at && <div className="text-[11px] text-ink-soft">Assessed: {new Date(app.computed_at).toLocaleDateString()}</div>}
    </BentoCard>
  );
}

function ScoreTile({ label, score, classification, color }: {
  label: string;
  score: number | null;
  classification: string;
  color: string;
}) {
  return (
    <div className="text-center p-2 rounded-tile inner-glass">
      <div className="text-[9px] text-ink-soft uppercase tracking-wide">{label}</div>
      <div className="text-lg font-semibold text-ink mt-0.5">{score !== null ? score : 'N/A'}</div>
      <div className="text-[9px] font-medium" style={{ color }}>{classification}</div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="text-ink font-medium">{value}</span>
    </div>
  );
}

function DeltaTile({ label, value }: { label: string; value: number | null }) {
  if (value === null) {
    return (
      <div className="text-center p-2 rounded-tile inner-glass">
        <div className="text-[10px] text-ink-soft">{label}</div>
        <div className="text-sm font-semibold text-ink-soft">N/A</div>
      </div>
    );
  }
  const isPositive = value > 0;
  const isNeutral = value === 0;
  return (
    <div className="text-center p-2 rounded-tile inner-glass">
      <div className="text-[10px] text-ink-soft">{label}</div>
      <div className={`text-sm font-semibold ${isNeutral ? 'text-ink-muted' : isPositive ? 'text-severity-medium' : 'text-success'}`}>
        {isPositive ? '+' : ''}{value}
      </div>
    </div>
  );
}
