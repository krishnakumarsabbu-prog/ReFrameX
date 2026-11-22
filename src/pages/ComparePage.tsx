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
        <PageHeader title="Application Comparison" breadcrumb={['ReFrameX', 'Compare']} />
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#F1F2F3] border border-[#E3E5E7] flex items-center justify-center mb-5 text-[#202124]"><Columns3 size={28} /></div>
          <h2 className="text-xl font-medium text-[#202124] mb-2">No applications to compare</h2>
          <p className="text-[#777D83] max-w-sm text-xs">Create at least two applications, upload artifacts, and run assessments to compare them.</p>
        </BentoCard>
      </>
    );
  }

  if (apps.length < 2) {
    return (
      <>
        <PageHeader title="Application Comparison" breadcrumb={['ReFrameX', 'Compare']} />
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#F1F2F3] border border-[#E3E5E7] flex items-center justify-center mb-5 text-[#202124]"><Columns3 size={28} /></div>
          <h2 className="text-xl font-medium text-[#202124] mb-2">Need at least two applications</h2>
          <p className="text-[#777D83] max-w-sm text-xs">You currently have {apps.length} application(s). Create at least one more to enable comparison.</p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Application Comparison"
        breadcrumb={['ReFrameX', 'Compare']}
        action={
          <div className="flex items-center gap-2">
            <AppSelect
              label="A"
              apps={apps}
              value={appAId}
              onChange={setAppAId}
            />
            <ArrowRight size={14} className="text-[#A0A4A8]" />
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
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] text-xs font-medium">
          <AlertCircle size={15} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {appAId === appBId && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] text-xs font-medium">
          <Info size={16} /> Select two different applications to compare.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#777D83]"><Loader2 size={24} className="animate-spin text-[#202124]" /></div>
      ) : comparison ? (
        <div className="space-y-4">
          {/* Version warning */}
          {comparison.version_warning && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A]">
              <AlertTriangle size={18} className="text-[#D97706] shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-[#202124]">Version Mismatch Warning</div>
                <p className="text-xs text-[#777D83] mt-0.5">{comparison.version_warning.message}</p>
              </div>
            </div>
          )}

          {/* Comparison note */}
          <BentoCard className="p-4" dense>
            <div className="flex items-start gap-2">
              <Info size={14} className="text-[#777D83] shrink-0 mt-0.5" />
              <p className="text-xs text-[#777D83]">{comparison.comparison_note}</p>
            </div>
          </BentoCard>

          {/* Side-by-side summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AppSummaryCard app={comparison.application_a} label="A" />
            <AppSummaryCard app={comparison.application_b} label="B" />
          </div>

          {/* Delta summary */}
          <BentoCard className="p-5" dense>
            <h3 className="text-base font-medium text-[#202124] mb-3">Comparison Deltas (B vs A)</h3>
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
          <BentoCard className="p-6" dense>
            <h3 className="text-base font-medium text-[#202124] mb-3">Domain Complexity Comparison</h3>
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData()}>
                  <PolarGrid stroke="#E3E5E7" />
                  <PolarAngleAxis dataKey="domain" tick={{ fill: '#777D83', fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#A0A4A8', fontSize: 9 }} />
                  <Tooltip contentStyle={softGlassTooltipStyle} />
                  <Radar name={comparison.application_a.application_name} dataKey="appA" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.18} />
                  <Radar name={comparison.application_b.application_name} dataKey="appB" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.18} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs text-blue-900 font-semibold">{comparison.application_a.application_name} (A)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-xs text-purple-900 font-semibold">{comparison.application_b.application_name} (B)</span>
              </div>
            </div>
          </BentoCard>

          {/* Domain delta table */}
          <BentoCard className="p-0 overflow-hidden" dense>
            <div className="px-5 py-3.5 border-b border-[#E3E5E7] bg-[#FAFAFA]">
              <h3 className="text-sm font-medium text-[#202124]">Domain Score Deltas</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E3E5E7] bg-[#F1F2F3] text-left text-[11px] font-medium text-[#777D83] uppercase tracking-wide">
                  <th className="py-2.5 px-4 font-medium">Domain</th>
                  <th className="text-center py-2.5 px-4 font-medium">Complexity Δ</th>
                  <th className="text-center py-2.5 px-4 font-medium">Confidence Δ</th>
                  <th className="text-center py-2.5 px-4 font-medium">Readiness Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E5E7]">
                {Object.entries(comparison.deltas.domain_deltas).map(([key, d]) => (
                  <tr key={key} className="hover:bg-[#F1F2F3]/50 transition-colors">
                    <td className="py-2.5 px-4 text-[#202124] font-medium">{d.label}</td>
                    <td className="py-2.5 px-4 text-center text-[#777D83] tabular-nums">{d.complexity_delta !== null ? `${d.complexity_delta > 0 ? '+' : ''}${d.complexity_delta}` : 'N/A'}</td>
                    <td className="py-2.5 px-4 text-center text-[#777D83] tabular-nums">{d.confidence_delta !== null ? `${d.confidence_delta > 0 ? '+' : ''}${d.confidence_delta}` : 'N/A'}</td>
                    <td className="py-2.5 px-4 text-center text-[#777D83] tabular-nums">{d.readiness_delta !== null ? `${d.readiness_delta > 0 ? '+' : ''}${d.readiness_delta}` : 'N/A'}</td>
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
  const isA = label === 'A';
  return (
    <div className="relative">
      <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-md font-bold text-[10px] text-white ${isA ? 'bg-blue-600' : 'bg-purple-600'}`}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-1.5 text-xs font-semibold text-slate-800 appearance-none cursor-pointer hover:border-indigo-400 shadow-2xs transition-colors outline-none"
      >
        {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

function AppSummaryCard({ app, label }: { app: ComparisonAppSummary; label: string }) {
  const isA = label === 'A';
  return (
    <BentoCard className={`p-5 ${isA ? 'border-t-4 border-blue-500' : 'border-t-4 border-purple-500'} hover:shadow-sm transition-all`} dense>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white ${isA ? 'bg-blue-600' : 'bg-purple-600'}`}>{label}</span>
            <h3 className="text-base font-bold text-slate-900">{app.application_name}</h3>
          </div>
          {app.description && <p className="text-xs text-slate-500 mt-1">{app.description}</p>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <ScoreTile label="Complexity" score={app.complexity_score} classification={app.complexity_classification} color="#DC2626" />
        <ScoreTile label="Confidence" score={app.confidence_score} classification={app.confidence_classification} color="#166534" />
        <ScoreTile label="Readiness" score={app.readiness_score} classification={app.readiness_classification} color="#166534" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <StatRow label="Artifacts" value={app.artifact_count} />
        <StatRow label="Components" value={app.component_count} />
        <StatRow label="Dependencies" value={app.dependency_count} />
        <StatRow label="Unresolved Deps" value={app.dependency_unresolved} />
        <StatRow label="Findings" value={app.finding_count} />
        <StatRow label="Missing Evidence" value={app.missing_evidence_count} />
      </div>
      {app.business_domain && <div className="mt-2 text-xs text-[#777D83]">Domain: {app.business_domain}</div>}
      {app.computed_at && <div className="text-xs text-[#A0A4A8]">Assessed: {new Date(app.computed_at).toLocaleDateString()}</div>}
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
    <div className="text-center p-2.5 rounded-xl border border-[#E3E5E7] bg-[#FAFAFA]">
      <div className="text-[10px] text-[#777D83] uppercase tracking-wide font-medium">{label}</div>
      <div className="text-lg font-normal text-[#202124] mt-0.5 tabular-nums">{score !== null ? score : 'N/A'}</div>
      <div className="text-[10px] font-medium" style={{ color }}>{classification}</div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[#777D83]">{label}</span>
      <span className="text-[#202124] font-medium tabular-nums">{value}</span>
    </div>
  );
}

function DeltaTile({ label, value }: { label: string; value: number | null }) {
  if (value === null) {
    return (
      <div className="text-center p-3 rounded-xl border border-[#E3E5E7] bg-[#FAFAFA]">
        <div className="text-xs text-[#777D83]">{label}</div>
        <div className="text-sm font-medium text-[#A0A4A8] mt-1">N/A</div>
      </div>
    );
  }
  const isPositive = value > 0;
  const isNeutral = value === 0;
  return (
    <div className="text-center p-3 rounded-xl border border-[#E3E5E7] bg-[#FAFAFA]">
      <div className="text-xs text-[#777D83]">{label}</div>
      <div className={`text-base font-medium mt-0.5 tabular-nums ${isNeutral ? 'text-[#777D83]' : isPositive ? 'text-[#D97706]' : 'text-[#166534]'}`}>
        {isPositive ? '+' : ''}{value}
      </div>
    </div>
  );
}
