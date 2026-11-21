import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, AlertCircle, X, Search, ChevronDown, ChevronRight,
  ScrollText, FileSearch, Filter, FileCode, CheckCircle2, XCircle,
  HelpCircle, MessageSquarePlus, ClipboardList,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import {
  api, type Application, type Finding, type ArtifactContent,
  type ReviewRequest,
} from '@/api/client';

const DOMAIN_LABELS: Record<string, string> = {
  application_business_logic: 'Application & Business Logic',
  data_structures: 'Data Structures',
  database_persistence: 'Database & Persistence',
  jobs_batch_orchestration: 'Jobs, Batch & Orchestration',
  online_transactions_ui: 'Online Transactions & UI',
  integration_external_dependencies: 'Integration & External Dependencies',
  security_controls: 'Security & Controls',
  operational_nonfunctional: 'Operational & Nonfunctional',
};

const EVIDENCE_CLASSES = ['Evidence-based', 'Inferred', 'Assumed', 'Unknown'] as const;
const SEVERITIES = ['high', 'medium', 'low', 'info'] as const;

const SEVERITY_COLORS: Record<string, string> = {
  high: '#E88555', medium: '#E8A838', low: '#4D8F86', info: '#8A8A93',
};
const EVIDENCE_COLORS: Record<string, string> = {
  'Evidence-based': '#5B9E6A', 'Inferred': '#E8A838', 'Assumed': '#C99C6D', 'Unknown': '#A89B94',
};

export default function EvidenceExplorerPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterEvidence, setFilterEvidence] = useState<string>('');
  const [filterDomain, setFilterDomain] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
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

  const loadFindings = useCallback(async (appId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getFindings(appId);
      setFindings(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load findings');
      setFindings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);
  useEffect(() => { if (activeApp) loadFindings(activeApp.id); }, [activeApp, loadFindings]);

  async function handleSelectApp(id: string) {
    try {
      await api.updateApplication(id, { is_active: true });
      await loadApps();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to select application');
    }
  }

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (filterEvidence && f.evidence_class !== filterEvidence) return false;
      if (filterDomain && f.domain !== filterDomain) return false;
      if (filterSeverity && f.severity !== filterSeverity) return false;
      if (search) {
        const q = search.toLowerCase();
        return f.title.toLowerCase().includes(q) ||
          f.explanation.toLowerCase().includes(q) ||
          f.detection_rule.toLowerCase().includes(q) ||
          f.source_filename.toLowerCase().includes(q);
      }
      return true;
    });
  }, [findings, filterEvidence, filterDomain, filterSeverity, search]);

  const evidenceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    findings.forEach((f) => { counts[f.evidence_class] = (counts[f.evidence_class] ?? 0) + 1; });
    return counts;
  }, [findings]);

  const domains = useMemo(() => {
    return [...new Set(findings.map((f) => f.domain))].sort();
  }, [findings]);

  if (apps.length === 0 && !loading) {
    return (
      <>
        <PageHeader title="Evidence Explorer" breadcrumb={['ReframeX', 'Evidence']} />
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent"><ScrollText size={28} /></div>
          <h2 className="text-xl font-semibold text-ink mb-2">No applications to explore</h2>
          <p className="text-ink-muted max-w-sm">Create an application, upload artifacts, run analysis and assessment, then explore the evidence here.</p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Evidence Explorer"
        breadcrumb={['ReframeX', 'Evidence']}
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

      {/* Evidence class summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {EVIDENCE_CLASSES.map((ec) => (
          <BentoCard key={ec} className="p-4" dense>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: EVIDENCE_COLORS[ec] }} />
              <span className="text-xs font-medium text-ink-muted">{ec}</span>
            </div>
            <span className="text-2xl font-semibold text-ink">{evidenceCounts[ec] ?? 0}</span>
          </BentoCard>
        ))}
      </div>

      {/* Search + filters */}
      <BentoCard className="p-4 mb-5" dense>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search findings by title, rule, or source..."
              className="w-full pl-9 pr-3 py-2 rounded-tile bg-white/30 border border-solid-border/50 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:border-accent/50"
            />
          </div>
          <FilterDropdown label="Evidence" value={filterEvidence} options={EVIDENCE_CLASSES as unknown as string[]} onChange={setFilterEvidence} />
          <FilterDropdown label="Domain" value={filterDomain} options={domains} labels={DOMAIN_LABELS} onChange={setFilterDomain} />
          <FilterDropdown label="Severity" value={filterSeverity} options={SEVERITIES as unknown as string[]} onChange={setFilterSeverity} />
          {(filterEvidence || filterDomain || filterSeverity || search) && (
            <button
              onClick={() => { setFilterEvidence(''); setFilterDomain(''); setFilterSeverity(''); setSearch(''); }}
              className="text-xs text-accent hover:underline"
            >Clear filters</button>
          )}
        </div>
        <div className="mt-2 text-xs text-ink-soft">
          {filtered.length} of {findings.length} findings
        </div>
      </BentoCard>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 size={24} className="animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <BentoCard className="p-12 flex flex-col items-center text-center" dense>
          <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mb-4 text-accent"><Filter size={24} /></div>
          <h3 className="text-lg font-semibold text-ink mb-2">No findings match your filters</h3>
          <p className="text-ink-muted max-w-sm">Run an assessment to generate findings, or adjust your search and filter criteria.</p>
        </BentoCard>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => (
            <FindingRow key={f.id} finding={f} onClick={() => setSelectedFinding(f)} />
          ))}
        </div>
      )}

      {selectedFinding && (
        <FindingDrawer
          finding={selectedFinding}
          onClose={() => setSelectedFinding(null)}
          onReviewSubmitted={(updated) => {
            setFindings((prev) => prev.map((f) => f.id === updated.id ? { ...f, ...updated } : f));
            setSelectedFinding((prev) => prev ? { ...prev, ...updated } : prev);
          }}
        />
      )}
    </>
  );
}

function FilterDropdown({ label, value, options, labels, onChange }: {
  label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="inner-glass rounded-pill px-3 py-1.5 pr-8 text-xs font-medium text-ink-muted appearance-none cursor-pointer hover:bg-white/35 transition-colors"
      >
        <option value="">{label}: All</option>
        {options.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
    </div>
  );
}

function FindingRow({ finding, onClick }: { finding: Finding; onClick: () => void }) {
  const sevColor = SEVERITY_COLORS[finding.severity] ?? '#8A8A93';
  const evColor = EVIDENCE_COLORS[finding.evidence_class] ?? '#8A8A93';
  const reviewerBadge = finding.reviewer_status;
  return (
    <BentoCard className="p-3.5" onClick={onClick} dense>
      <div className="flex items-center gap-3">
        <ChevronRight size={14} className="text-ink-soft shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-accent shrink-0">{finding.detection_rule}</span>
            <span className="text-sm font-medium text-ink truncate">{finding.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-ink-soft">
            <span>{DOMAIN_LABELS[finding.domain] ?? finding.domain}</span>
            {finding.source_filename && <span>· {finding.source_filename}</span>}
            {finding.has_line_ref && <span>· Line {finding.line_start}{finding.line_end !== finding.line_start ? `–${finding.line_end}` : ''}</span>}
          </div>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-medium shrink-0" style={{ background: `${evColor}22`, color: evColor }}>{finding.evidence_class}</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-medium shrink-0" style={{ background: `${sevColor}22`, color: sevColor }}>{finding.severity}</span>
        {reviewerBadge && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-medium bg-accent-soft text-accent shrink-0">{reviewerBadge}</span>
        )}
      </div>
    </BentoCard>
  );
}

function FindingDrawer({ finding, onClose, onReviewSubmitted }: {
  finding: Finding;
  onClose: () => void;
  onReviewSubmitted: (updated: Partial<Finding> & { id: string }) => void;
}) {
  const [artifactContent, setArtifactContent] = useState<ArtifactContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [reviewAction, setReviewAction] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerRole, setReviewerRole] = useState('Viewer');
  const [reviewReason, setReviewReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewContext, setReviewContext] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    if (finding.source_artifact_id) {
      setLoadingContent(true);
      api.getArtifactContentWithHighlights(finding.source_artifact_id, finding.id)
        .then((data) => setArtifactContent(data))
        .catch(() => setArtifactContent(null))
        .finally(() => setLoadingContent(false));
    }
  }, [finding.source_artifact_id, finding.id]);

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
        context: reviewContext || undefined,
      };
      const result = await api.reviewFinding(finding.id, req);
      onReviewSubmitted({
        id: finding.id,
        reviewer_status: result.action,
        reviewer_notes: result.notes ?? null,
        review_actions: [...finding.review_actions, result],
      });
      setReviewAction(''); setReviewReason(''); setReviewNotes(''); setReviewContext('');
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  const sevColor = SEVERITY_COLORS[finding.severity] ?? '#8A8A93';
  const evColor = EVIDENCE_COLORS[finding.evidence_class] ?? '#8A8A93';

  const highlightLines = useMemo(() => {
    if (!artifactContent?.highlight_ranges) return new Set<number>();
    const lines = new Set<number>();
    artifactContent.highlight_ranges.forEach((r) => {
      for (let i = r.line_start; i <= r.line_end; i++) lines.add(i);
    });
    return lines;
  }, [artifactContent]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="dense-surface w-full max-w-2xl h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">{finding.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono text-accent">{finding.detection_rule}</span>
              <span className="text-xs text-ink-soft">{DOMAIN_LABELS[finding.domain] ?? finding.domain}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/40"><X size={18} /></button>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-medium" style={{ background: `${evColor}22`, color: evColor }}>{finding.evidence_class}</span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-medium" style={{ background: `${sevColor}22`, color: sevColor }}>{finding.severity}</span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-medium bg-ink/8 text-ink-muted">{finding.finding_type}</span>
          {finding.reviewer_status && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-medium bg-accent-soft text-accent">Reviewed: {finding.reviewer_status}</span>
          )}
        </div>

        {/* Explanation */}
        <Section title="Explanation">
          <p className="text-sm text-ink-muted">{finding.explanation}</p>
        </Section>

        {/* Source info */}
        <Section title="Source">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Meta label="Source file" value={finding.source_filename || 'No source file'} />
            <Meta label="Line reference" value={finding.has_line_ref ? `Line ${finding.line_start}${finding.line_end !== finding.line_start ? `–${finding.line_end}` : ''}` : 'No line reference available'} />
            <Meta label="Detection rule" value={finding.detection_rule} />
            <Meta label="Assessment impact" value={finding.assessment_impact} />
          </div>
          {finding.recommended_action && (
            <div className="mt-3 text-xs text-ink-muted px-3 py-2 rounded-tile bg-severity-low/10">
              <span className="font-medium text-severity-low">Recommended action: </span>{finding.recommended_action}
            </div>
          )}
        </Section>

        {/* Source viewer */}
        {finding.source_artifact_id && (
          <Section title="Source Artifact">
            {loadingContent ? (
              <div className="flex items-center justify-center py-8 text-ink-muted"><Loader2 size={20} className="animate-spin" /></div>
            ) : artifactContent?.is_text && artifactContent.content ? (
              <SourceViewer content={artifactContent.content} highlightLines={highlightLines} finding={finding} />
            ) : artifactContent && !artifactContent.is_text ? (
              <div className="px-3 py-4 rounded-tile bg-white/20 text-xs text-ink-soft text-center">
                <FileCode size={20} className="mx-auto mb-2 text-ink-soft" />
                This artifact is not text-decodable ({artifactContent.encoding}). Source preview is not available.
              </div>
            ) : (
              <div className="px-3 py-4 rounded-tile bg-white/20 text-xs text-ink-soft text-center">Source artifact not found.</div>
            )}
          </Section>
        )}

        {/* Reviewer actions */}
        <Section title="Reviewer Actions">
          {finding.review_actions.length > 0 && (
            <div className="space-y-2 mb-3">
              {finding.review_actions.map((ra) => (
                <div key={ra.id} className="px-3 py-2 rounded-tile bg-white/20 border border-solid-border/40">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-accent">{ra.action}</span>
                    <span className="text-[10px] text-ink-soft">{ra.reviewer_name} ({ra.reviewer_role})</span>
                    <span className="text-[10px] text-ink-soft ml-auto">{new Date(ra.created_at).toLocaleString()}</span>
                  </div>
                  {ra.reason && <p className="text-xs text-ink-muted">Reason: {ra.reason}</p>}
                  {ra.notes && <p className="text-xs text-ink-muted">Notes: {ra.notes}</p>}
                  {ra.context && <p className="text-xs text-ink-muted">Context: {ra.context}</p>}
                </div>
              ))}
            </div>
          )}

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
            {reviewAction === 'add_context' && (
              <textarea value={reviewContext} onChange={(e) => setReviewContext(e.target.value)} placeholder="Context to add" rows={2} className="w-full px-2 py-1.5 rounded-tile bg-white/30 text-xs text-ink border border-solid-border/40 resize-none" />
            )}
            <button
              onClick={handleSubmitReview}
              disabled={!reviewAction || submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Submit Review
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function SourceViewer({ content, highlightLines, finding }: { content: string; highlightLines: Set<number>; finding: Finding }) {
  const lines = content.split('\n');
  const maxLineNum = lines.length;
  const hasHighlight = highlightLines.size > 0;

  return (
    <div className="rounded-tile bg-white/90 border border-solid-border/40 overflow-hidden">
      {hasHighlight && (
        <div className="px-3 py-2 bg-accent-soft/30 border-b border-solid-border/30 text-[11px] text-ink-muted">
          <span className="font-medium text-accent">{finding.detection_rule}</span> fired on {highlightLines.size} line(s).
          {!finding.has_line_ref && ' No line reference available — showing full artifact.'}
        </div>
      )}
      <div className="max-h-[400px] overflow-y-auto font-mono text-[11px]">
        {lines.slice(0, Math.min(maxLineNum, 500)).map((line, i) => {
          const lineNum = i + 1;
          const highlighted = highlightLines.has(lineNum);
          return (
            <div key={i} className={`flex ${highlighted ? 'bg-accent-soft/40' : ''}`}>
              <span className="select-none text-ink-soft w-10 text-right pr-2 shrink-0 border-r border-solid-border/20">{lineNum}</span>
              <span className={`pl-2 whitespace-pre-wrap break-all ${highlighted ? 'text-ink font-medium' : 'text-ink-muted'}`}>{line || ' '}</span>
            </div>
          );
        })}
        {maxLineNum > 500 && <div className="px-3 py-2 text-[10px] text-ink-soft text-center">... {maxLineNum - 500} more lines not shown ...</div>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mb-5"><h3 className="text-xs font-semibold text-ink mb-2 uppercase tracking-wide">{title}</h3>{children}</div>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2.5 py-1.5 rounded-tile bg-white/20">
      <div className="text-[10px] text-ink-soft">{label}</div>
      <div className="text-xs font-medium text-ink">{value}</div>
    </div>
  );
}
