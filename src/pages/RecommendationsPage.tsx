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
import { resolveActiveApp, setStoredActiveAppId } from '@/utils/activeApp';

const CATEGORY_META: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  'Good Refactoring Candidate': { color: '#059669', icon: CheckCircle2, label: 'Good Refactoring Candidate' },
  'Requires Further Analysis': { color: '#D97706', icon: AlertTriangle, label: 'Requires Further Analysis' },
  'Retain on Mainframe for Now': { color: '#DC2626', icon: TrendingUp, label: 'Retain on Mainframe for Now' },
};

const PRIORITY_COLORS: Record<string, string> = {
  High: '#DC2626', Medium: '#D97706', Low: '#059669',
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
      setActiveApp(resolveActiveApp(data));
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
    setStoredActiveAppId(id);
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
        <PageHeader title="Refactoring Recommendations" breadcrumb={['ReFrameX', 'Recommendations']} />
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#F1F2F3] border border-[#E3E5E7] flex items-center justify-center mb-5 text-[#202124]"><Lightbulb size={28} /></div>
          <h2 className="text-xl font-medium text-[#202124] mb-2">No applications to recommend</h2>
          <p className="text-[#777D83] max-w-sm text-xs">Create an application, upload artifacts, and run an assessment to see refactoring recommendations here.</p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Refactoring Recommendations"
        breadcrumb={['ReFrameX', 'Recommendations']}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={activeApp?.id ?? ''}
                onChange={(e) => handleSelectApp(e.target.value)}
                className="h-9 appearance-none rounded-xl border border-[#E3E5E7] bg-white pl-3.5 pr-8 font-sans text-xs font-medium text-[#202124] outline-none shadow-sm transition-all hover:border-[#202124] focus:border-[#202124]"
              >
                {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A0A4A8]" />
            </div>
            <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-2xs">
              <button
                onClick={() => setView('recommendations')}
                className={`rounded-lg px-3.5 py-1 text-xs font-semibold transition-all ${view === 'recommendations' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >Recommendations</button>
              <button
                onClick={() => setView('roadmap')}
                className={`rounded-lg px-3.5 py-1 text-xs font-semibold transition-all ${view === 'roadmap' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >Roadmap</button>
            </div>
          </div>
        }
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] text-xs font-medium">
          <AlertCircle size={15} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#777D83]"><Loader2 size={24} className="animate-spin text-[#202124]" /></div>
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
      <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto" dense>
        <div className="w-14 h-14 rounded-2xl bg-[#F1F2F3] border border-[#E3E5E7] flex items-center justify-center mb-4 text-[#202124]"><Lightbulb size={24} /></div>
        <h3 className="text-lg font-medium text-[#202124] mb-2">No recommendations yet</h3>
        <p className="text-[#777D83] max-w-sm text-xs">Run an assessment to generate component-level refactoring recommendations.</p>
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
          const topBorder = cat === 'Good Refactoring Candidate'
            ? 'border-t-4 border-emerald-500'
            : cat === 'Requires Further Analysis'
              ? 'border-t-4 border-amber-500'
              : 'border-t-4 border-rose-500';

          return (
            <BentoCard key={cat} className={`p-5 ${topBorder} hover:shadow-sm transition-all`} dense>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${meta.color}15` }}>
                  <Icon size={20} style={{ color: meta.color }} />
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">{count}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">components</div>
                </div>
              </div>
              <div className="text-xs font-bold" style={{ color: meta.color }}>{meta.label}</div>
            </BentoCard>
          );
        })}
      </div>

      {/* Info note */}
      <BentoCard className="p-4" dense>
        <div className="flex items-start gap-2">
          <Info size={14} className="text-[#777D83] shrink-0 mt-0.5" />
          <p className="text-xs text-[#777D83]">
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
              <h3 className="text-base font-medium text-[#202124]">{meta.label}</h3>
              <span className="text-xs text-[#777D83]">({recs.length})</span>
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
    <BentoCard className="overflow-hidden p-0 shadow-[0_2px_8px_rgba(25,30,35,0.02)] transition-all hover:border-[#202124]" dense>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#FAFAFA] transition-colors">
        <ChevronRight size={14} className={`text-[#A0A4A8] shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#202124] truncate">{rec.component}</span>
            <span className="text-[10px] text-[#777D83]">({rec.component_type})</span>
          </div>
          <p className="text-xs text-[#777D83] truncate mt-0.5">{rec.reason}</p>
        </div>
        <span className="text-xs font-medium shrink-0" style={{ color }}>{rec.complexity_classification}</span>
        <span className="text-[11px] text-[#777D83] shrink-0 font-mono">Complexity {rec.complexity_score}</span>
      </button>
      {expanded && (
        <div className="px-5 pb-5 pt-2 border-t border-[#E3E5E7] bg-white space-y-3.5">
          <p className="text-xs text-[#202124] leading-relaxed pt-1">{rec.reason}</p>

          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <Metric label="Complexity" value={`${rec.complexity_score}`} sub={rec.complexity_classification} color="#DC2626" />
            <Metric label="Confidence" value={`${rec.confidence_score}`} sub={rec.confidence_classification} color="#166534" />
            <Metric label="Readiness" value={`${rec.readiness_score}`} sub={rec.readiness_classification} color="#166534" />
          </div>

          {rec.supporting_evidence.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-[#777D83] uppercase tracking-wide mb-1">Supporting Evidence</div>
              <ul className="space-y-1">{rec.supporting_evidence.map((e, i) => <li key={i} className="text-xs text-[#202124] flex gap-2"><span className="text-[#202124] shrink-0">•</span><span>{e}</span></li>)}</ul>
            </div>
          )}

          {rec.dependencies.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-[#777D83] uppercase tracking-wide mb-1">Dependencies</div>
              <ul className="space-y-1">{rec.dependencies.map((d, i) => <li key={i} className="text-xs text-[#777D83] flex gap-2"><span className="text-[#A0A4A8] shrink-0">→</span><span>{d}</span></li>)}</ul>
            </div>
          )}

          {rec.key_risks.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-[#DC2626] uppercase tracking-wide mb-1">Key Risks</div>
              <ul className="space-y-1">{rec.key_risks.map((r, i) => <li key={i} className="text-xs text-[#DC2626] flex gap-2"><span className="text-[#DC2626] shrink-0">⚠</span><span>{r}</span></li>)}</ul>
            </div>
          )}

          {rec.prerequisites.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-[#D97706] uppercase tracking-wide mb-1">Prerequisites</div>
              <ul className="space-y-1">{rec.prerequisites.map((p, i) => <li key={i} className="text-xs text-[#92400E] flex gap-2"><span className="text-[#D97706] shrink-0">!</span><span>{p}</span></li>)}</ul>
            </div>
          )}

          {rec.candidate_considerations.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-[#777D83] uppercase tracking-wide mb-1">Candidate Considerations (Hypotheses)</div>
              <ul className="space-y-1">{rec.candidate_considerations.map((c, i) => <li key={i} className="text-xs text-[#777D83] flex gap-2"><span className="text-[#202124] shrink-0">?</span><span>{c}</span></li>)}</ul>
            </div>
          )}

          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#E3E5E7] bg-[#FAFAFA]">
            <ArrowRight size={14} className="text-[#202124] shrink-0" />
            <span className="text-xs font-medium text-[#202124]"><span className="text-[#777D83]">Next action: </span>{rec.next_action}</span>
          </div>
        </div>
      )}
    </BentoCard>
  );
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="px-3 py-2 rounded-xl border border-[#E3E5E7] bg-[#FAFAFA]">
      <div className="text-[10px] text-[#777D83] uppercase font-medium">{label}</div>
      <div className="text-sm font-medium mt-0.5 tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[10px] text-[#777D83]">{sub}</div>
    </div>
  );
}

function RoadmapView({ roadmap }: { roadmap: Roadmap | null }) {
  if (!roadmap || roadmap.total_items === 0) {
    return (
      <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto" dense>
        <div className="w-14 h-14 rounded-2xl bg-[#F1F2F3] border border-[#E3E5E7] flex items-center justify-center mb-4 text-[#202124]"><Route size={24} /></div>
        <h3 className="text-lg font-medium text-[#202124] mb-2">No roadmap items</h3>
        <p className="text-[#777D83] max-w-sm text-xs">Run an assessment to generate a prioritized next-analysis roadmap.</p>
      </BentoCard>
    );
  }

  return (
    <div className="space-y-5">
      <BentoCard className="p-4" dense>
        <div className="flex items-start gap-2">
          <Info size={14} className="text-[#777D83] shrink-0 mt-0.5" />
          <p className="text-xs text-[#777D83]">
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
              <Map size={16} className="text-[#202124]" />
              <h3 className="text-base font-medium text-[#202124]">{group}</h3>
              <span className="text-xs text-[#777D83]">({items.length})</span>
            </div>
            <div className="space-y-2.5">
              {items.map((item, i) => {
                const prColor = PRIORITY_COLORS[item.priority] ?? '#64748B';
                return (
                  <BentoCard key={i} className="p-5" dense>
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-medium shrink-0" style={{ background: `${prColor}15`, color: prColor }}>{item.priority}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#202124]">{item.action}</p>
                        <p className="text-xs text-[#777D83] mt-1">{item.reason}</p>
                        {item.related_components.length > 0 && (
                          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-[#777D83]">Related:</span>
                            {item.related_components.map((c, j) => <span key={j} className="text-[10px] px-2 py-0.5 rounded-md border border-[#E3E5E7] bg-[#FAFAFA] text-[#202124]">{c}</span>)}
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#E3E5E7]">
                          <div>
                            <span className="text-[10px] text-[#777D83] font-medium uppercase tracking-wide">Required evidence:</span>
                            <ul className="space-y-0.5 mt-1">{item.required_evidence.map((e, j) => <li key={j} className="text-xs text-[#202124] flex gap-1.5"><span className="text-[#A0A4A8] shrink-0">•</span><span>{e}</span></li>)}</ul>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#777D83] font-medium uppercase tracking-wide">Expected outcome:</span>
                            <p className="text-xs text-[#202124] mt-1 leading-relaxed">{item.expected_outcome}</p>
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
