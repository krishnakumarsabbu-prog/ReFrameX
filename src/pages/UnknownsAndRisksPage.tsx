import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, AlertCircle, X, ChevronDown, ChevronRight,
  AlertTriangle, FileWarning, HelpCircle, CheckCircle2, XCircle,
  Search as SearchIcon,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import {
  api, type Application, type Finding, type UnknownsResponse,
  type ReviewRequest,
} from '@/api/client';

const SEVERITY_COLORS: Record<string, string> = {
  high: '#E88555', medium: '#E8A838', low: '#4D8F86', info: '#8A8A93',
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
      setActiveApp(data.find((a) => a.is_active) ?? data[0] ?? null);
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
        <PageHeader title="Unknowns and Risks" breadcrumb={['ReframeX', 'Risks']} />
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent"><AlertTriangle size={28} /></div>
          <h2 className="text-xl font-semibold text-ink mb-2">No applications to analyze</h2>
          <p className="text-ink-muted max-w-sm">Create an application and run an assessment to see missing evidence and risks here.</p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Unknowns and Risks"
        breadcrumb={['ReframeX', 'Risks']}
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
          </div>
        }
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-tile bg-severity-high/10 text-severity-high text-sm">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Info banner */}
      <BentoCard className="p-4 mb-5" dense>
        <div className="flex items-start gap-3">
          <HelpCircle size={18} className="text-evidence-unknown shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-ink-muted">
              Missing evidence is never evidence of simplicity. Unsupported artifacts and unresolved dependencies reduce assessment confidence.
              Each item below should be resolved or reviewed before drawing migration conclusions.
            </p>
          </div>
        </div>
      </BentoCard>

      {/* Summary by type */}
      {unknowns && unknowns.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
          {types.map((t) => (
            <BentoCard key={t} className="p-4" dense>
              <div className="text-xs font-medium text-ink-muted mb-1">{TYPE_LABELS[t] ?? t}</div>
              <span className="text-2xl font-semibold text-ink">{unknowns.by_type[t]}</span>
            </BentoCard>
          ))}
        </div>
      )}

      {/* Search + filter */}
      <BentoCard className="p-4 mb-5" dense>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search unknowns..."
              className="w-full pl-9 pr-3 py-2 rounded-tile bg-white/30 border border-solid-border/50 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:border-accent/50"
            />
          </div>
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="inner-glass rounded-pill px-3 py-1.5 pr-8 text-xs font-medium text-ink-muted appearance-none cursor-pointer hover:bg-white/35"
            >
              <option value="">Type: All</option>
              {types.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
          </div>
        </div>
        <div className="mt-2 text-xs text-ink-soft">
          {filtered.length} of {unknowns?.total ?? 0} unknown items
        </div>
      </BentoCard>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 size={24} className="animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <BentoCard className="p-12 flex flex-col items-center text-center" dense>
          <div className="w-14 h-14 rounded-2xl bg-severity-low/15 flex items-center justify-center mb-4 text-severity-low"><CheckCircle2 size={24} /></div>
          <h3 className="text-lg font-semibold text-ink mb-2">No unknown items</h3>
          <p className="text-ink-muted max-w-sm">All evidence has been resolved or no missing-information items were detected. Run an assessment to regenerate this list.</p>
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
  const sevColor = SEVERITY_COLORS[finding.severity] ?? '#8A8A93';
  return (
    <BentoCard className="p-3.5" onClick={onClick} dense>
      <div className="flex items-start gap-3">
        <FileWarning size={16} className="text-evidence-unknown shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-ink">{finding.title}</span>
          <p className="text-xs text-ink-soft mt-0.5 truncate">{finding.explanation}</p>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-medium shrink-0" style={{ background: `${sevColor}22`, color: sevColor }}>{finding.severity}</span>
        {finding.reviewer_status && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-medium bg-accent-soft text-accent shrink-0">{finding.reviewer_status}</span>
        )}
        <ChevronRight size={14} className="text-ink-soft shrink-0" />
      </div>
    </BentoCard>
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
        reviewer_name: reviewerName || 'anonymous',
        reviewer_role: reviewerRole,
        reason: reviewReason || undefined,
        notes: reviewNotes || undefined,
      };
      const result = await api.reviewFinding(finding.id, req);
      onReviewSubmitted({
        id: finding.id,
        reviewer_status: result.action,
        reviewer_notes: result.notes ?? null,
        review_actions: [...finding.review_actions, result],
      });
      setReviewAction(''); setReviewReason(''); setReviewNotes('');
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  const sevColor = SEVERITY_COLORS[finding.severity] ?? '#8A8A93';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="dense-surface w-full max-w-xl h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">{finding.title}</h2>
            <span className="text-xs font-mono text-accent">{finding.detection_rule}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/40"><X size={18} /></button>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-medium bg-evidence-unknown/15 text-evidence-unknown">Unknown</span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-medium" style={{ background: `${sevColor}22`, color: sevColor }}>{finding.severity}</span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-medium bg-ink/8 text-ink-muted">{TYPE_LABELS[finding.finding_type] ?? finding.finding_type}</span>
        </div>

        <div className="mb-5">
          <h3 className="text-xs font-semibold text-ink mb-2 uppercase tracking-wide">Explanation</h3>
          <p className="text-sm text-ink-muted">{finding.explanation}</p>
        </div>

        {finding.recommended_action && (
          <div className="mb-5 text-xs text-ink-muted px-3 py-2 rounded-tile bg-severity-low/10">
            <span className="font-medium text-severity-low">Recommended action: </span>{finding.recommended_action}
          </div>
        )}

        {/* Review history */}
        {finding.review_actions.length > 0 && (
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-ink mb-2 uppercase tracking-wide">Review History</h3>
            <div className="space-y-2">
              {finding.review_actions.map((ra) => (
                <div key={ra.id} className="px-3 py-2 rounded-tile bg-white/20 border border-solid-border/40">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-accent">{ra.action}</span>
                    <span className="text-[10px] text-ink-soft">{ra.reviewer_name} ({ra.reviewer_role})</span>
                    <span className="text-[10px] text-ink-soft ml-auto">{new Date(ra.created_at).toLocaleString()}</span>
                  </div>
                  {ra.reason && <p className="text-xs text-ink-muted">Reason: {ra.reason}</p>}
                  {ra.notes && <p className="text-xs text-ink-muted">Notes: {ra.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review form */}
        <div className="mb-5">
          <h3 className="text-xs font-semibold text-ink mb-2 uppercase tracking-wide">Add Reviewer Action</h3>
          {reviewError && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-tile bg-severity-high/10 text-severity-high text-xs">
              <AlertCircle size={14} /> {reviewError}
            </div>
          )}
          <div className="space-y-2 px-3 py-3 rounded-tile bg-white/20">
            <div className="flex items-center gap-2 flex-wrap">
              <select value={reviewAction} onChange={(e) => setReviewAction(e.target.value)} className="inner-glass rounded-pill px-3 py-1.5 text-xs text-ink-muted cursor-pointer">
                <option value="">Select action...</option>
                <option value="add_note">Add note (Viewer+)</option>
                <option value="add_context">Add context (Viewer+)</option>
                <option value="confirm">Confirm (Reviewer)</option>
                <option value="reject">Reject (Reviewer)</option>
                <option value="investigate">Mark for investigation (Reviewer)</option>
              </select>
              <input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} placeholder="Your name" className="px-2 py-1 rounded-tile bg-white/30 text-xs text-ink w-32 border border-solid-border/40" />
              <select value={reviewerRole} onChange={(e) => setReviewerRole(e.target.value)} className="inner-glass rounded-pill px-2 py-1 text-xs text-ink-muted cursor-pointer">
                <option value="Viewer">Viewer</option>
                <option value="Reviewer">Reviewer</option>
              </select>
            </div>
            {(reviewAction === 'reject' || reviewAction === 'investigate') && (
              <input value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} placeholder="Reason (required)" className="w-full px-2 py-1.5 rounded-tile bg-white/30 text-xs text-ink border border-solid-border/40" />
            )}
            <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="w-full px-2 py-1.5 rounded-tile bg-white/30 text-xs text-ink border border-solid-border/40 resize-none" />
            <button
              onClick={handleSubmitReview}
              disabled={!reviewAction || submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Submit Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
