import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertCircle, X, History, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, Minus, Info, ArrowRight, GitCompare,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import { api, type Application, type AssessmentHistoryItem } from '@/api/client';
import { resolveActiveApp, setStoredActiveAppId } from '@/utils/activeApp';

export default function EvidenceImprovementPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [history, setHistory] = useState<AssessmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<[number, number] | null>(null);

  const loadApps = useCallback(async () => {
    try {
      const data = await api.listApplications();
      setApps(data);
      // Prefer the complex synthetic app for the demo
      const complex = data.find((a) => a.name.includes('ACCTLEDG'));
      setActiveApp(complex ?? resolveActiveApp(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    }
  }, []);

  const loadHistory = useCallback(async (appId: string) => {
    setLoading(true);
    setError(null);
    try {
      const h = await api.getAssessmentHistory(appId);
      setHistory(h);
      if (h.length >= 2) {
        setSelectedVersions([h[h.length - 1].version, h[0].version]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assessment history');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);
  useEffect(() => { if (activeApp) loadHistory(activeApp.id); }, [activeApp, loadHistory]);

  async function handleSelectApp(id: string) {
    setStoredActiveAppId(id);
    try {
      await api.updateApplication(id, { is_active: true });
      await loadApps();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to select application');
    }
  }

  const oldVersion = selectedVersions ? history.find((h) => h.version === selectedVersions[0]) : null;
  const newVersion = selectedVersions ? history.find((h) => h.version === selectedVersions[1]) : null;

  if (apps.length === 0 && !loading) {
    return (
      <>
        <PageHeader title="Evidence Improvement Workflow" breadcrumb={['ReframeX', 'Evidence Improvement']} />
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto rounded-2xl border border-[#E3E5E7] bg-white shadow-[0_4px_16px_rgba(25,30,35,0.04)]">
          <div className="w-14 h-14 rounded-2xl bg-[#F1F2F3] border border-[#E3E5E7] flex items-center justify-center mb-4 text-[#202124]"><History size={24} /></div>
          <h2 className="text-xl font-medium text-[#202124] mb-2">No applications available</h2>
          <p className="text-sm text-[#777D83] max-w-sm">Create an application and run multiple assessments to see the evidence-improvement workflow.</p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Evidence Improvement Workflow"
        breadcrumb={['ReFrameX', 'Evidence Improvement']}
        action={
          <div className="relative">
            <select
              value={activeApp?.id ?? ''}
              onChange={(e) => handleSelectApp(e.target.value)}
              className="h-9 appearance-none rounded-xl border border-[#E3E5E7] bg-white pl-3.5 pr-8 font-mono text-xs font-medium text-[#202124] outline-none transition-all focus:border-[#202124] shadow-sm cursor-pointer"
            >
              {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#777D83]" />
          </div>
        }
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl border border-[#FCA5A5]/40 bg-[#FEF2F2] text-[#991B1B] text-xs">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#777D83]"><Loader2 size={24} className="animate-spin text-[#202124]" /></div>
      ) : history.length === 0 ? (
        <BentoCard className="p-12 flex flex-col items-center text-center rounded-2xl border border-[#E3E5E7] bg-white shadow-[0_4px_16px_rgba(25,30,35,0.04)]" dense>
          <div className="w-14 h-14 rounded-2xl bg-[#F1F2F3] border border-[#E3E5E7] flex items-center justify-center mb-4 text-[#202124]"><History size={24} /></div>
          <h3 className="text-lg font-medium text-[#202124] mb-2">No assessment history</h3>
          <p className="text-sm text-[#777D83] max-w-sm">Run an assessment for this application to start building history.</p>
        </BentoCard>
      ) : (
        <div className="space-y-4">
          {/* Info banner */}
          <BentoCard className="p-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-blue-50/40 via-white to-indigo-50/40 shadow-2xs" dense>
            <div className="flex items-start gap-2.5">
              <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 leading-relaxed">
                This view demonstrates the evidence-improvement workflow: withhold an artifact, assess, then add it and reassess.
                Each assessment version is stored and comparable. Complexity changes only where new evidence truly reveals new complexity.
              </p>
            </div>
          </BentoCard>

          {/* History timeline */}
          <BentoCard className="p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs" dense>
            <h3 className="text-base font-bold text-slate-900 mb-3">Assessment History ({history.length} versions)</h3>
            <div className="space-y-2">
              {history.map((h, idx) => (
                <div
                  key={h.id}
                  className={`flex items-center gap-3.5 p-3.5 rounded-xl transition-all cursor-pointer border ${h.is_current
                      ? 'bg-indigo-50/40 border-indigo-300 border-l-4 border-l-indigo-600 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  onClick={() => {
                    if (idx < history.length - 1) {
                      setSelectedVersions([history[idx + 1].version, h.version]);
                    }
                  }}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${h.is_current ? 'bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-2xs' : 'bg-slate-100 border border-slate-200 text-slate-600'
                    }`}>v{h.version}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#202124]">
                        {h.is_current ? 'Current Assessment' : `Assessment v${h.version}`}
                      </span>
                      {h.human_reviewed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]/60 font-medium">Reviewed</span>}
                    </div>
                    <div className="text-xs text-[#A0A4A8] mt-0.5">
                      {new Date(h.computed_at).toLocaleString()} | {h.duration_ms}ms
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <ScoreMini label="Cx" value={h.complexity_score} />
                    <ScoreMini label="Cf" value={h.confidence_score} />
                    <ScoreMini label="Rd" value={h.readiness_score} />
                  </div>
                </div>
              ))}
            </div>
          </BentoCard>

          {/* Before/after comparison */}
          {oldVersion && newVersion && oldVersion.version !== newVersion.version && (
            <BeforeAfterComparison oldVersion={oldVersion} newVersion={newVersion} />
          )}

          {/* Version selector for custom comparison */}
          {history.length >= 2 && (
            <BentoCard className="p-5 sm:p-6 rounded-2xl border border-[#E3E5E7] bg-white shadow-[0_4px_16px_rgba(25,30,35,0.04)]" dense>
              <h3 className="text-base font-medium text-[#202124] mb-3">Custom Version Comparison</h3>
              <div className="flex items-center gap-3">
                <VersionSelector
                  history={history}
                  value={selectedVersions?.[0] ?? history[history.length - 1].version}
                  onChange={(v) => setSelectedVersions([v, selectedVersions?.[1] ?? history[0].version])}
                  label="Before"
                />
                <ArrowRight size={14} className="text-[#A0A4A8]" />
                <VersionSelector
                  history={history}
                  value={selectedVersions?.[1] ?? history[0].version}
                  onChange={(v) => setSelectedVersions([selectedVersions?.[0] ?? history[history.length - 1].version, v])}
                  label="After"
                />
              </div>
            </BentoCard>
          )}
        </div>
      )}
    </>
  );
}

function BeforeAfterComparison({ oldVersion, newVersion }: {
  oldVersion: AssessmentHistoryItem;
  newVersion: AssessmentHistoryItem;
}) {
  const [expanded, setExpanded] = useState(true);

  const complexityDelta = newVersion.complexity_score - oldVersion.complexity_score;
  const confidenceDelta = newVersion.confidence_score - oldVersion.confidence_score;
  const readinessDelta = newVersion.readiness_score - oldVersion.readiness_score;

  const oldMissingInfo = (oldVersion.result as Record<string, any>).missing_information as string[] || [];
  const newMissingInfo = (newVersion.result as Record<string, any>).missing_information as string[] || [];
  const oldFiredRules = ((oldVersion.result as Record<string, any>).fired_rules as Array<Record<string, any>>) || [];
  const newFiredRules = ((newVersion.result as Record<string, any>).fired_rules as Array<Record<string, any>>) || [];
  const oldNextSteps = (oldVersion.result as Record<string, any>).recommended_next_steps as string[] || [];
  const newNextSteps = (newVersion.result as Record<string, any>).recommended_next_steps as string[] || [];

  const resolvedGaps = oldMissingInfo.filter((g) => !newMissingInfo.includes(g));
  const newGaps = newMissingInfo.filter((g) => !oldMissingInfo.includes(g));
  const newRules = newFiredRules.filter((r) => !oldFiredRules.some((o) => o.rule_id === r.rule_id));
  const removedRules = oldFiredRules.filter((r) => !newFiredRules.some((n) => n.rule_id === r.rule_id));
  const newSteps = newNextSteps.filter((s) => !oldNextSteps.includes(s));

  return (
    <BentoCard className="overflow-hidden rounded-2xl border border-[#E3E5E7] bg-white shadow-[0_4px_16px_rgba(25,30,35,0.04)]" dense>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-5 py-4 text-left hover:bg-[#FAFAFA] transition-colors"
      >
        {expanded ? <ChevronDown size={14} className="text-[#777D83]" /> : <ChevronRight size={14} className="text-[#777D83]" />}
        <GitCompare size={16} className="text-[#202124]" />
        <h3 className="text-base font-medium text-[#202124]">Before/After Comparison (v{oldVersion.version} → v{newVersion.version})</h3>
      </button>
      {expanded && (
        <div className="px-5 pb-5 pt-3 border-t border-[#E3E5E7] space-y-4">
          {/* Score deltas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <DeltaCard
              label="Migration Complexity"
              oldValue={oldVersion.complexity_score}
              newValue={newVersion.complexity_score}
              delta={complexityDelta}
              oldClass={oldVersion.complexity_classification}
              newClass={newVersion.complexity_classification}
              topBorder="border-t-4 border-amber-500"
            />
            <DeltaCard
              label="Assessment Confidence"
              oldValue={oldVersion.confidence_score}
              newValue={newVersion.confidence_score}
              delta={confidenceDelta}
              oldClass={oldVersion.confidence_classification}
              newClass={newVersion.confidence_classification}
              topBorder="border-t-4 border-blue-500"
            />
            <DeltaCard
              label="Migration Readiness"
              oldValue={oldVersion.readiness_score}
              newValue={newVersion.readiness_score}
              delta={readinessDelta}
              oldClass={oldVersion.readiness_classification}
              newClass={newVersion.readiness_classification}
              topBorder="border-t-4 border-emerald-500"
            />
          </div>

          {/* Evidence gaps resolved */}
          {resolvedGaps.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-[#065F46] uppercase tracking-wider mb-1.5">Evidence Gaps Resolved ({resolvedGaps.length})</div>
              <ul className="space-y-1">
                {resolvedGaps.map((g, i) => (
                  <li key={i} className="text-xs text-[#777D83] flex gap-2">
                    <span className="text-[#065F46] font-semibold shrink-0">✓</span>{g}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* New evidence gaps */}
          {newGaps.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-[#B45309] uppercase tracking-wider mb-1.5">New Evidence Gaps ({newGaps.length})</div>
              <ul className="space-y-1">
                {newGaps.map((g, i) => (
                  <li key={i} className="text-xs text-[#777D83] flex gap-2">
                    <span className="text-[#B45309] font-semibold shrink-0">!</span>{g}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Newly fired rules */}
          {newRules.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-[#202124] uppercase tracking-wider mb-1.5">Newly Detected Rules ({newRules.length})</div>
              <ul className="space-y-1">
                {newRules.map((r, i) => (
                  <li key={i} className="text-xs text-[#777D83] flex gap-2">
                    <span className="text-[#202124] font-semibold shrink-0">+</span>{r.rule_id}: {r.description as string}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Rules no longer firing */}
          {removedRules.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-[#A0A4A8] uppercase tracking-wider mb-1.5">Rules No Longer Firing ({removedRules.length})</div>
              <ul className="space-y-1">
                {removedRules.map((r, i) => (
                  <li key={i} className="text-xs text-[#A0A4A8] flex gap-2">
                    <span className="text-[#A0A4A8] font-semibold shrink-0">-</span>{r.rule_id}: {r.description as string}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Changed next steps */}
          {newSteps.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-[#777D83] uppercase tracking-wider mb-1.5">New/Changed Next Steps ({newSteps.length})</div>
              <ul className="space-y-1">
                {newSteps.map((s, i) => (
                  <li key={i} className="text-xs text-[#777D83] flex gap-2">
                    <span className="text-[#202124] font-semibold shrink-0">→</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resolvedGaps.length === 0 && newGaps.length === 0 && newRules.length === 0 && removedRules.length === 0 && (
            <p className="text-xs text-[#A0A4A8]">No changes detected between versions.</p>
          )}
        </div>
      )}
    </BentoCard>
  );
}

function DeltaCard({ label, oldValue, newValue, delta, oldClass, newClass, topBorder }: {
  label: string;
  oldValue: number;
  newValue: number;
  delta: number;
  oldClass: string;
  newClass: string;
  topBorder?: string;
}) {
  const isNeutral = delta === 0;
  const isPositive = delta > 0;
  return (
    <div className={`p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs ${topBorder ?? ''}`}>
      <div className="text-[11px] text-[#A0A4A8] uppercase tracking-wider font-medium">{label}</div>
      <div className="flex items-baseline gap-2 mt-1.5">
        <span className="text-xs text-[#A0A4A8] tabular-nums">{oldValue}</span>
        <ArrowRight size={10} className="text-[#A0A4A8]" />
        <span className="text-base font-medium text-[#202124] tabular-nums">{newValue}</span>
        <span className={`text-xs font-medium tabular-nums ${isNeutral ? 'text-[#A0A4A8]' : isPositive ? 'text-[#B45309]' : 'text-[#065F46]'}`}>
          {isNeutral ? '' : isPositive ? '+' : ''}{delta.toFixed(1)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-[11px] text-[#777D83]">{oldClass}</span>
        {oldClass !== newClass && (
          <>
            <ArrowRight size={8} className="text-[#A0A4A8]" />
            <span className="text-[11px] font-medium text-[#202124]">{newClass}</span>
          </>
        )}
      </div>
    </div>
  );
}

function ScoreMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-[#A0A4A8] uppercase font-medium tracking-wider">{label}</div>
      <div className="text-base font-medium text-[#202124] tabular-nums">{value.toFixed(0)}</div>
    </div>
  );
}

function VersionSelector({ history, value, onChange, label }: {
  history: AssessmentHistoryItem[];
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[#777D83]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 rounded-xl border border-[#E3E5E7] bg-white pl-14 pr-8 text-xs font-medium text-[#202124] appearance-none cursor-pointer hover:border-[#202124]/40 focus:border-[#202124] transition-colors outline-none shadow-sm"
      >
        {history.map((h) => <option key={h.id} value={h.version}>v{h.version} — {new Date(h.computed_at).toLocaleString()}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#777D83] pointer-events-none" />
    </div>
  );
}
