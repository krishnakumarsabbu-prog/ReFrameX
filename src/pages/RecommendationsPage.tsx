import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, AlertCircle, X, ChevronDown, ChevronRight,
  Lightbulb, CheckCircle2, AlertTriangle, TrendingUp,
  ArrowRight, Map, Route, Info,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import {
  api, type Application, type RecommendationSummary, type Roadmap,
  type Recommendation,
} from '@/api/client';

const CATEGORY_META: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  'Good Refactoring Candidate': { color: '#5B9E6A', icon: CheckCircle2, label: 'Good Refactoring Candidate' },
  'Requires Further Analysis': { color: '#E8A838', icon: AlertTriangle, label: 'Requires Further Analysis' },
  'Retain on Mainframe for Now': { color: '#E88555', icon: TrendingUp, label: 'Retain on Mainframe for Now' },
};

const PRIORITY_COLORS: Record<string, string> = {
  High: '#E88555', Medium: '#E8A838', Low: '#4D8F86',
};

const ROADMAP_GROUP_ORDER = [
  'Immediate investigation',
  'Dependency resolution',
  'Data and integration analysis',
  'Security review',
  'Operational validation',
  'Refactoring feasibility assessment',
];

export default function RecommendationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationSummary | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'recommendations' | 'roadmap'>('recommendations');
  const [expandedRec, setExpandedRec] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    try {
      const data = await api.listApplications();
      setApps(data);
      setActiveApp(data.find((a) => a.is_active) ?? data[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    }
  }, []);

  const loadData = useCallback(async (appId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [recs, road] = await Promise.all([
        api.getRecommendations(appId),
        api.getRoadmap(appId),
      ]);
      setRecommendations(recs);
      setRoadmap(road);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recommendations');
      setRecommendations(null);
      setRoadmap(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);
  useEffect(() => { if (activeApp) loadData(activeApp.id); }, [activeApp, loadData]);

  async function handleSelectApp(id: string) {
    try {
      await api.updateApplication(id, { is_active: true });
      await loadApps();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to select application');
    }
  }

  const grouped = useMemo(() => {
    if (!recommendations) return {};
    const g: Record<string, Recommendation[]> = {};
    recommendations.recommendations.forEach((r) => {
      g[r.category] = g[r.category] ?? [];
      g[r.category].push(r);
    });
    return g;
  }, [recommendations]);

  if (apps.length === 0 && !loading) {
    return (
      <>
        <PageHeader title="Refactoring Recommendations" breadcrumb={['ReframeX', 'Recommendations']} />
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent"><Lightbulb size={28} /></div>
          <h2 className="text-xl font-semibold text-ink mb-2">No applications to recommend</h2>
          <p className="text-ink-muted max-w-sm">Create an application, upload artifacts, and run an assessment to see refactoring recommendations here.</p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Refactoring Recommendations"
        breadcrumb={['ReframeX', 'Recommendations']}
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
            <div className="flex rounded-pill inner-glass overflow-hidden">
              <button
                onClick={() => setView('recommendations')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'recommendations' ? 'bg-accent text-white' : 'text-ink-muted hover:bg-white/30'}`}
              >Recommendations</button>
              <button
                onClick={() => setView('roadmap')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'roadmap' ? 'bg-accent text-white' : 'text-ink-muted hover:bg-white/30'}`}
              >Roadmap</button>
            </div>
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
      ) : view === 'recommendations' ? (
        <RecommendationsView
          grouped={grouped}
          byCategory={recommendations?.by_category ?? {}}
          total={recommendations?.total ?? 0}
          expandedRec={expandedRec}
          setExpandedRec={setExpandedRec}
        />
      ) : (
        <RoadmapView roadmap={roadmap} />
      )}
    </>
  );
}

function RecommendationsView({ grouped, byCategory, total, expandedRec, setExpandedRec }: {
  grouped: Record<string, Recommendation[]>;
  byCategory: Record<string, number>;
  total: number;
  expandedRec: string | null;
  setExpandedRec: (v: string | null) => void;
}) {
  if (total === 0) {
    return (
      <BentoCard className="p-12 flex flex-col items-center text-center" dense>
        <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mb-4 text-accent"><Lightbulb size={24} /></div>
        <h3 className="text-lg font-semibold text-ink mb-2">No recommendations yet</h3>
        <p className="text-ink-muted max-w-sm">Run an assessment to generate component-level refactoring recommendations.</p>
      </BentoCard>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.entries(CATEGORY_META).map(([cat, meta]) => {
          const Icon = meta.icon;
          const count = byCategory[cat] ?? 0;
          return (
            <BentoCard key={cat} className="p-5" dense>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${meta.color}22` }}>
                  <Icon size={20} style={{ color: meta.color }} />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-ink">{count}</div>
                  <div className="text-[10px] text-ink-soft uppercase tracking-wide">components</div>
                </div>
              </div>
              <div className="text-xs font-medium" style={{ color: meta.color }}>{meta.label}</div>
            </BentoCard>
          );
        })}
      </div>

      {/* Info note */}
      <BentoCard className="p-3" dense>
        <div className="flex items-start gap-2">
          <Info size={14} className="text-ink-soft shrink-0 mt-0.5" />
          <p className="text-xs text-ink-muted">
            Candidate considerations are hypotheses for further evaluation, not final migration patterns.
            Do not assume OpenShift or any specific target platform. A low-complexity component with missing evidence is not a good candidate.
          </p>
        </div>
      </BentoCard>

      {/* Category sections */}
      {Object.entries(CATEGORY_META).map(([cat, meta]) => {
        const recs = grouped[cat];
        if (!recs || recs.length === 0) return null;
        const Icon = meta.icon;
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <Icon size={16} style={{ color: meta.color }} />
              <h3 className="text-sm font-semibold text-ink">{meta.label}</h3>
              <span className="text-xs text-ink-soft">({recs.length})</span>
            </div>
            <div className="space-y-2">
              {recs.map((rec) => (
                <RecommendationRow
                  key={`${rec.component_id}-${rec.category}`}
                  rec={rec}
                  color={meta.color}
                  expanded={expandedRec === `${rec.component_id}-${rec.category}`}
                  onToggle={() => setExpandedRec(expandedRec === `${rec.component_id}-${rec.category}` ? null : `${rec.component_id}-${rec.category}`)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecommendationRow({ rec, color, expanded, onToggle }: {
  rec: Recommendation;
  color: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <BentoCard className="overflow-hidden" dense>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/40 transition-colors">
        <ChevronRight size={14} className={`text-ink-soft shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink truncate">{rec.component}</span>
            <span className="text-[10px] text-ink-soft">({rec.component_type})</span>
          </div>
          <p className="text-xs text-ink-muted truncate mt-0.5">{rec.reason}</p>
        </div>
        <span className="text-xs font-semibold shrink-0" style={{ color }}>{rec.complexity_classification}</span>
        <span className="text-[10px] text-ink-soft shrink-0">Complexity {rec.complexity_score}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-solid-border/40 space-y-3">
          <p className="text-xs text-ink-muted pt-2">{rec.reason}</p>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <Metric label="Complexity" value={`${rec.complexity_score}`} sub={rec.complexity_classification} color="#E88555" />
            <Metric label="Confidence" value={`${rec.confidence_score}`} sub={rec.confidence_classification} color="#4D8F86" />
            <Metric label="Readiness" value={`${rec.readiness_score}`} sub={rec.readiness_classification} color="#5B9E6A" />
          </div>

          {rec.supporting_evidence.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">Supporting Evidence</div>
              <ul className="space-y-1">{rec.supporting_evidence.map((e, i) => <li key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-accent shrink-0">•</span><span>{e}</span></li>)}</ul>
            </div>
          )}

          {rec.dependencies.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">Dependencies</div>
              <ul className="space-y-1">{rec.dependencies.map((d, i) => <li key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-ink-soft shrink-0">→</span><span>{d}</span></li>)}</ul>
            </div>
          )}

          {rec.key_risks.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">Key Risks</div>
              <ul className="space-y-1">{rec.key_risks.map((r, i) => <li key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-severity-high shrink-0">⚠</span><span>{r}</span></li>)}</ul>
            </div>
          )}

          {rec.prerequisites.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">Prerequisites</div>
              <ul className="space-y-1">{rec.prerequisites.map((p, i) => <li key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-severity-medium shrink-0">!</span><span>{p}</span></li>)}</ul>
            </div>
          )}

          {rec.candidate_considerations.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-ink-soft uppercase tracking-wide mb-1">Candidate Considerations (Hypotheses)</div>
              <ul className="space-y-1">{rec.candidate_considerations.map((c, i) => <li key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-severity-low shrink-0">?</span><span>{c}</span></li>)}</ul>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-2 rounded-tile bg-accent-soft/20">
            <ArrowRight size={14} className="text-accent shrink-0" />
            <span className="text-xs font-medium text-ink"><span className="text-accent">Next action: </span>{rec.next_action}</span>
          </div>
        </div>
      )}
    </BentoCard>
  );
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="px-2.5 py-1.5 rounded-tile bg-white/20">
      <div className="text-[10px] text-ink-soft">{label}</div>
      <div className="text-sm font-semibold" style={{ color }}>{value}</div>
      <div className="text-[9px] text-ink-soft">{sub}</div>
    </div>
  );
}

function RoadmapView({ roadmap }: { roadmap: Roadmap | null }) {
  if (!roadmap || roadmap.total_items === 0) {
    return (
      <BentoCard className="p-12 flex flex-col items-center text-center" dense>
        <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mb-4 text-accent"><Route size={24} /></div>
        <h3 className="text-lg font-semibold text-ink mb-2">No roadmap items</h3>
        <p className="text-ink-muted max-w-sm">Run an assessment to generate a prioritized next-analysis roadmap.</p>
      </BentoCard>
    );
  }

  return (
    <div className="space-y-5">
      <BentoCard className="p-3" dense>
        <div className="flex items-start gap-2">
          <Info size={14} className="text-ink-soft shrink-0 mt-0.5" />
          <p className="text-xs text-ink-muted">
            This roadmap provides planning guidance only. It is not a migration plan. Each action identifies what to investigate next, not what to build.
          </p>
        </div>
      </BentoCard>

      {ROADMAP_GROUP_ORDER.map((group) => {
        const items = roadmap.groups[group];
        if (!items || items.length === 0) return null;
        return (
          <div key={group}>
            <div className="flex items-center gap-2 mb-3">
              <Map size={16} className="text-accent" />
              <h3 className="text-sm font-semibold text-ink">{group}</h3>
              <span className="text-xs text-ink-soft">({items.length})</span>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => {
                const prColor = PRIORITY_COLORS[item.priority] ?? '#8A8A93';
                return (
                  <BentoCard key={i} className="p-4" dense>
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-medium shrink-0" style={{ background: `${prColor}22`, color: prColor }}>{item.priority}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink">{item.action}</p>
                        <p className="text-xs text-ink-muted mt-1">{item.reason}</p>
                        {item.related_components.length > 0 && (
                          <div className="mt-2 flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] text-ink-soft">Related:</span>
                            {item.related_components.map((c, j) => <span key={j} className="text-[10px] px-1.5 py-0.5 rounded-pill bg-white/30 text-ink-muted">{c}</span>)}
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                          <div>
                            <span className="text-[10px] text-ink-soft font-medium">Required evidence:</span>
                            <ul className="space-y-0.5 mt-0.5">{item.required_evidence.map((e, j) => <li key={j} className="text-[11px] text-ink-muted flex gap-1"><span className="text-ink-soft shrink-0">•</span><span>{e}</span></li>)}</ul>
                          </div>
                          <div>
                            <span className="text-[10px] text-ink-soft font-medium">Expected outcome:</span>
                            <p className="text-[11px] text-ink-muted mt-0.5">{item.expected_outcome}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </BentoCard>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
