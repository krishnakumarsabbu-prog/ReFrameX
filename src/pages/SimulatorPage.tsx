import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, AlertCircle, X, ChevronDown, Info, GitBranch, Database,
  Boxes, Network, Zap, AlertTriangle, Shield, ArrowDownToDot,
  ArrowUpFromDot, RotateCw, Target, FileSearch, Layers, Code2,
  Sparkles, CheckCircle2, Wrench, Lock, ScrollText,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import StatusBadge from '@/components/StatusBadge';
import {
  api, type Application, type Component, type GraphData,
  type SimulationImpact, type ScenarioAnalysis, type SimulateResponse,
  type SimulationSummary,
} from '@/api/client';
import { resolveActiveApp, setStoredActiveAppId } from '@/utils/activeApp';

type ScenarioType = 'extract_service' | 'refactor_in_place' | 'retain_mainframe';

const SCENARIOS: Record<ScenarioType, { label: string; icon: typeof Sparkles; color: string; desc: string }> = {
  extract_service: {
    label: 'Extract to Distributed Service',
    icon: Sparkles,
    color: '#059669',
    desc: 'Hypothetically extract this component into a separate distributed service.',
  },
  refactor_in_place: {
    label: 'Refactor in Place',
    icon: Wrench,
    color: '#D97706',
    desc: 'Hypothetically refactor the component while keeping it on the mainframe.',
  },
  retain_mainframe: {
    label: 'Retain on Mainframe',
    icon: Lock,
    color: '#DC2626',
    desc: 'Hypothetically retain the component on the mainframe without structural change.',
  },
};

const TYPE_ICONS: Record<string, typeof Code2> = {
  PROGRAM: Code2, MODULE: Layers, COPYBOOK: FileSearch, TABLE: Database,
  DATABASE: Database, FILE: FileSearch, DATASET: Layers, JOB: Boxes,
  PROC: Boxes, TRANSACTION: Zap, MAP: ScrollText, EXTERNAL_SYSTEM: Network,
  API: Zap, MQ: Zap, INTERFACE: Network, SECURITY_RESOURCE: Shield,
  UNKNOWN: AlertTriangle,
};

export default function SimulatorPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('extract_service');
  const [impact, setImpact] = useState<SimulationImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [simulation, setSimulation] = useState<SimulateResponse | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [pastSims, setPastSims] = useState<SimulationSummary[]>([]);
  const [componentSearch, setComponentSearch] = useState('');

  const loadApps = useCallback(async () => {
    try {
      const data = await api.listApplications();
      setApps(data);
      const active = resolveActiveApp(data);
      setActiveApp(active);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    }
  }, []);

  const loadData = useCallback(async (appId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [graph, comps, sims] = await Promise.all([
        api.getGraph(appId),
        api.getComponents(appId),
        api.listSimulations(appId),
      ]);
      setGraphData(graph);
      setComponents(comps);
      setPastSims(sims);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
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

  // Load impact when component changes
  useEffect(() => {
    if (!activeApp || !selectedComponentId) {
      setImpact(null);
      return;
    }
    setImpactLoading(true);
    setSimulation(null);
    api.getComponentImpactExtended(activeApp.id, selectedComponentId)
      .then((data) => setImpact(data))
      .catch(() => setImpact(null))
      .finally(() => setImpactLoading(false));
  }, [activeApp, selectedComponentId]);

  async function handleRunSimulation() {
    if (!activeApp || !selectedComponentId) return;
    setSimulating(true);
    setError(null);
    try {
      const result = await api.runSimulation(activeApp.id, {
        component_id: selectedComponentId,
        scenario_type: selectedScenario,
      });
      setSimulation(result);
      // Refresh past sims
      const sims = await api.listSimulations(activeApp.id);
      setPastSims(sims);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  }

  // Build component list from graph nodes + components
  const componentOptions = useMemo(() => {
    if (!graphData) return [];
    const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));
    return components
      .filter((c) => nodeMap.has(c.id))
      .map((c) => {
        const node = nodeMap.get(c.id)!;
        return {
          id: c.id,
          name: c.name,
          component_type: c.component_type,
          technology: c.technology,
          evidence_class: c.evidence_class,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [graphData, components]);

  const filteredComponents = useMemo(() => {
    if (!componentSearch) return componentOptions;
    const q = componentSearch.toLowerCase();
    return componentOptions.filter((c) =>
      c.name.toLowerCase().includes(q) || c.component_type.toLowerCase().includes(q)
    );
  }, [componentOptions, componentSearch]);

  if (apps.length === 0 && !loading) {
    return (
      <>
        <PageHeader title="Refactoring Impact Simulator" breadcrumb={['ReFrameX', 'Simulator']} />
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#F1F2F3] border border-[#E3E5E7] flex items-center justify-center mb-5 text-[#202124]">
            <GitBranch size={28} />
          </div>
          <h2 className="text-xl font-medium text-[#202124] mb-2">No applications to simulate</h2>
          <p className="text-[#777D83] max-w-sm text-xs">
            Create an application, upload artifacts, run analysis and dependency discovery to use the simulator.
          </p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Refactoring Impact Simulator"
        breadcrumb={['ReFrameX', 'Simulator']}
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
        <div className="flex items-center justify-center py-20 text-[#777D83]">
          <Loader2 size={24} className="animate-spin text-[#202124]" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Disclaimer */}
          <BentoCard className="p-4" dense>
            <div className="flex items-start gap-2">
              <Info size={14} className="text-[#777D83] shrink-0 mt-0.5" />
              <p className="text-xs text-[#777D83] leading-relaxed">
                This is a hypothetical planning tool. It never modifies source code and does not assume a target platform.
                Graph connectivity is not proof of runtime impact. No cost, delivery time, savings, or performance figures are provided.
                All conclusions are classified Evidence-based, Inferred, Assumed, or Unknown.
              </p>
            </div>
          </BentoCard>

          {/* Step 1: Component selection */}
          <BentoCard className="p-5" dense>
            <div className="flex items-center gap-2 mb-3">
              <Target size={16} className="text-[#202124]" />
              <h3 className="text-base font-medium text-[#202124]">Select a Component</h3>
            </div>
            {componentOptions.length === 0 ? (
              <p className="text-xs text-[#777D83]">
                No components in the dependency graph. Run analysis and dependency discovery first.
              </p>
            ) : (
              <>
                <div className="relative mb-3">
                  <input
                    type="text"
                    placeholder="Search components..."
                    value={componentSearch}
                    onChange={(e) => setComponentSearch(e.target.value)}
                    className="w-full rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] px-3.5 py-2 text-xs text-[#202124] placeholder:text-[#A0A4A8] outline-none focus:border-[#202124] focus:bg-white transition-colors"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto rounded-xl border border-[#E3E5E7] bg-white divide-y divide-[#E3E5E7]">
                  {filteredComponents.map((c) => {
                    const Icon = TYPE_ICONS[c.component_type] ?? AlertTriangle;
                    const isSelected = c.id === selectedComponentId;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedComponentId(c.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${isSelected ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'hover:bg-slate-50'
                          }`}
                      >
                        <Icon size={14} className="shrink-0 text-[#777D83]" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-[#202124] truncate">{c.name}</div>
                          <div className="text-[10px] text-[#777D83]">{c.component_type} · {c.technology}</div>
                        </div>
                        <StatusBadge evidence={c.evidence_class as any} />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </BentoCard>

          {/* Step 2: Impact profile */}
          {selectedComponentId && (
            <>
              {impactLoading ? (
                <div className="flex items-center justify-center py-12 text-[#777D83]">
                  <Loader2 size={20} className="animate-spin text-[#202124]" />
                </div>
              ) : impact ? (
                <ImpactProfile impact={impact} />
              ) : null}
            </>
          )}

          {/* Step 3: Scenario selection + simulation */}
          {impact && (
            <BentoCard className="p-5" dense>
              <div className="flex items-center gap-2 mb-4">
                <GitBranch size={16} className="text-[#202124]" />
                <h3 className="text-base font-medium text-[#202124]">Select a Hypothetical Scenario</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {(Object.keys(SCENARIOS) as ScenarioType[]).map((st) => {
                  const cfg = SCENARIOS[st];
                  const Icon = cfg.icon;
                  const isActive = selectedScenario === st;
                  const activeBorders = {
                    extract_service: 'border-2 border-emerald-500 bg-emerald-50/40 shadow-2xs',
                    refactor_in_place: 'border-2 border-amber-500 bg-amber-50/40 shadow-2xs',
                    retain_mainframe: 'border-2 border-rose-500 bg-rose-50/40 shadow-2xs',
                  }[st];

                  return (
                    <button
                      key={st}
                      onClick={() => {
                        setSelectedScenario(st);
                        setSimulation(null);
                      }}
                      className={`text-left p-4 rounded-2xl border transition-all ${isActive
                          ? activeBorders
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: `${cfg.color}15` }}
                        >
                          <Icon size={16} style={{ color: cfg.color }} />
                        </div>
                        <span className="text-xs font-bold text-slate-900">{cfg.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{cfg.desc}</p>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleRunSimulation}
                disabled={simulating}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-semibold hover:from-indigo-700 hover:to-blue-700 transition-all disabled:opacity-50 shadow-sm shadow-indigo-600/20"
              >
                {simulating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Run Simulation
              </button>
            </BentoCard>
          )}

          {/* Step 4: Simulation result */}
          {simulation && (
            <ScenarioResult simulation={simulation} />
          )}

          {/* Past simulations */}
          {pastSims.length > 0 && (
            <BentoCard className="p-5" dense>
              <div className="flex items-center gap-2 mb-3">
                <RotateCw size={14} className="text-[#777D83]" />
                <h3 className="text-base font-medium text-[#202124]">Persisted Scenarios ({pastSims.length})</h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pastSims.map((sim) => {
                  const cfg = SCENARIOS[sim.scenario_type as ScenarioType] ?? SCENARIOS.extract_service;
                  const Icon = cfg.icon;
                  return (
                    <div key={sim.simulation_id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-[#E3E5E7] bg-[#FAFAFA]">
                      <Icon size={14} style={{ color: cfg.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[#202124] truncate">{sim.component_name}</div>
                        <div className="text-[10px] text-[#777D83]">{cfg.label}</div>
                      </div>
                      <span className="text-[10px] text-[#A0A4A8] shrink-0 font-mono">
                        {sim.created_at ? new Date(sim.created_at).toLocaleString() : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </BentoCard>
          )}
        </div>
      )}
    </>
  );
}


function ImpactProfile({ impact }: { impact: SimulationImpact }) {
  return (
    <BentoCard className="p-6" dense>
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E3E5E7]">
        <FileSearch size={16} className="text-[#202124]" />
        <h3 className="text-base font-medium text-[#202124]">Impact Profile: {impact.component_name}</h3>
        <StatusBadge evidence={impact.evidence_class as any} />
      </div>

      {/* Component metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MiniMetric label="Type" value={impact.component_type} />
        <MiniMetric label="Technology" value={impact.technology || '—'} />
        <MiniMetric label="Complexity" value={impact.complexity_classification} />
        <MiniMetric label="Readiness" value={impact.readiness_classification} />
      </div>

      {/* Impact counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <CountMetric icon={<ArrowDownToDot size={14} />} label="Directly Impacted" value={impact.directly_impacted} color="#166534" />
        <CountMetric icon={<ArrowDownToDot size={14} />} label="Indirectly Impacted" value={impact.indirectly_impacted} color="#D97706" />
        <CountMetric icon={<Target size={14} />} label="Potential Impact (Validate)" value={impact.potential_impact_requiring_validation} color="#DC2626" />
        <CountMetric icon={<ArrowUpFromDot size={14} />} label="Indirect Upstream" value={impact.indirect_upstream} color="#777D83" />
      </div>

      {/* Risk flags */}
      {(impact.circular || impact.single_point_of_dependency) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {impact.circular && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-medium bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626]">
              <RotateCw size={12} /> Circular dependency
            </span>
          )}
          {impact.single_point_of_dependency && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-medium bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E]">
              <AlertTriangle size={12} /> Single point of dependency
            </span>
          )}
        </div>
      )}

      {/* Dependency details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DepSection title="Shared Data Dependencies" items={impact.shared_data_dependencies.map((d) => `${d.name} (${d.component_type})`)} icon={<Database size={14} />} />
        <DepSection title="Connected Batch Jobs" items={impact.connected_jobs.map((j) => j.name)} icon={<Boxes size={14} />} />
        <DepSection title="Database Dependencies" items={impact.database_dependencies.map((d) => `${d.name} (${d.relationship_type})`)} icon={<Database size={14} />} />
        <DepSection title="External Interfaces" items={impact.external_interfaces.map((e) => `${e.name} (${e.component_type})`)} icon={<Network size={14} />} />
        <DepSection
          title="Transaction-Boundary Concerns"
          items={impact.possible_transaction_boundary_concerns.map((t) => `${t.name} (${t.technology})`)}
          icon={<Zap size={14} />}
          highlight
        />
        <DepSection
          title="Unresolved Dependencies"
          items={impact.unresolved_dependencies.map((u) => `${u.target_name} — ${u.relationship_type}`)}
          icon={<AlertTriangle size={14} />}
          highlight
        />
      </div>

      {/* Evidence gaps */}
      {impact.evidence_gaps.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#E3E5E7]">
          <div className="text-[10px] font-medium text-[#777D83] uppercase tracking-wide mb-2">Evidence Gaps</div>
          <div className="space-y-1.5">
            {impact.evidence_gaps.map((g) => (
              <div key={g.finding_id} className="flex items-start gap-2 text-xs text-[#202124]">
                <StatusBadge evidence={g.evidence_class as any} />
                <span>{g.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upstream/downstream paths */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-3 border-t border-[#E3E5E7]">
        <PathSection title="Upstream Paths" paths={impact.upstream_paths} icon={<ArrowUpFromDot size={14} />} />
        <PathSection title="Downstream Paths" paths={impact.downstream_paths} icon={<ArrowDownToDot size={14} />} />
      </div>

      <p className="text-xs text-[#777D83] mt-4 italic">{impact.graph_connectivity_note}</p>
    </BentoCard>
  );
}


function ScenarioResult({ simulation }: { simulation: SimulateResponse }) {
  const scenario: ScenarioAnalysis = simulation.scenario;
  const cfg = SCENARIOS[simulation.scenario_type as ScenarioType] ?? SCENARIOS.extract_service;
  const Icon = cfg.icon;

  return (
    <BentoCard className="p-6" dense>
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E3E5E7]">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${cfg.color}15` }}>
          <Icon size={16} style={{ color: cfg.color }} />
        </div>
        <div>
          <h3 className="text-base font-medium text-[#202124]">{cfg.label}</h3>
          <p className="text-xs text-[#777D83]">Scenario analysis for {simulation.component_name}</p>
        </div>
        <span className="ml-auto text-xs text-[#A0A4A8] font-mono">
          {simulation.created_at ? new Date(simulation.created_at).toLocaleString() : ''}
        </span>
      </div>

      {/* Current state vs scenario */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="p-4 rounded-xl border border-[#E3E5E7] bg-[#FAFAFA]">
          <div className="text-[10px] font-medium text-[#777D83] uppercase tracking-wide mb-2.5">Current State</div>
          <div className="space-y-1.5">
            <KvRow label="Type" value={scenario.current_state.component_type} />
            <KvRow label="Technology" value={scenario.current_state.technology || '—'} />
            <KvRow label="Complexity" value={scenario.current_state.complexity_classification} />
            <KvRow label="Confidence" value={scenario.current_state.confidence_classification} />
            <KvRow label="Readiness" value={scenario.current_state.readiness_classification} />
            <KvRow label="Direct deps" value={`${scenario.current_state.direct_dependencies}`} />
            <KvRow label="Upstream" value={`${scenario.current_state.upstream_count}`} />
            <KvRow label="Downstream" value={`${scenario.current_state.downstream_count}`} />
          </div>
        </div>
        <div className="p-4 rounded-xl border border-[#E3E5E7] bg-[#FAFAFA]">
          <div className="text-[10px] font-medium text-[#777D83] uppercase tracking-wide mb-2.5">Selected Scenario</div>
          <div className="space-y-1.5">
            <KvRow label="Scenario" value={cfg.label} />
            <KvRow label="Evidence class" value={scenario.evidence_classification} />
          </div>
          <p className="text-xs text-[#777D83] mt-2 leading-relaxed">{scenario.evidence_classification_note}</p>
        </div>
      </div>

      {/* Scenario sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScenarioSection title="Potential Benefits" items={scenario.potential_benefits} icon={<CheckCircle2 size={14} />} color="#166534" />
        <ScenarioSection title="Technical Challenges" items={scenario.technical_challenges} icon={<AlertTriangle size={14} />} color="#DC2626" />
        <ScenarioSection title="Dependencies to Resolve" items={scenario.dependencies_to_resolve} icon={<GitBranch size={14} />} color="#D97706" />
        <ScenarioSection title="Risk Factors" items={scenario.risk_factors} icon={<AlertCircle size={14} />} color="#DC2626" />
        <ScenarioSection title="Missing Evidence" items={scenario.missing_evidence} icon={<FileSearch size={14} />} color="#777D83" />
        <ScenarioSection title="Prerequisites" items={scenario.prerequisites} icon={<Target size={14} />} color="#166534" />
      </div>

      {/* Specialist validation */}
      {scenario.specialist_validation_required.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#E3E5E7]">
          <div className="text-[10px] font-medium text-[#777D83] uppercase tracking-wide mb-2">Specialist Validation Required</div>
          <div className="space-y-1.5">
            {scenario.specialist_validation_required.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-[#202124]">
                <Shield size={12} className="text-[#777D83] shrink-0 mt-0.5" />
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-[#777D83] mt-4 italic">{scenario.disclaimer}</p>
    </BentoCard>
  );
}


// ---- Small UI helpers ----

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl border border-[#E3E5E7] bg-[#FAFAFA]">
      <div className="text-[10px] text-[#777D83] uppercase tracking-wide font-medium">{label}</div>
      <div className="text-xs font-medium text-[#202124] mt-0.5">{value}</div>
    </div>
  );
}

function CountMetric({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="p-3.5 rounded-xl border border-[#E3E5E7] bg-[#FAFAFA]">
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] text-[#777D83] uppercase tracking-wide font-medium">{label}</span>
      </div>
      <div className="text-xl font-normal tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}

function DepSection({ title, items, icon, highlight }: { title: string; items: string[]; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="p-3 rounded-xl border border-[#E3E5E7] bg-[#FAFAFA]">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[#777D83]">{icon}</span>
        <span className="text-xs font-medium text-[#202124]">{title}</span>
        <span className="text-xs text-[#777D83]">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-[#A0A4A8] italic">None detected</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className={`text-xs flex gap-1.5 ${highlight ? 'text-[#DC2626]' : 'text-[#202124]'}`}>
              <span className="text-[#A0A4A8] shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PathSection({ title, paths, icon }: { title: string; paths: { path: { component_id: string; name: string; component_type: string }[]; length: number }[]; icon: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl border border-[#E3E5E7] bg-[#FAFAFA]">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[#777D83]">{icon}</span>
        <span className="text-xs font-medium text-[#202124]">{title}</span>
        <span className="text-xs text-[#777D83]">({paths.length})</span>
      </div>
      {paths.length === 0 ? (
        <p className="text-xs text-[#A0A4A8] italic">No paths found</p>
      ) : (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {paths.map((p, i) => (
            <div key={i} className="text-xs text-[#202124] flex items-center gap-1 flex-wrap">
              {p.path.map((node, j) => (
                <span key={j} className="flex items-center gap-1">
                  {j > 0 && <span className="text-[#A0A4A8]">→</span>}
                  <span className="text-[#202124] font-medium">{node.name}</span>
                </span>
              ))}
              <span className="text-[#777D83] ml-1 font-mono text-[10px]">({p.length} hops)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScenarioSection({ title, items, icon, color }: { title: string; items: string[]; icon: React.ReactNode; color: string }) {
  return (
    <div className="p-3 rounded-xl border border-[#E3E5E7] bg-[#FAFAFA]">
      <div className="flex items-center gap-1.5 mb-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs font-medium" style={{ color }}>{title}</span>
        <span className="text-xs text-[#777D83]">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-[#A0A4A8] italic">None identified from available evidence</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="text-xs text-[#202124] flex gap-1.5">
              <span className="shrink-0" style={{ color }}>•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-[#777D83]">{label}</span>
      <span className="text-[#202124] font-medium">{value}</span>
    </div>
  );
}
