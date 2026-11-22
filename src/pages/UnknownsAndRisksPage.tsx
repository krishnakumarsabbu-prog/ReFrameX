import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, AlertCircle, X, ChevronDown, ChevronRight,
  AlertTriangle, FileWarning, HelpCircle, CheckCircle2, XCircle,
  Search as SearchIcon,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import StatusBadge from '@/components/StatusBadge';
import {
  api, type Application, type Finding, type UnknownsResponse,
  type ReviewRequest,
} from '@/api/client';
import { resolveActiveApp, setStoredActiveAppId } from '@/utils/activeApp';

const SEVERITY_COLORS: Record<string, string> = {
  high: '#DC2626', medium: '#D97706', low: '#059669', info: '#2563EB',
};

const TYPE_LABELS: Record<string, string> = {
  unsupported_artifact: 'Unsupported Artifact',
  missing_copybook: 'Missing Copybook',
  unresolved_dependency: 'Unresolved Dependency',
  missing_artifact: 'Missing Artifact Type',
  missing_info: 'Missing Information',
  specialist_review: 'Specialist Review',
  unverified_assumption: 'Unverified Assumption',
  rule_firing: 'Rule Finding',
};

export default function UnknownsAndRisksPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [unknowns, setUnknowns] = useState<UnknownsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  const loadApps = useCallback(async () => {
    try {
      const data = await api.listApplications();
      setApps(data);
      setActiveApp(resolveActiveApp(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    }
  }, []);

  const loadUnknowns = useCallback(async (appId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUnknowns(appId);
      setUnknowns(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load unknowns');
      setUnknowns(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);
  useEffect(() => { if (activeApp) loadUnknowns(activeApp.id); }, [activeApp, loadUnknowns]);

  async function handleSelectApp(id: string) {
    setStoredActiveAppId(id);
    try {
      await api.updateApplication(id, { is_active: true });
      await loadApps();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to select application');
    }
  }

  const filtered = useMemo(() => {
    if (!unknowns) return [];
    return unknowns.items.filter((f) => {
      if (filterType && f.finding_type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        return f.title.toLowerCase().includes(q) || f.explanation.toLowerCase().includes(q);
      }
      return true;
    });
  }, [unknowns, filterType, search]);

  const types = useMemo(() => {
    if (!unknowns) return [];
    return Object.keys(unknowns.by_type).sort();
  }, [unknowns]);

  if (apps.length === 0 && !loading) {
    return (
      <>
        <PageHeader title="Unknowns and Risks" breadcrumb={['ReFrameX', 'Risks']} />
        <BentoCard className="mx-auto flex max-w-xl flex-col items-center p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E3E5E7] bg-[#F1F2F3] text-[#202124]">
            <AlertTriangle size={24} />
          </div>
          <h2 className="mb-2 text-xl font-medium text-[#202124]">No applications to analyze</h2>
          <p className="max-w-sm text-xs leading-relaxed text-[#777D83]">
            Create an application and run an assessment to see missing evidence and risks here.
          </p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Unknowns and Risks"
        breadcrumb={['ReFrameX', 'Risks']}
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
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#DC2626]">
          <AlertCircle size={15} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Clinical Evidence Guidance Banner */}
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-blue-50/40 via-white to-indigo-50/40 p-4 shadow-2xs">
        <HelpCircle size={18} className="shrink-0 text-indigo-600 mt-0.5" />
        <div className="text-xs leading-relaxed text-slate-600">
          <span className="font-bold text-indigo-950">Evidence Integrity Principle: </span>
          Missing evidence is never evidence of simplicity. Unsupported artifacts and unresolved dependencies reduce assessment confidence. Each item below should be resolved or reviewed before drawing migration conclusions.
        </div>
      </div>

      {/* Summary by type */}
      {unknowns && unknowns.total > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {types.map((t, idx) => {
            const borders = [
              'border-t-4 border-amber-500',
              'border-t-4 border-rose-500',
              'border-t-4 border-blue-500',
              'border-t-4 border-purple-500',
              'border-t-4 border-teal-500',
            ];
            const borderTheme = borders[idx % borders.length];
            return (
              <div key={t} className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs hover:shadow-sm transition-all ${borderTheme}`}>
                <div className="text-xs font-semibold text-slate-500 mb-1">{TYPE_LABELS[t] ?? t}</div>
                <span className="font-sans text-2xl font-bold tabular-nums text-slate-900">{unknowns.by_type[t]}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Search + filter */}
      <BentoCard className="mb-5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <SearchIcon size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A4A8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search unknowns..."
              className="h-9 w-full rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] pl-9 pr-3 text-xs text-[#202124] placeholder:text-[#A0A4A8] outline-none focus:border-[#202124] focus:bg-white transition-colors"
            />
          </div>
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-9 appearance-none rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] pl-3 pr-8 text-xs font-medium text-[#777D83] outline-none hover:border-[#202124] focus:border-[#202124] transition-colors"
            >
              <option value="">Type: All</option>
              {types.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
            </select>
            <ChevronDown size={11} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A0A4A8]" />
          </div>
        </div>
        <div className="mt-2.5 font-mono text-xs text-[#777D83] tabular-nums">
          Showing {filtered.length} of {unknowns?.total ?? 0} unknown items
        </div>
      </BentoCard>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#777D83]">
          <Loader2 size={24} className="animate-spin text-[#202124]" />
        </div>
      ) : filtered.length === 0 ? (
        <BentoCard className="flex flex-col items-center p-12 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E3E5E7] bg-[#FAFAFA] text-[#166534]">
            <CheckCircle2 size={20} />
          </div>
          <h3 className="mb-1 text-base font-medium text-[#202124]">No unknown items</h3>
          <p className="max-w-sm text-xs text-[#777D83]">
            All evidence has been resolved or no missing-information items were detected.
          </p>
        </BentoCard>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => (
            <UnknownRow key={f.id} finding={f} onClick={() => setSelectedFinding(f)} />
          ))}
        </div>
      )}

      {selectedFinding && (
        <FindingDetailDrawer
          finding={selectedFinding}
          onClose={() => setSelectedFinding(null)}
          onReviewSubmitted={(updated) => {
            if (unknowns) {
              setUnknowns({
                ...unknowns,
                items: unknowns.items.map((f) => f.id === updated.id ? { ...f, ...updated } : f),
              });
            }
            setSelectedFinding((prev) => prev ? { ...prev, ...updated } : prev);
          }}
        />
      )}
    </>
  );
}

function UnknownRow({ finding, onClick }: { finding: Finding; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E3E5E7] bg-white p-3.5 shadow-[0_2px_8px_rgba(25,30,35,0.02)] transition-all hover:border-[#202124] hover:shadow-sm"
    >
      <FileWarning size={16} className="shrink-0 text-[#202124] mt-0.5" />
      <div className="min-w-0 flex-1">
        <span className="text-xs font-medium text-[#202124]">{finding.title}</span>
        <p className="mt-0.5 text-xs text-[#777D83] line-clamp-1">{finding.explanation}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <StatusBadge severity={finding.severity as any} />
        {finding.reviewer_status && (
          <span className="rounded-lg border border-[#E3E5E7] bg-[#F1F2F3] px-2 py-0.5 font-mono text-[10px] font-medium text-[#202124]">
            {finding.reviewer_status}
          </span>
        )}
        <ChevronRight size={13} className="text-[#A0A4A8]" />
      </div>
    </div>
  );
}

function FindingDetailDrawer({ finding, onClose, onReviewSubmitted }: {
  finding: Finding;
  onClose: () => void;
  onReviewSubmitted: (updated: Partial<Finding> & { id: string }) => void;
}) {
  const [reviewAction, setReviewAction] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerRole, setReviewerRole] = useState('Viewer');
  const [reviewReason, setReviewReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function handleSubmitReview() {
    if (!reviewAction) return;
    setSubmitting(true);
    setReviewError(null);
    try {
      const req: ReviewRequest = {
        action: reviewAction,
        reviewer_name: reviewerName || 'architect',
        reviewer_role: reviewerRole,
        reason: reviewReason || undefined,
        notes: reviewNotes || undefined,
      };
      const result = await api.reviewFinding(finding.id, req);
      onReviewSubmitted({
        id: finding.id,
        reviewer_status: result.action,
        reviewer_notes: result.notes ?? null,
      });
      onClose();
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Review failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#202124]/40 backdrop-blur-sm" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-[#E3E5E7] bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between border-b border-[#E3E5E7] pb-4">
          <div>
            <span className="font-mono text-[11px] font-medium text-[#777D83]">UNKNOWN EVIDENCE GAP</span>
            <h2 className="mt-1 text-sm font-medium text-[#202124]">{finding.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[#777D83] hover:bg-[#F1F2F3]"><X size={16} /></button>
        </div>

        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-[#E3E5E7] bg-[#FAFAFA] p-3.5 text-[#202124] leading-relaxed">
            {finding.explanation}
          </div>

          <div className="rounded-2xl border border-[#E3E5E7] bg-white p-4">
            <h4 className="mb-3 font-medium text-[#202124]">Architect Evidence Review</h4>
            {reviewError && <div className="mb-2 text-[#DC2626]">{reviewError}</div>}
            <div className="space-y-2.5">
              <select
                value={reviewAction}
                onChange={(e) => setReviewAction(e.target.value)}
                className="input-base text-xs"
              >
                <option value="">Select action...</option>
                <option value="Resolved">Resolved / Provided missing copybook</option>
                <option value="Accepted">Accepted as known risk</option>
                <option value="Suppressed">False positive / Ignore</option>
              </select>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Notes on resolution or impact assessment..."
                className="input-base text-xs min-h-[60px]"
              />
              <button
                onClick={handleSubmitReview}
                disabled={submitting || !reviewAction}
                className="w-full rounded-xl bg-[#202124] py-2.5 text-xs font-medium text-white shadow-sm hover:bg-black disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Submitting...' : 'Record Resolution'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
