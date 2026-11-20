export type EvidenceClass = 'Evidence-based' | 'Inferred' | 'Assumed' | 'Unknown';

export type Severity = 'high' | 'medium' | 'low' | 'info';

export interface RailItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  tabs?: TabDef[];
}

export interface TabDef {
  id: string;
  label: string;
  filter?: string;
}

export interface KPI {
  id: string;
  label: string;
  value: string;
  unit?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'flat';
  hint?: string;
}

export interface DomainRing {
  id: string;
  label: string;
  shortLabel: string;
  readiness: number; // 0-100
  complexity: number; // 0-100
  components: number;
}

export interface RecentAssessment {
  id: string;
  application: string;
  date: string;
  complexity: number;
  confidence: number;
  readiness: string;
  status: 'Complete' | 'In Progress' | 'Pending';
}

export interface TopRisk {
  id: string;
  component: string;
  application: string;
  severity: Severity;
  category: string;
  evidence: EvidenceClass;
}

export interface RecommendedAction {
  id: string;
  action: string;
  priority: 'High' | 'Medium' | 'Low';
  application: string;
  effort: string;
}

export interface BarDatum {
  label: string;
  value: number;
}

export interface ReadinessSlice {
  label: string;
  value: number;
  color: string;
}
