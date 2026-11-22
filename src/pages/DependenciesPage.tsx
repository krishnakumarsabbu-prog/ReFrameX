import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, MarkerType,
  type Node, type Edge, type Connection, type NodeProps,
  BackgroundVariant, ConnectionLineType, Handle, Position,
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
import { resolveActiveApp, setStoredActiveAppId } from '@/utils/activeApp';
import type { EvidenceClass } from '@/types';

const EVIDENCE_COLORS: Record<string, string> = {
  'Evidence-based': '#059669',
  'Inferred': '#1D4ED8',
  'Assumed': '#B45309',
  'Unknown': '#6D28D9',
};

// Component type → icon + color for graph nodes
const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; group: string }> = {
  PROGRAM: { icon: <Code2 size={14} />, color: '#3478F6', group: 'Programs' },
  MODULE: { icon: <Layers size={14} />, color: '#2563EB', group: 'Programs' },
  COPYBOOK: { icon: <FileSearch size={14} />, color: '#5B8DEF', group: 'Programs' },
  TABLE: { icon: <Database size={14} />, color: '#E9A23B', group: 'Data' },
  DATABASE: { icon: <Database size={14} />, color: '#E9A23B', group: 'Data' },
  FILE: { icon: <FileSearch size={14} />, color: '#64748B', group: 'Data' },
  DATASET: { icon: <Layers size={14} />, color: '#64748B', group: 'Data' },
  JOB: { icon: <Boxes size={14} />, color: '#6B7FA3', group: 'Batch Jobs' },
  PROC: { icon: <Cpu size={14} />, color: '#6B7FA3', group: 'Batch Jobs' },
  TRANSACTION: { icon: <Zap size={14} />, color: '#3478F6', group: 'Transactions & Screens' },
  MAP: { icon: <ScrollText size={14} />, color: '#3478F6', group: 'Transactions & Screens' },
  EXTERNAL_SYSTEM: { icon: <Network size={14} />, color: '#64748B', group: 'External Systems' },
  API: { icon: <Zap size={14} />, color: '#64748B', group: 'Integrations' },
  MQ: { icon: <Zap size={14} />, color: '#64748B', group: 'Integrations' },
  INTERFACE: { icon: <Network size={14} />, color: '#64748B', group: 'Integrations' },
  SECURITY_RESOURCE: { icon: <Shield size={14} />, color: '#6B7FA3', group: 'Security' },
  SCHEDULE: { icon: <RefreshCw size={14} />, color: '#475569', group: 'Batch Jobs' },
  UNKNOWN: { icon: <AlertTriangle size={14} />, color: '#94A3B8', group: 'Other' },
};

const GROUP_ORDER = ['Programs', 'Data', 'Batch Jobs', 'Transactions & Screens', 'Integrations', 'External Systems', 'Security', 'Other'];

// Multi-mode layout engine: Topological Flow (L -> R), Semantic Architecture Tiers, or Category Grid
function layoutNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
  selectedId: string | null,
  depthFilter: number,
  layoutMode: 'flow' | 'tier' | 'grid' = 'flow',
): { nodes: Node[]; edges: Edge[] } {
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

  const filteredEdges = edges.filter(
    (e) => filteredNodes.some((n) => n.id === e.source) && filteredNodes.some((n) => n.id === e.target)
  );

  const COL_WIDTH = 340;
  const ROW_HEIGHT = 100;
  const rfNodes: Node[] = [];

  if (layoutMode === 'flow') {
    // 1. Topological / Dependency Flow layout
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    for (const n of filteredNodes) {
      adj.set(n.id, []);
      inDegree.set(n.id, 0);
    }
    for (const e of filteredEdges) {
      adj.get(e.source)?.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    }

    const layers = new Map<string, number>();
    // Root nodes with in_degree == 0 and outgoing edges
    const roots = filteredNodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0 && (adj.get(n.id)?.length ?? 0) > 0);
    const startingRoots = roots.length > 0 ? roots : (filteredNodes.length > 0 ? [filteredNodes[0]] : []);
    for (const r of startingRoots) {
      layers.set(r.id, 0);
    }

    // Relax depths
    for (let iter = 0; iter < filteredNodes.length; iter++) {
      let updated = false;
      for (const [u, l] of Array.from(layers.entries())) {
        for (const v of adj.get(u) ?? []) {
          const expected = l + 1;
          if ((layers.get(v) ?? -1) < expected) {
            layers.set(v, expected);
            updated = true;
          }
        }
      }
      if (!updated) break;
    }

    // Assign remaining connected or standalone nodes
    for (const n of filteredNodes) {
      if (!layers.has(n.id)) {
        if ((adj.get(n.id)?.length ?? 0) === 0 && (inDegree.get(n.id) ?? 0) === 0) {
          layers.set(n.id, -1);
        } else {
          layers.set(n.id, 0);
        }
      }
    }

    const byLayer = new Map<number, GraphNode[]>();
    for (const n of filteredNodes) {
      const l = layers.get(n.id) ?? 0;
      if (!byLayer.has(l)) byLayer.set(l, []);
      byLayer.get(l)!.push(n);
    }

    const sortedLayerKeys = Array.from(byLayer.keys()).filter((k) => k >= 0).sort((a, b) => a - b);
    sortedLayerKeys.forEach((layerKey, colIdx) => {
      const layerNodes = byLayer.get(layerKey)!;
      layerNodes.sort((a, b) => {
        const orderA = a.component_type.includes('PROGRAM') ? 1 : 2;
        const orderB = b.component_type.includes('PROGRAM') ? 1 : 2;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });

      const totalH = (layerNodes.length - 1) * ROW_HEIGHT;
      const startY = -totalH / 2 + 250;

      layerNodes.forEach((n, rowIdx) => {
        const cfg = TYPE_CONFIG[n.component_type] ?? TYPE_CONFIG.UNKNOWN;
        rfNodes.push({
          id: n.id,
          type: 'glassNode',
          position: { x: colIdx * COL_WIDTH + 80, y: startY + rowIdx * ROW_HEIGHT },
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
      });
    });

    const standaloneNodes = byLayer.get(-1);
    if (standaloneNodes && standaloneNodes.length > 0) {
      const maxY = rfNodes.length > 0 ? Math.max(...rfNodes.map((n) => n.position.y)) : 300;
      standaloneNodes.forEach((n, idx) => {
        const cfg = TYPE_CONFIG[n.component_type] ?? TYPE_CONFIG.UNKNOWN;
        rfNodes.push({
          id: n.id,
          type: 'glassNode',
          position: { x: idx * (COL_WIDTH / 1.5) + 80, y: maxY + 140 },
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
      });
    }
  } else if (layoutMode === 'tier') {
    // 2. Semantic Architecture Tiers:
    // Tier 0: Batch Jobs & Entrypoints (JOB, PROC, SCHEDULE)
    // Tier 1: Core Business Logic (PROGRAM, MODULE)
    // Tier 2: Subroutines & Copybooks (COPYBOOK, API, MQ, INTERFACE)
    // Tier 3: Persistence & Files (TABLE, DATABASE, FILE, DATASET)
    // Tier 4: Transactions & Screens (TRANSACTION, MAP)
    const TIER_MAP: Record<string, number> = {
      JOB: 0, PROC: 0, SCHEDULE: 0,
      PROGRAM: 1, MODULE: 1,
      COPYBOOK: 2, API: 2, MQ: 2, INTERFACE: 2,
      TABLE: 3, DATABASE: 3, FILE: 3, DATASET: 3,
      TRANSACTION: 4, MAP: 4,
      SECURITY_RESOURCE: 4, EXTERNAL_SYSTEM: 4, UNKNOWN: 4,
    };

    const byTier: Record<number, GraphNode[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    for (const n of filteredNodes) {
      const tier = TIER_MAP[n.component_type] ?? 4;
      byTier[tier].push(n);
    }

    let colIdx = 0;
    for (let t = 0; t <= 4; t++) {
      const tierNodes = byTier[t];
      if (!tierNodes || tierNodes.length === 0) continue;
      tierNodes.sort((a, b) => a.name.localeCompare(b.name));
      const totalH = (tierNodes.length - 1) * ROW_HEIGHT;
      const startY = -totalH / 2 + 250;

      tierNodes.forEach((n, rowIdx) => {
        const cfg = TYPE_CONFIG[n.component_type] ?? TYPE_CONFIG.UNKNOWN;
        rfNodes.push({
          id: n.id,
          type: 'glassNode',
          position: { x: colIdx * COL_WIDTH + 80, y: startY + rowIdx * ROW_HEIGHT },
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
      });
      colIdx++;
    }
  } else {
    // 3. Category Grid Columns
    const byGroup: Record<string, GraphNode[]> = {};
    for (const n of filteredNodes) {
      const cfg = TYPE_CONFIG[n.component_type] ?? TYPE_CONFIG.UNKNOWN;
      const group = cfg.group;
      if (!byGroup[group]) byGroup[group] = [];
      byGroup[group].push(n);
    }

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
          position: { x: colIdx * (COL_WIDTH * 0.85) + 60, y: i * ROW_HEIGHT + 60 },
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
  }

  // Filter edges to only those between visible nodes
  const visibleIds = new Set(rfNodes.map((n) => n.id));
  const rfEdges: Edge[] = edges
    .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
    .map((e) => {
      const isInf = e.evidence_class === 'Inferred';
      const isUnk = e.evidence_class === 'Unknown';
      const edgeColor = isUnk ? '#EF4444' : isInf ? '#F59E0B' : '#10B981';
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: isInf,
        style: {
          stroke: edgeColor,
          strokeWidth: 2,
          strokeDasharray: isUnk ? '3 3' : isInf ? '6 4' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: 18,
          height: 18,
        },
        label: e.relationship_type.replace(/\s*\(.*\)/, '').trim(),
        labelStyle: { fontSize: 9.5, fill: '#334155', fontWeight: 600, fontFamily: 'monospace' },
        labelBgStyle: { fill: '#FFFFFF', fillOpacity: 0.95, rx: 4, ry: 4 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
        data: {
          evidenceClass: e.evidence_class,
          description: e.description,
          lineNumber: e.source_line_number,
        },
      };
    });

  return { nodes: rfNodes, edges: rfEdges };
}

// Custom node component for frosted-glass pill nodes WITH REACT FLOW HANDLES
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
          ? '#202124'
          : isUnk
            ? '#F5F3FF'
            : '#FFFFFF',
        borderColor: d.isSelected ? '#C5F45A' : '#E3E5E7',
        boxShadow: d.isSelected
          ? '0 0 0 2px #C5F45A, 0 8px 24px rgba(25,30,35,0.08)'
          : '0 4px 16px rgba(25,30,35,0.04)',
        position: 'relative',
      }}
    >
      {/* Target handle on Left */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-indigo-600 !border-2 !border-white !-left-1.5"
      />
      <div className="rf-node-icon" style={{ color: d.isSelected ? '#C5F45A' : d.color }}>
        {d.icon}
      </div>
      <div className="rf-node-text">
        <div className="rf-node-label" style={{ color: d.isSelected ? '#FFFFFF' : '#202124' }}>
          {d.label}
        </div>
        <div className="rf-node-meta" style={{ color: d.isSelected ? 'rgba(255,255,255,0.75)' : '#777D83' }}>
          {d.componentType}{d.technology ? ` · ${d.technology}` : ''}
        </div>
      </div>
      {/* Source handle on Right */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-indigo-600 !border-2 !border-white !-right-1.5"
      />
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
  const [layoutMode, setLayoutMode] = useState<'flow' | 'tier' | 'grid'>('flow');
  const [showMore, setShowMore] = useState(false);
  const [impact, setImpact] = useState<ComponentImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

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
    setStoredActiveAppId(id);
    localStorage.setItem('reframex_active_app_id', id);
    localStorage.setItem('reframex_user_explicit_app', 'true');
    window.dispatchEvent(new CustomEvent('reframex-app-changed', { detail: { appId: id } }));
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

    const result = layoutNodes(filteredNodes, filteredEdges, selectedNodeId, depthFilter, layoutMode);
    return { layoutResult: result, filteredNodeCount: filteredNodes.length };
  }, [graphData, filterRelType, filterCompType, filterEvidence, searchTerm, selectedNodeId, depthFilter, layoutMode]);

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
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto rounded-2xl border border-[#E3E5E7] bg-white shadow-[0_4px_16px_rgba(25,30,35,0.04)]">
          <div className="w-14 h-14 rounded-2xl bg-[#F1F2F3] border border-[#E3E5E7] flex items-center justify-center mb-4 text-[#202124]">
            <GitBranch size={24} />
          </div>
          <h2 className="text-xl font-medium text-[#202124] mb-2">No applications to analyze</h2>
          <p className="text-sm text-[#777D83] max-w-sm">
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
        breadcrumb={['ReFrameX', 'Dependency Intelligence']}
        action={
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <select
                value={activeApp?.id ?? ''}
                onChange={(e) => handleSelectApp(e.target.value)}
                className="h-9 appearance-none rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] pl-3.5 pr-8 font-mono text-xs font-medium text-[#202124] outline-none transition-all focus:border-[#202124] focus:bg-white"
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#777D83]" />
            </div>
            <button
              onClick={handleDiscover}
              disabled={discovering || !activeApp}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-600/20 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 transition-all"
            >
              {discovering ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {discovering ? 'Discovering...' : 'Discover Dependencies'}
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

      <BentoCard className="p-4 mb-6" dense>
        <div className="flex items-center gap-2.5 text-xs text-[#777D83]">
          <Info size={15} className="text-[#202124] shrink-0" />
          <span>
            Dependencies are discovered from parser-extracted component data — every edge traces to a source artifact and line.
            Solid edges are Evidence-based, dashed are Inferred, dotted are Unknown/unresolved.
          </span>
        </div>
      </BentoCard>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#777D83]">
          <Loader2 size={24} className="animate-spin text-[#202124]" />
        </div>
      ) : !graphData || graphData.nodes.length === 0 ? (
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto rounded-2xl border border-[#E3E5E7] bg-white shadow-[0_4px_16px_rgba(25,30,35,0.04)]" dense>
          <div className="w-14 h-14 rounded-2xl bg-[#F1F2F3] border border-[#E3E5E7] flex items-center justify-center mb-4 text-[#202124]">
            <Network size={24} />
          </div>
          <h2 className="text-xl font-medium text-[#202124] mb-2">No dependencies discovered yet</h2>
          <p className="text-sm text-[#777D83] max-w-sm mb-6">
            Run analysis on your artifacts first, then click "Discover Dependencies" to extract relationships between components.
          </p>
          <button
            onClick={handleDiscover}
            disabled={discovering || !activeApp}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#202124] text-white text-xs font-medium hover:bg-black disabled:opacity-50 transition-colors shadow-sm"
          >
            {discovering ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Discover Dependencies
          </button>
        </BentoCard>
      ) : (
        <div className="space-y-5">
          {/* Summary tiles */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <DepSummaryTile label="Dependencies" value={String(summary.total_dependencies)} icon={<GitBranch size={16} />} color="teal" />
              <DepSummaryTile label="Nodes" value={String(graphData.total_nodes)} icon={<Boxes size={16} />} color="blue" />
              <DepSummaryTile label="Unresolved" value={String(summary.unresolved_targets)} icon={<AlertTriangle size={16} />} color="amber" />
              <DepSummaryTile label="Circular" value={String(summary.circular_dependencies)} icon={<RotateCw size={16} />} color="rose" />
              <DepSummaryTile label="Single Points" value={String(summary.single_points)} icon={<Target size={16} />} color="purple" />
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
              <span className="text-xs text-[#777D83]">Depth:</span>
              <div className="relative">
                <select
                  value={depthFilter}
                  onChange={(e) => setDepthFilter(Number(e.target.value))}
                  className="h-9 rounded-xl border border-[#E3E5E7] bg-white px-3 pr-8 text-xs font-medium text-[#202124] appearance-none cursor-pointer outline-none hover:border-[#202124]/40 focus:border-[#202124] shadow-sm transition-colors"
                >
                  <option value={0}>All</option>
                  <option value={1}>1 level</option>
                  <option value={2}>2 levels</option>
                  <option value={3}>3 levels</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#777D83]" />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#777D83]">Layout:</span>
              <div className="relative">
                <select
                  value={layoutMode}
                  onChange={(e) => setLayoutMode(e.target.value as 'flow' | 'tier' | 'grid')}
                  className="h-9 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 pr-8 text-xs font-semibold text-indigo-950 appearance-none cursor-pointer outline-none hover:border-indigo-400 focus:border-indigo-600 shadow-2xs transition-colors"
                >
                  <option value="flow">Architecture Flow (L → R)</option>
                  <option value="tier">Architectural Tiers</option>
                  <option value="grid">Category Columns</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-indigo-500" />
              </div>
            </div>
            <div className="relative flex-1 min-w-[160px] max-w-[280px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777D83]" />
              <input
                type="text"
                placeholder="Search components..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#E3E5E7] bg-white pl-9 pr-3 text-xs text-[#202124] placeholder:text-[#A0A4A8] outline-none hover:border-[#202124]/40 focus:border-[#202124] shadow-sm transition-colors"
              />
            </div>
            <span className="text-xs text-[#777D83] ml-auto">{filteredNodeCount} nodes</span>
          </div>

          {/* Main graph + detail drawer layout */}
          <div className="flex gap-5">
            {/* Graph area */}
            <BentoCard className="flex-1 overflow-hidden" dense>
              <div className="relative" style={{ height: '600px' }}>
                <ReactFlowProvider>
                  <ReactFlow
                    key={`${activeApp?.id}-${layoutMode}`}
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
                    <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E5EAF1" />
                    <Controls showInteractive={false} />
                    <MiniMap
                      nodeColor={(n) => {
                        const ct = (n.data as { componentType?: string })?.componentType;
                        return TYPE_CONFIG[ct ?? '']?.color ?? '#94A3B8';
                      }}
                      maskColor="rgba(255,255,255,0.6)"
                      style={{ background: '#FFFFFF', borderRadius: '12px' }}
                    />
                  </ReactFlow>

                  {/* Legend overlay */}
                  <div className="absolute top-3 left-3 z-10 rounded-xl border border-[#E3E5E7] bg-white/90 backdrop-blur-md px-3.5 py-3 text-xs space-y-1.5 shadow-sm" style={{ pointerEvents: 'none' }}>
                    <div className="font-medium text-[#202124] mb-1.5">Legend</div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-0.5 bg-emerald-500 rounded-full" />
                      <span className="text-xs text-[#777D83]">Evidence-based</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-0.5 border-t-2 border-dashed border-amber-500 rounded-full" />
                      <span className="text-xs text-[#777D83]">Inferred</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-0.5 border-t-2 border-dotted border-red-500 rounded-full" />
                      <span className="text-xs text-[#777D83]">Unknown/Unresolved</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-[#E3E5E7]">
                      <div className="w-3 h-3 rounded-full" style={{ background: '#E05252' }} />
                      <span className="text-xs text-[#777D83]">Selected node</span>
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

function DepSummaryTile({ label, value, icon, color = 'blue' }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  const colorMap: Record<string, { topBorder: string; iconColor: string }> = {
    blue: { topBorder: 'border-t-4 border-blue-500', iconColor: 'text-blue-600' },
    teal: { topBorder: 'border-t-4 border-teal-500', iconColor: 'text-teal-600' },
    amber: { topBorder: 'border-t-4 border-amber-500', iconColor: 'text-amber-600' },
    rose: { topBorder: 'border-t-4 border-rose-500', iconColor: 'text-rose-600' },
    purple: { topBorder: 'border-t-4 border-purple-500', iconColor: 'text-purple-600' },
  };
  const theme = colorMap[color] || colorMap.blue;

  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs ${theme.topBorder} hover:shadow-sm transition-all`}>
      <div className="mb-2 flex items-center justify-between">
        <span className={theme.iconColor}>{icon}</span>
      </div>
      <div className="font-mono text-2xl font-bold tabular-nums leading-none text-slate-900">{value}</div>
      <div className="mt-2 text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}

function DepFilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 appearance-none rounded-xl border border-[#E3E5E7] bg-white pl-3 pr-7 text-xs font-medium text-[#202124] outline-none hover:border-[#CBD5E1]"
      >
        <option value="all">All {label.toLowerCase()}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={11} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#777D83]" />
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
      <div className="rounded-2xl border border-[#E3E5E7] bg-white shadow-[0_4px_16px_rgba(25,30,35,0.04)] h-full overflow-y-auto p-5 sticky top-0" style={{ maxHeight: '600px' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[#202124]">{cfg.icon}</span>
            <div>
              <h2 className="text-base font-medium text-[#202124] break-all">{node.name}</h2>
              <p className="text-xs text-[#777D83]">{node.component_type} · {node.technology}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#777D83] hover:text-[#202124] hover:bg-[#F1F2F3] shrink-0"><X size={18} /></button>
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
          <div className="flex items-center gap-2 text-sm text-[#777D83] py-4">
            <Loader2 size={14} className="animate-spin text-[#202124]" /> Computing impact...
          </div>
        ) : impact ? (
          <div className="mt-4 space-y-3">
            <h3 className="text-xs font-medium text-[#202124] uppercase tracking-wide flex items-center gap-2">
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
                <h4 className="text-xs font-medium text-[#202124] mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-[#B45309]" /> Risk Indicators
                </h4>
                <div className="space-y-1.5">
                  {impact.risk_indicators.map((r, i) => (
                    <div key={i} className="text-xs text-[#B45309] py-1.5 px-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A]/60">
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Circular paths */}
            {impact.circular && impact.circular_paths.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-[#202124] mb-2 flex items-center gap-1.5">
                  <RotateCw size={12} className="text-[#DC2626]" /> Circular Paths
                </h4>
                <div className="space-y-1.5">
                  {impact.circular_paths.map((path, i) => (
                    <div key={i} className="text-[11px] font-mono text-[#202124] py-1.5 px-3 rounded-xl bg-[#FAFAFA] border border-[#E3E5E7] break-all">
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
            <h3 className="text-xs font-medium text-[#202124] mb-2 uppercase tracking-wide flex items-center gap-2">
              <ArrowDownToDot size={14} /> Incoming ({incoming.length})
            </h3>
            <div className="space-y-1.5">
              {incoming.slice(0, 15).map((d) => (
                <DepEdgeCard key={d.id} edge={d} />
              ))}
              {incoming.length > 15 && (
                <div className="text-xs text-[#A0A4A8] text-center py-1">+{incoming.length - 15} more</div>
              )}
            </div>
          </div>
        )}

        {/* Outgoing dependencies */}
        {outgoing.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-medium text-[#202124] mb-2 uppercase tracking-wide flex items-center gap-2">
              <ArrowUpFromDot size={14} /> Outgoing ({outgoing.length})
            </h3>
            <div className="space-y-1.5">
              {outgoing.slice(0, 15).map((d) => (
                <DepEdgeCard key={d.id} edge={d} />
              ))}
              {outgoing.length > 15 && (
                <div className="text-xs text-[#A0A4A8] text-center py-1">+{outgoing.length - 15} more</div>
              )}
            </div>
          </div>
        )}

        {/* Evidence reference for the node itself */}
        <div className="mt-4 pt-4 border-t border-[#E3E5E7]">
          <h4 className="text-xs font-medium text-[#202124] mb-2 uppercase tracking-wide">Associated Artifact</h4>
          <div className="text-xs text-[#777D83] break-all">{node.source_artifact_id}</div>
        </div>
      </div>
    </div>
  );
}

function DepEdgeCard({ edge }: { edge: GraphEdge }) {
  const isInf = edge.evidence_class === 'Inferred';
  const isUnk = edge.evidence_class === 'Unknown';
  return (
    <div className="px-3.5 py-2.5 rounded-xl bg-[#FAFAFA] border border-[#E3E5E7]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-[#202124] truncate">{edge.relationship_type}</span>
        <StatusBadge evidence={edge.evidence_class as EvidenceClass} />
      </div>
      {edge.description && (
        <div className="text-[11px] text-[#777D83] mb-1">{edge.description}</div>
      )}
      <div className="text-[10px] text-[#A0A4A8]">Line {edge.source_line_number}</div>
    </div>
  );
}

function DepDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-[#A0A4A8] block">{label}</span>
      <span className="text-sm text-[#202124] font-medium break-all">{value}</span>
    </div>
  );
}

function ImpactStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="px-3 py-2 rounded-xl bg-[#FAFAFA] border border-[#E3E5E7]">
      <div className="flex items-center gap-1.5 text-[#A0A4A8] mb-0.5">{icon}<span className="text-[10px] uppercase font-medium">{label}</span></div>
      <div className="text-base font-medium text-[#202124] tabular-nums">{value}</div>
    </div>
  );
}
