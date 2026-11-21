import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertCircle, X, History, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, Minus, Info, ArrowRight, GitCompare,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import { api, type Application, type AssessmentHistoryItem } from '@/api/client';

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
      setActiveApp(complex ?? data.find((a) => a.is_active) ?? data[0] ?? null);
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
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent"><History size={28} /></div>
          <h2 className="text-xl font-semibold text-ink mb-2">No applications available</h2>
          <p className="text-ink-muted max-w-sm">Create an application and run multiple assessments to see the evidence-improvement workflow.</p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Evidence Improvement Workflow"
        breadcrumb={['ReframeX', 'Evidence Improvement']}
        action={
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
      ) : history.length === 0 ? (
        <BentoCard className="p-12 flex flex-col items-center text-center" dense>
          <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mb-4 text-accent"><History size={24} /></div>
          <h3 className="text-lg font-semibold text-ink mb-2">No assessment history</h3>
          <p className="text-ink-muted max-w-sm">Run an assessment for this application to start building history.</p>
        </BentoCard>
      ) : (
        <div className="space-y-4">
          {/* Info banner */}
          <BentoCard className="p-3" dense>
            <div className="flex items-start gap-2">
              <Info size={14} className="text-ink-soft shrink-0 mt-0.5" />
              <p className="text-xs text-ink-muted">
                This view demonstrates the evidence-improvement workflow: withhold an artifact, assess, then add it and reassess.
                Each assessment version is stored and comparable. Complexity changes only where new evidence truly reveals new complexity.
              </p>
            </div>
          </BentoCard>

          {/* History timeline */}
          <BentoCard className="p-5" dense>
            <h3 className="text-sm font-semibold text-ink mb-3">Assessment History ({history.length} versions)</h3>
            <div className="space-y-2">
              {history.map((h, idx) => (
                <div
                  key={h.id}
                  className={`flex items-center gap-3 p-3 rounded-tile transition-colors cursor-pointer ${
                    h.is_current ? 'bg-accent/8 border border-accent/20' : 'inner-glass hover:bg-white/35'
                  }`}
                  onClick={() => {
                    if (idx < history.length - 1) {
                      setSelectedVersions([history[idx + 1].version, h.version]);
                    }
                  }}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    h.is_current ? 'bg-accent text-white' : 'bg-white/40 text-ink-muted'
                  }`}>v{h.version}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">
                        {h.is_current ? 'Current Assessment' : `Assessment v${h.version}`}
                      </span>
                      {h.human_reviewed && <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-success/15 text-success">Reviewed</span>}
                    </div>
                    <div className="text-xs text-ink-soft mt-0.5">
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
            <BentoCard className="p-5" dense>
              <h3 className="text-sm font-semibold text-ink mb-3">Custom Version Comparison</h3>
              <div className="flex items-center gap-3">
                <VersionSelector
                  history={history}
                  value={selectedVersions?.[0] ?? history[history.length - 1].version}
                  onChange={(v) => setSelectedVersions([v, selectedVersions?.[1] ?? history[0].version])}
                  label="Before"
                />
                <ArrowRight size={14} className="text-ink-soft" />
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
    <BentoCard className="overflow-hidden" dense>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/40 transition-colors"
      >
        {expanded ? <ChevronDown size={14} className="text-ink-soft" /> : <ChevronRight size={14} className="text-ink-soft" />}
        <GitCompare size={16} className="text-accent" />
        <h3 className="text-sm font-semibold text-ink">Before/After Comparison (v{oldVersion.version} → v{newVersion.version})</h3>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-solid-border/40 space-y-4">
          {/* Score deltas */}
          <div className="grid grid-cols-3 gap-3">
            <DeltaCard
              label="Migration Complexity"
              oldValue={oldVersion.complexity_score}
              newValue={newVersion.complexity_score}
              delta={complexityDelta}
              oldClass={oldVersion.complexity_classification}
              newClass={newVersion.complexity_classification}
            />
            <DeltaCard
              label="Assessment Confidence"
              oldValue={oldVersion.confidence_score}
              newValue={newVersion.confidence_score}
              delta={confidenceDelta}
              oldClass={oldVersion.confidence_classification}
              newClass={newVersion.confidence_classification}
            />
            <DeltaCard
              label="Migration Readiness"
              oldValue={oldVersion.readiness_score}
              newValue={newVersion.readiness_score}
              delta={readinessDelta}
              oldClass={oldVersion.readiness_classification}
              newClass={newVersion.readiness_classification}
            />
          </div>

          {/* Evidence gaps resolved */}
          {resolvedGaps.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-success uppercase tracking-wide mb-1">Evidence Gaps Resolved ({resolvedGaps.length})</div>
              <ul className="space-y-0.5">
                {resolvedGaps.map((g, i) => <li key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-success shrink-0">✓</span>{g}</li>)}
              </ul>
            </div>
          )}

          {/* New evidence gaps */}
          {newGaps.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-severity-medium uppercase tracking-wide mb-1">New Evidence Gaps ({newGaps.length})</div>
              <ul className="space-y-0.5">
                {newGaps.map((g, i) => <li key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-severity-medium shrink-0">!</span>{g}</li>)}
              </ul>
            </div>
          )}

          {/* Newly fired rules */}
          {newRules.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-accent uppercase tracking-wide mb-1">Newly Detected Rules ({newRules.length})</div>
              <ul className="space-y-0.5">
                {newRules.map((r, i) => <li key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-accent shrink-0">+</span>{r.rule_id}: {r.description as string}</li>)}
              </ul>
            </div>
          )}

          {/* Rules no longer firing */}
          {removedRules.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">Rules No Longer Firing ({removedRules.length})</div>
              <ul className="space-y-0.5">
                {removedRules.map((r, i) => <li key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-ink-soft shrink-0">-</span>{r.rule_id}: {r.description as string}</li>)}
              </ul>
            </div>
          )}

          {/* Changed next steps */}
          {newSteps.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">New/Changed Next Steps ({newSteps.length})</div>
              <ul className="space-y-0.5">
                {newSteps.map((s, i) => <li key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-accent shrink-0">→</span>{s}</li>)}
              </ul>
            </div>
          )}

          {resolvedGaps.length === 0 && newGaps.length === 0 && newRules.length === 0 && removedRules.length === 0 && (
            <p className="text-xs text-ink-soft">No changes detected between versions.</p>
          )}
        </div>
      )}
    </BentoCard>
  );
}

function DeltaCard({ label, oldValue, newValue, delta, oldClass, newClass }: {
  label: string;
  oldValue: number;
  newValue: number;
  delta: number;
  oldClass: string;
  newClass: string;
}) {
  const isNeutral = delta === 0;
  const isPositive = delta > 0;
  return (
    <div className="p-3 rounded-tile inner-glass">
      <div className="text-[10px] text-ink-soft uppercase tracking-wide">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-xs text-ink-soft">{oldValue}</span>
        <ArrowRight size={10} className="text-ink-soft" />
        <span className="text-sm font-semibold text-ink">{newValue}</span>
        <span className={`text-xs font-medium ${isNeutral ? 'text-ink-muted' : isPositive ? 'text-severity-medium' : 'text-success'}`}>
          {isNeutral ? '' : isPositive ? '+' : ''}{delta.toFixed(1)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="text-[10px] text-ink-soft">{oldClass}</span>
        {oldClass !== newClass && <>
          <ArrowRight size={8} className="text-ink-soft" />
          <span className="text-[10px] font-medium text-accent">{newClass}</span>
        </>}
      </div>
    </div>
  );
}

function ScoreMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-[9px] text-ink-soft uppercase">{label}</div>
      <div className="text-sm font-semibold text-ink">{value.toFixed(0)}</div>
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
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-ink-soft">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="inner-glass rounded-pill pl-12 pr-7 py-1.5 text-xs font-medium text-ink-muted appearance-none cursor-pointer hover:bg-white/35 transition-colors"
      >
        {history.map((h) => <option key={h.id} value={h.version}>v{h.version} — {new Date(h.computed_at).toLocaleString()}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
    </div>
  );
}
