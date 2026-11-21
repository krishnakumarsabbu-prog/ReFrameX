import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, MarkerType,
  type Node, type Edge, type Connection, type NodeProps,
  BackgroundVariant, ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  GitBranch, Loader2, AlertCircle, X, RefreshCw, ChevronDown,
  Boxes, Code2, Database, FileSearch, Cpu, ScrollText, Shield,
  Layers, Zap, AlertTriangle, Info, Search, Maximize2,
  Network, ArrowDownToDot, ArrowUpFromDot, RotateCw, Target,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import StatusBadge from '@/components/StatusBadge';
import {
  api, type Application, type GraphData, type GraphNode, type GraphEdge,
  type DependencySummary, type ComponentImpact, type Dependency,
} from '@/api/client';
import type { EvidenceClass } from '@/types';

const EVIDENCE_COLORS: Record<string, string> = {
  'Evidence-based': '#4D8F86',
  'Inferred': '#E0A238',
  'Assumed': '#C99C6D',
  'Unknown': '#A89B94',
};

// Component type → icon + color for graph nodes
const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; group: string }> = {
  PROGRAM: { icon: <Code2 size={14} />, color: '#4D8F86', group: 'Programs' },
  MODULE: { icon: <Layers size={14} />, color: '#547C7B', group: 'Programs' },
  COPYBOOK: { icon: <FileSearch size={14} />, color: '#C99C6D', group: 'Programs' },
  TABLE: { icon: <Database size={14} />, color: '#E8A838', group: 'Data' },
  DATABASE: { icon: <Database size={14} />, color: '#E8A838', group: 'Data' },
  FILE: { icon: <FileSearch size={14} />, color: '#D9C1A2', group: 'Data' },
  DATASET: { icon: <Layers size={14} />, color: '#D9C1A2', group: 'Data' },
  JOB: { icon: <Boxes size={14} />, color: '#A9784E', group: 'Batch Jobs' },
  PROC: { icon: <Cpu size={14} />, color: '#A9784E', group: 'Batch Jobs' },
  TRANSACTION: { icon: <Zap size={14} />, color: '#E88555', group: 'Transactions & Screens' },
  MAP: { icon: <ScrollText size={14} />, color: '#E88555', group: 'Transactions & Screens' },
  EXTERNAL_SYSTEM: { icon: <Network size={14} />, color: '#8A8A93', group: 'External Systems' },
  API: { icon: <Zap size={14} />, color: '#8A8A93', group: 'Integrations' },
  MQ: { icon: <Zap size={14} />, color: '#8A8A93', group: 'Integrations' },
  INTERFACE: { icon: <Network size={14} />, color: '#8A8A93', group: 'Integrations' },
  SECURITY_RESOURCE: { icon: <Shield size={14} />, color: '#B084D6', group: 'Security' },
  SCHEDULE: { icon: <RefreshCw size={14} />, color: '#547C7B', group: 'Batch Jobs' },
  UNKNOWN: { icon: <AlertTriangle size={14} />, color: '#A89B94', group: 'Other' },
};

const GROUP_ORDER = ['Programs', 'Data', 'Batch Jobs', 'Transactions & Screens', 'Integrations', 'External Systems', 'Security', 'Other'];

// Layout nodes by group in vertical columns
function layoutNodes(nodes: GraphNode[], edges: GraphEdge[], selectedId: string | null, depthFilter: number): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes: [], edges: [] };

  // If a node is selected and depth filter > 0, filter to neighborhood
  let visibleNodeIds: Set<string> | null = null;
  if (selectedId && depthFilter > 0) {
    const adj = new Map<string, string[]>();
    const radj = new Map<string, string[]>();
    for (const e of edges) {
      adj.set(e.source, [...(adj.get(e.source) ?? []), e.target]);
      radj.set(e.target, [...(radj.get(e.target) ?? []), e.source]);
    }
    const bfs = (start: string, graph: Map<string, string[]>, maxDepth: number): Set<string> => {
      const visited = new Set<string>([start]);
      let frontier = [start];
      for (let d = 0; d < maxDepth && frontier.length > 0; d++) {
        const next: string[] = [];
        for (const n of frontier) {
          for (const nb of graph.get(n) ?? []) {
            if (!visited.has(nb)) {
              visited.add(nb);
              next.push(nb);
            }
          }
        }
        frontier = next;
      }
      return visited;
    };
    const down = bfs(selectedId, adj, depthFilter);
    const up = bfs(selectedId, radj, depthFilter);
    visibleNodeIds = new Set([...down, ...up]);
  }

  const filteredNodes = visibleNodeIds
    ? nodes.filter((n) => visibleNodeIds!.has(n.id))
    : nodes;

  // Group nodes by component type group
  const byGroup: Record<string, GraphNode[]> = {};
  for (const n of filteredNodes) {
    const cfg = TYPE_CONFIG[n.component_type] ?? TYPE_CONFIG.UNKNOWN;
    const group = cfg.group;
    if (!byGroup[group]) byGroup[group] = [];
    byGroup[group].push(n);
  }

  // Position: columns per group, stacked vertically
  const COL_WIDTH = 260;
  const ROW_HEIGHT = 90;
  const nodeMap = new Map<string, GraphNode>();
  for (const n of filteredNodes) nodeMap.set(n.id, n);

  const rfNodes: Node[] = [];
  let colIdx = 0;
  for (const group of GROUP_ORDER) {
    const groupNodes = byGroup[group];
    if (!groupNodes || groupNodes.length === 0) continue;
    groupNodes.sort((a, b) => a.name.localeCompare(b.name));
    for (let i = 0; i < groupNodes.length; i++) {
      const n = groupNodes[i];
      const cfg = TYPE_CONFIG[n.component_type] ?? TYPE_CONFIG.UNKNOWN;
      rfNodes.push({
        id: n.id,
        type: 'glassNode',
        position: { x: colIdx * COL_WIDTH, y: i * ROW_HEIGHT },
        data: {
          label: n.name,
          componentType: n.component_type,
          technology: n.technology,
          evidenceClass: n.evidence_class,
          icon: cfg.icon,
          color: cfg.color,
          sourceFilename: n.source_filename,
          isSelected: n.id === selectedId,
        },
      });
    }
    colIdx++;
  }

  // Filter edges to only those between visible nodes
  const visibleIds = new Set(rfNodes.map((n) => n.id));
  const rfEdges: Edge[] = edges
    .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
    .map((e) => {
      const isInf = e.evidence_class === 'Inferred';
      const isUnk = e.evidence_class === 'Unknown';
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: isInf,
        style: {
          stroke: isUnk ? '#A89B94' : isInf ? '#E0A238' : '#4D8F86',
          strokeWidth: 1.5,
          strokeDasharray: isUnk ? '2 4' : isInf ? '6 3' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isUnk ? '#A89B94' : isInf ? '#E0A238' : '#4D8F86',
          width: 16,
          height: 16,
        },
        label: e.relationship_type.replace(/\s*\(.*\)/, '').trim(),
        labelStyle: { fontSize: 9, fill: '#8A8A93' },
        labelBgStyle: { fill: 'rgba(255,255,255,0.85)' },
        labelBgPadding: [4, 2],
        data: {
          evidenceClass: e.evidence_class,
          description: e.description,
          lineNumber: e.source_line_number,
        },
      };
    });

  return { nodes: rfNodes, edges: rfEdges };
}

// Custom node component for frosted-glass pill nodes
function GlassNode({ data }: NodeProps) {
  const d = data as {
    label: string; componentType: string; technology: string;
    evidenceClass: string; icon: React.ReactNode; color: string;
    sourceFilename: string; isSelected: boolean;
  };
  const isUnk = d.evidenceClass === 'Unknown';
  return (
    <div
      className={`rf-glass-node ${d.isSelected ? 'rf-selected' : ''}`}
      style={{
        background: d.isSelected
          ? 'rgba(232, 133, 85, 0.92)'
          : isUnk
          ? 'rgba(168, 155, 148, 0.72)'
          : 'rgba(255, 255, 255, 0.78)',
        borderColor: d.isSelected ? '#E88555' : d.color + '55',
      }}
    >
      <div className="rf-node-icon" style={{ color: d.isSelected ? '#fff' : d.color }}>
        {d.icon}
      </div>
      <div className="rf-node-text">
        <div className="rf-node-label" style={{ color: d.isSelected ? '#fff' : '#1B1612' }}>
          {d.label}
        </div>
        <div className="rf-node-meta" style={{ color: d.isSelected ? 'rgba(255,255,255,0.7)' : '#8A8A93' }}>
          {d.componentType}{d.technology ? ` · ${d.technology}` : ''}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { glassNode: GlassNode };

export default function DependenciesPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [summary, setSummary] = useState<DependencySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterRelType, setFilterRelType] = useState<string>('all');
  const [filterCompType, setFilterCompType] = useState<string>('all');
  const [filterEvidence, setFilterEvidence] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [depthFilter, setDepthFilter] = useState<number>(0);
  const [showMore, setShowMore] = useState(false);
  const [impact, setImpact] = useState<ComponentImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const loadApps = useCallback(async () => {
    try {
      const data = await api.listApplications();
      setApps(data);
      const active = data.find((a) => a.is_active) ?? data[0] ?? null;
      setActiveApp(active);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    }
  }, []);

  const loadGraph = useCallback(async (appId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [graph, summ] = await Promise.all([
        api.getGraph(appId),
        api.getDependencySummary(appId),
      ]);
      setGraphData(graph);
      setSummary(summ);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dependency graph');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);
  useEffect(() => { if (activeApp) loadGraph(activeApp.id); }, [activeApp, loadGraph]);

  async function handleSelectApp(id: string) {
    try {
      await api.updateApplication(id, { is_active: true });
      await loadApps();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to select application');
    }
  }

  async function handleDiscover() {
    if (!activeApp) return;
    setDiscovering(true);
    setError(null);
    try {
      await api.discoverDependencies(activeApp.id);
      await loadGraph(activeApp.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Discovery failed');
    } finally {
      setDiscovering(false);
    }
  }

  // Load impact data when a node is selected
  useEffect(() => {
    if (!selectedNodeId) {
      setImpact(null);
      return;
    }
    setImpactLoading(true);
    api.getComponentImpact(selectedNodeId)
      .then((data) => setImpact(data))
      .catch(() => setImpact(null))
      .finally(() => setImpactLoading(false));
  }, [selectedNodeId]);

  // Apply filters and layout
  const { layoutResult, filteredNodeCount } = useMemo(() => {
    if (!graphData) return { layoutResult: { nodes: [], edges: [] }, filteredNodeCount: 0 };

    // Filter edges by relationship type and evidence class
    let filteredEdges = graphData.edges.filter((e) => {
      if (filterRelType !== 'all' && e.relationship_type !== filterRelType) return false;
      if (filterEvidence !== 'all' && e.evidence_class !== filterEvidence) return false;
      return true;
    });

    // Get node IDs that appear in filtered edges
    const edgeNodeIds = new Set<string>();
    for (const e of filteredEdges) {
      edgeNodeIds.add(e.source);
      edgeNodeIds.add(e.target);
    }

    // Filter nodes by component type, evidence, and search term
    let filteredNodes = graphData.nodes.filter((n) => {
      if (filterCompType !== 'all' && n.component_type !== filterCompType) return false;
      if (filterEvidence !== 'all' && n.evidence_class !== filterEvidence) return false;
      if (searchTerm && !n.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      // Only include nodes that have at least one edge (unless no edge filters active)
      if (filterRelType !== 'all' || filterEvidence !== 'all') {
        if (!edgeNodeIds.has(n.id)) return false;
      }
      return true;
    });

    // Also include nodes referenced by filtered edges even if they don't match comp type filter
    if (filterCompType === 'all') {
      for (const e of filteredEdges) {
        for (const nid of [e.source, e.target]) {
          const n = graphData.nodes.find((nn) => nn.id === nid);
          if (n && !filteredNodes.find((fn) => fn.id === nid)) {
            if (!searchTerm || n.name.toLowerCase().includes(searchTerm.toLowerCase())) {
              filteredNodes.push(n);
            }
          }
        }
      }
    }

    const result = layoutNodes(filteredNodes, filteredEdges, selectedNodeId, depthFilter);
    return { layoutResult: result, filteredNodeCount: filteredNodes.length };
  }, [graphData, filterRelType, filterCompType, filterEvidence, searchTerm, selectedNodeId, depthFilter]);

  // Update React Flow nodes/edges when layout changes
  useEffect(() => {
    setNodes(layoutResult.nodes);
    setEdges(layoutResult.edges);
  }, [layoutResult, setNodes, setEdges]);

  // Highlight chain: find all nodes in the dependency chain of the selected node
  const highlightIds = useMemo(() => {
    if (!selectedNodeId || !graphData) return null;
    const adj = new Map<string, string[]>();
    const radj = new Map<string, string[]>();
    for (const e of graphData.edges) {
      adj.set(e.source, [...(adj.get(e.source) ?? []), e.target]);
      radj.set(e.target, [...(radj.get(e.target) ?? []), e.source]);
    }
    const chain = new Set<string>([selectedNodeId]);
    const bfs = (start: string, graph: Map<string, string[]>) => {
      const q = [start];
      while (q.length > 0) {
        const n = q.shift()!;
        for (const nb of graph.get(n) ?? []) {
          if (!chain.has(nb)) { chain.add(nb); q.push(nb); }
        }
      }
    };
    bfs(selectedNodeId, adj);
    bfs(selectedNodeId, radj);
    return chain;
  }, [selectedNodeId, graphData]);

  // Apply highlight styling to nodes and edges
  useEffect(() => {
    if (!highlightIds) return;
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isSelected: n.id === selectedNodeId,
        },
      }))
    );
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        style: {
          ...e.style,
          opacity: highlightIds.has(e.source) && highlightIds.has(e.target) ? 1 : 0.2,
        },
      }))
    );
  }, [highlightIds, selectedNodeId, setNodes, setEdges]);

  const relTypes = summary ? Object.keys(summary.by_relationship_type).sort() : [];
  const compTypes = graphData ? [...new Set(graphData.nodes.map((n) => n.component_type))].sort() : [];
  const evidenceClasses = summary ? Object.keys(summary.by_evidence_class).sort() : [];

  const selectedNode = graphData?.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedNodeDeps = graphData
    ? graphData.edges.filter((e) => e.source === selectedNodeId || e.target === selectedNodeId)
    : [];

  if (apps.length === 0 && !loading) {
    return (
      <>
        <PageHeader title="Dependency Intelligence" breadcrumb={['ReframeX', 'Dependency Intelligence']} />
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent">
            <GitBranch size={28} />
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">No applications to analyze</h2>
          <p className="text-ink-muted max-w-sm">
            Create an application, upload artifacts, and run analysis first. Then discover dependencies to see the interactive graph.
          </p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dependency Intelligence"
        breadcrumb={['ReframeX', 'Dependency Intelligence']}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={activeApp?.id ?? ''}
                onChange={(e) => handleSelectApp(e.target.value)}
                className="inner-glass rounded-pill px-3 py-1.5 pr-8 text-xs font-medium text-ink-muted appearance-none cursor-pointer hover:bg-white/35 transition-colors"
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
            </div>
            <button
              onClick={handleDiscover}
              disabled={discovering || !activeApp}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {discovering ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {discovering ? 'Discovering...' : 'Discover Dependencies'}
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

      <BentoCard className="p-3 mb-5" dense>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <Info size={14} className="text-accent shrink-0" />
          <span>
            Dependencies are discovered from parser-extracted component data — every edge traces to a source artifact and line.
            Solid edges are Evidence-based, dashed are Inferred, dotted are Unknown/unresolved.
          </span>
        </div>
      </BentoCard>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-ink-muted">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : !graphData || graphData.nodes.length === 0 ? (
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto" dense>
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent">
            <Network size={28} />
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">No dependencies discovered yet</h2>
          <p className="text-ink-muted max-w-sm mb-6">
            Run analysis on your artifacts first, then click "Discover Dependencies" to extract relationships between components.
          </p>
          <button
            onClick={handleDiscover}
            disabled={discovering || !activeApp}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-pill bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {discovering ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Discover Dependencies
          </button>
        </BentoCard>
      ) : (
        <div className="space-y-5">
          {/* Summary tiles */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <DepSummaryTile label="Dependencies" value={String(summary.total_dependencies)} icon={<GitBranch size={16} />} />
              <DepSummaryTile label="Nodes" value={String(graphData.total_nodes)} icon={<Boxes size={16} />} />
              <DepSummaryTile label="Unresolved" value={String(summary.unresolved_targets)} icon={<AlertTriangle size={16} />} accent={summary.unresolved_targets > 0} />
              <DepSummaryTile label="Circular" value={String(summary.circular_dependencies)} icon={<RotateCw size={16} />} accent={summary.circular_dependencies > 0} />
              <DepSummaryTile label="Single Points" value={String(summary.single_points)} icon={<Target size={16} />} accent={summary.single_points > 0} />
            </div>
          )}

          {/* Truncation notice */}
          {graphData.truncated && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-tile bg-severity-medium/10 text-severity-medium text-xs">
              <AlertTriangle size={14} />
              <span>
                Graph truncated — showing top {graphData.nodes.length} of {graphData.total_nodes} nodes for performance.
                Use filters and depth control to narrow the view.
              </span>
            </div>
          )}

          {/* Filters bar */}
          <div className="flex flex-wrap items-center gap-3">
            <DepFilterSelect label="Relationship" value={filterRelType} onChange={setFilterRelType} options={relTypes} />
            <DepFilterSelect label="Component Type" value={filterCompType} onChange={setFilterCompType} options={compTypes} />
            <DepFilterSelect label="Evidence" value={filterEvidence} onChange={setFilterEvidence} options={evidenceClasses} />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink-soft">Depth:</span>
              <select
                value={depthFilter}
                onChange={(e) => setDepthFilter(Number(e.target.value))}
                className="inner-glass rounded-pill px-3 py-1.5 pr-8 text-xs font-medium text-ink-muted appearance-none cursor-pointer"
              >
                <option value={0}>All</option>
                <option value={1}>1 level</option>
                <option value={2}>2 levels</option>
                <option value={3}>3 levels</option>
              </select>
              <ChevronDown size={12} className="absolute pointer-events-none text-ink-soft" style={{ marginLeft: '-22px' }} />
            </div>
            <div className="relative flex-1 min-w-[160px] max-w-[280px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                type="text"
                placeholder="Search components..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="inner-glass rounded-pill w-full pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-soft"
              />
            </div>
            <span className="text-xs text-ink-soft ml-auto">{filteredNodeCount} nodes</span>
          </div>

          {/* Main graph + detail drawer layout */}
          <div className="flex gap-5">
            {/* Graph area */}
            <BentoCard className="flex-1 overflow-hidden" dense>
              <div className="relative" style={{ height: '600px' }}>
                <ReactFlowProvider>
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.15 }}
                    minZoom={0.2}
                    maxZoom={2.5}
                    connectionLineType={ConnectionLineType.SmoothStep}
                    defaultEdgeOptions={{ type: 'smoothstep' }}
                    proOptions={{ hideAttribution: true }}
                  >
                    <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#D9C1A2" />
                    <Controls showInteractive={false} />
                    <MiniMap
                      nodeColor={(n) => {
                        const ct = (n.data as { componentType?: string })?.componentType;
                        return TYPE_CONFIG[ct ?? '']?.color ?? '#A89B94';
                      }}
                      maskColor="rgba(255,255,255,0.6)"
                      style={{ background: 'rgba(255,255,255,0.85)', borderRadius: '12px' }}
                    />
                  </ReactFlow>

                  {/* Legend overlay */}
                  <div className="absolute top-3 left-3 z-10 dense-surface rounded-tile px-3 py-2.5 text-xs space-y-1.5" style={{ pointerEvents: 'none' }}>
                    <div className="font-semibold text-ink mb-1.5">Legend</div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-0.5 bg-evidence-based rounded-full" />
                      <span className="text-ink-muted">Evidence-based</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-0.5 border-t-2 border-dashed border-evidence-inferred rounded-full" />
                      <span className="text-ink-muted">Inferred</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-0.5 border-t-2 border-dotted border-evidence-unknown rounded-full" />
                      <span className="text-ink-muted">Unknown/Unresolved</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-solid-border/50">
                      <div className="w-3 h-3 rounded-full" style={{ background: '#E88555' }} />
                      <span className="text-ink-muted">Selected node</span>
                    </div>
                  </div>
                </ReactFlowProvider>
              </div>
            </BentoCard>

            {/* Detail drawer */}
            {selectedNode && (
              <DependencyDetailDrawer
                node={selectedNode}
                deps={selectedNodeDeps}
                impact={impact}
                impactLoading={impactLoading}
                onClose={() => setSelectedNodeId(null)}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DepSummaryTile({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <BentoCard className="p-4" dense>
      <div className="flex items-center justify-between mb-1">
        <span className={accent ? 'text-severity-medium' : 'text-ink-soft'}>{icon}</span>
      </div>
      <div className={`text-2xl font-semibold ${accent ? 'text-severity-medium' : 'text-ink'}`}>{value}</div>
      <div className="text-xs text-ink-soft mt-1">{label}</div>
    </BentoCard>
  );
}

function DepFilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="inner-glass rounded-pill px-3 py-1.5 pr-8 text-xs font-medium text-ink-muted appearance-none cursor-pointer"
      >
        <option value="all">All {label.toLowerCase()}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
    </div>
  );
}

function DependencyDetailDrawer({
  node, deps, impact, impactLoading, onClose,
}: {
  node: GraphNode;
  deps: GraphEdge[];
  impact: ComponentImpact | null;
  impactLoading: boolean;
  onClose: () => void;
}) {
  const incoming = deps.filter((d) => d.target === node.id);
  const outgoing = deps.filter((d) => d.source === node.id);
  const cfg = TYPE_CONFIG[node.component_type] ?? TYPE_CONFIG.UNKNOWN;

  return (
    <div className="w-[380px] shrink-0">
      <div className="dense-surface rounded-bento h-full overflow-y-auto p-5 sticky top-0" style={{ maxHeight: '600px' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-accent">{cfg.icon}</span>
            <div>
              <h2 className="text-lg font-semibold text-ink break-all">{node.name}</h2>
              <p className="text-xs text-ink-soft">{node.component_type} · {node.technology}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/40 shrink-0"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <DepDetail label="Evidence Class" value={node.evidence_class} />
          <DepDetail label="Source File" value={node.source_filename} />
          <DepDetail label="Line Range" value={`${node.line_start}${node.line_end !== node.line_start ? `–${node.line_end}` : ''}`} />
          <DepDetail label="Component ID" value={node.id.substring(0, 12) + '...'} />
        </div>

        <StatusBadge evidence={node.evidence_class as EvidenceClass} />

        {/* Impact analysis */}
        {impactLoading ? (
          <div className="flex items-center gap-2 text-sm text-ink-muted py-4">
            <Loader2 size={14} className="animate-spin" /> Computing impact...
          </div>
        ) : impact ? (
          <div className="mt-4 space-y-3">
            <h3 className="text-xs font-semibold text-ink uppercase tracking-wide flex items-center gap-2">
              <Target size={14} /> Impact Analysis
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <ImpactStat label="Direct Deps" value={impact.direct_dependencies} icon={<GitBranch size={14} />} />
              <ImpactStat label="Upstream" value={impact.upstream_count} icon={<ArrowUpFromDot size={14} />} />
              <ImpactStat label="Downstream" value={impact.downstream_count} icon={<ArrowDownToDot size={14} />} />
              <ImpactStat label="Ind. Upstream" value={impact.indirect_upstream} icon={<ArrowUpFromDot size={14} />} />
              <ImpactStat label="Ind. Downstream" value={impact.indirect_downstream} icon={<ArrowDownToDot size={14} />} />
              <ImpactStat label="Shared" value={impact.shared_components} icon={<Network size={14} />} />
              <ImpactStat label="Depth" value={impact.dependency_depth} icon={<Layers size={14} />} />
              <ImpactStat label="Connected" value={impact.connected_components.length} icon={<Boxes size={14} />} />
            </div>

            {/* Risk indicators */}
            {impact.risk_indicators.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-ink mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-severity-medium" /> Risk Indicators
                </h4>
                <div className="space-y-1.5">
                  {impact.risk_indicators.map((r, i) => (
                    <div key={i} className="text-xs text-severity-medium py-1.5 px-3 rounded-tile bg-severity-medium/10">
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Circular paths */}
            {impact.circular && impact.circular_paths.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-ink mb-2 flex items-center gap-1.5">
                  <RotateCw size={12} className="text-severity-high" /> Circular Paths
                </h4>
                <div className="space-y-1.5">
                  {impact.circular_paths.map((path, i) => (
                    <div key={i} className="text-[11px] font-mono text-ink-muted py-1.5 px-3 rounded-tile bg-white/25 break-all">
                      {path.join(' → ')}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Incoming dependencies */}
        {incoming.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-ink mb-2 uppercase tracking-wide flex items-center gap-2">
              <ArrowDownToDot size={14} /> Incoming ({incoming.length})
            </h3>
            <div className="space-y-1.5">
              {incoming.slice(0, 15).map((d) => (
                <DepEdgeCard key={d.id} edge={d} />
              ))}
              {incoming.length > 15 && (
                <div className="text-xs text-ink-soft text-center py-1">+{incoming.length - 15} more</div>
              )}
            </div>
          </div>
        )}

        {/* Outgoing dependencies */}
        {outgoing.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-ink mb-2 uppercase tracking-wide flex items-center gap-2">
              <ArrowUpFromDot size={14} /> Outgoing ({outgoing.length})
            </h3>
            <div className="space-y-1.5">
              {outgoing.slice(0, 15).map((d) => (
                <DepEdgeCard key={d.id} edge={d} />
              ))}
              {outgoing.length > 15 && (
                <div className="text-xs text-ink-soft text-center py-1">+{outgoing.length - 15} more</div>
              )}
            </div>
          </div>
        )}

        {/* Evidence reference for the node itself */}
        <div className="mt-4 pt-4 border-t border-solid-border/50">
          <h4 className="text-xs font-semibold text-ink mb-2 uppercase tracking-wide">Associated Artifact</h4>
          <div className="text-xs text-ink-muted break-all">{node.source_artifact_id}</div>
        </div>
      </div>
    </div>
  );
}

function DepEdgeCard({ edge }: { edge: GraphEdge }) {
  const isInf = edge.evidence_class === 'Inferred';
  const isUnk = edge.evidence_class === 'Unknown';
  return (
    <div className="px-3 py-2 rounded-tile bg-white/25 border border-solid-border/50">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-accent truncate">{edge.relationship_type}</span>
        <StatusBadge evidence={edge.evidence_class as EvidenceClass} />
      </div>
      {edge.description && (
        <div className="text-[11px] text-ink-muted mb-1">{edge.description}</div>
      )}
      <div className="text-[10px] text-ink-soft">Line {edge.source_line_number}</div>
    </div>
  );
}

function DepDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-ink-soft block">{label}</span>
      <span className="text-sm text-ink font-medium break-all">{value}</span>
    </div>
  );
}

function ImpactStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="px-2.5 py-2 rounded-tile bg-white/25">
      <div className="flex items-center gap-1.5 text-ink-soft mb-0.5">{icon}<span className="text-[10px]">{label}</span></div>
      <div className="text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}
