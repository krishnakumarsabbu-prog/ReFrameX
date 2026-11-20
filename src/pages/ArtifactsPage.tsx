import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileSearch, UploadCloud, FolderUp, Loader2, AlertCircle, X,
  Trash2, Download, Filter, Database, FileText, ChevronDown,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import StatusBadge from '@/components/StatusBadge';
import { api, type Application, type Artifact, type ArtifactSummary } from '@/api/client';

const SUPPORT_LEVEL_LABELS: Record<string, string> = {
  SUPPORTED_PARSE: 'Supported',
  DETECT_ONLY: 'Detect Only',
  UNSUPPORTED: 'Unsupported',
};

const SUPPORT_LEVEL_BADGE: Record<string, string> = {
  SUPPORTED_PARSE: 'bg-severity-low/15 text-severity-low',
  DETECT_ONLY: 'bg-severity-medium/15 text-severity-medium',
  UNSUPPORTED: 'bg-evidence-unknown/15 text-evidence-unknown',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ArtifactsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [summary, setSummary] = useState<ArtifactSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSupport, setFilterSupport] = useState<string>('all');
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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

  const loadArtifacts = useCallback(async (appId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [arts, summ] = await Promise.all([
        api.listArtifacts(appId),
        api.artifactSummary(appId),
      ]);
      setArtifacts(arts);
      setSummary(summ);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load artifacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);
  useEffect(() => { if (activeApp) loadArtifacts(activeApp.id); }, [activeApp, loadArtifacts]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !activeApp) return;
    setUploading(true);
    setError(null);
    try {
      await api.uploadArtifacts(activeApp.id, Array.from(files));
      await loadArtifacts(activeApp.id);
      await loadApps();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  }

  async function handleImportFolder() {
    if (!activeApp) return;
    setUploading(true);
    setError(null);
    try {
      const result = await api.importFolder(activeApp.id);
      await loadArtifacts(activeApp.id);
      await loadApps();
      if (result.errors.length > 0 && result.imported === 0) {
        setError(result.errors.join('; '));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteArtifact(id);
      if (activeApp) await loadArtifacts(activeApp.id);
      await loadApps();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function handleSelectApp(id: string) {
    try {
      await api.updateApplication(id, { is_active: true });
      await loadApps();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to select application');
    }
  }

  const categories = summary ? Object.keys(summary.by_category).sort() : [];
  const filtered = artifacts.filter((a) => {
    if (filterCategory !== 'all' && a.category !== filterCategory) return false;
    if (filterSupport !== 'all' && a.support_level !== filterSupport) return false;
    return true;
  });

  if (apps.length === 0 && !loading) {
    return (
      <>
        <PageHeader title="Artifact Explorer" breadcrumb={['ReframeX', 'Artifact Explorer']} />
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent">
            <FileSearch size={28} />
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">No applications to explore</h2>
          <p className="text-ink-muted max-w-sm">
            Create an application first, then upload artifacts to see them here.
          </p>
        </BentoCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Artifact Explorer"
        breadcrumb={['ReframeX', 'Artifact Explorer']}
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
          </div>
        }
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-tile bg-severity-high/10 text-severity-high text-sm">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Upload bar */}
      <BentoCard className="p-4 mb-5" dense>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !activeApp}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
              Upload files
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={uploading || !activeApp}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill inner-glass text-ink-muted text-sm font-medium hover:bg-white/35 disabled:opacity-50 transition-colors"
            >
              <FolderUp size={14} /> Upload folder
            </button>
            <button
              onClick={handleImportFolder}
              disabled={uploading || !activeApp}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill inner-glass text-ink-muted text-sm font-medium hover:bg-white/35 disabled:opacity-50 transition-colors"
            >
              <Database size={14} /> Import metadata folder
            </button>
          </div>
          <input
            ref={fileInputRef} type="file" multiple className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <input
            ref={folderInputRef} type="file" multiple
            // @ts-expect-error webkitdirectory is non-standard but supported by all major browsers
            webkitdirectory=""
            directory=""
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      </BentoCard>

      {/* Summary tiles */}
      {summary && summary.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <SummaryTile label="Total Artifacts" value={String(summary.total)} />
          <SummaryTile label="Total Size" value={formatSize(summary.total_size_bytes)} />
          <SummaryTile label="Categories" value={String(categories.length)} />
          <SummaryTile label="Supported" value={String(summary.by_support_level['SUPPORTED_PARSE'] ?? 0)} />
        </div>
      )}

      {/* Filters */}
      {artifacts.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <Filter size={14} className="text-ink-soft" />
          <div className="relative">
            <select
              value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="inner-glass rounded-pill px-3 py-1.5 pr-8 text-xs font-medium text-ink-muted appearance-none cursor-pointer"
            >
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={filterSupport} onChange={(e) => setFilterSupport(e.target.value)}
              className="inner-glass rounded-pill px-3 py-1.5 pr-8 text-xs font-medium text-ink-muted appearance-none cursor-pointer"
            >
              <option value="all">All support levels</option>
              <option value="SUPPORTED_PARSE">Supported</option>
              <option value="DETECT_ONLY">Detect Only</option>
              <option value="UNSUPPORTED">Unsupported</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
          </div>
          <span className="text-xs text-ink-soft ml-auto">{filtered.length} of {artifacts.length}</span>
        </div>
      )}

      {/* Artifact table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-ink-muted">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : artifacts.length === 0 ? (
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto" dense>
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent">
            <FileSearch size={28} />
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">No artifacts yet</h2>
          <p className="text-ink-muted max-w-sm mb-6">
            Upload COBOL programs, JCL, copybooks, BMS maps, or other mainframe artifacts to build the inventory.
          </p>
        </BentoCard>
      ) : (
        <BentoCard className="overflow-hidden" dense>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-solid-border text-left text-xs text-ink-soft uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Filename</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Support</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="px-4 py-3 font-medium">Encoding</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((art) => (
                  <tr key={art.id} className="border-b border-solid-border/50 hover:bg-white/40 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedArtifact(art)}
                        className="flex items-center gap-2 text-left hover:text-accent transition-colors"
                      >
                        <FileText size={14} className="text-ink-soft shrink-0" />
                        <span className="font-medium text-ink truncate max-w-[240px]">{art.original_filename}</span>
                      </button>
                      {art.relative_path && (
                        <p className="text-[10px] text-ink-soft ml-5 truncate max-w-[240px]">{art.relative_path}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{art.category}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-pill text-xs font-medium ${SUPPORT_LEVEL_BADGE[art.support_level] ?? ''}`}>
                        {SUPPORT_LEVEL_LABELS[art.support_level] ?? art.support_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{formatSize(art.size_bytes)}</td>
                    <td className="px-4 py-3 text-ink-muted text-xs">{art.detected_encoding}</td>
                    <td className="px-4 py-3">
                      <StatusBadge>{art.processing_status}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedArtifact(art)}
                        className="p-1.5 rounded-lg hover:bg-white/40 text-ink-muted inline-flex items-center"
                        title="View content"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(art.id)}
                        className="p-1.5 rounded-lg hover:bg-severity-high/15 text-ink-muted hover:text-severity-high inline-flex items-center"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BentoCard>
      )}

      {selectedArtifact && (
        <ContentDrawer
          artifact={selectedArtifact}
          onClose={() => setSelectedArtifact(null)}
        />
      )}
    </>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <BentoCard className="p-4" dense>
      <div className="text-2xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-ink-soft mt-1">{label}</div>
    </BentoCard>
  );
}

function ContentDrawer({ artifact, onClose }: { artifact: Artifact; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.getArtifactContent(artifact.id);
        if (!cancelled) {
          setContent(data.content);
          if (!data.is_text && !data.content) {
            setError('Binary or EBCDIC content — not displayed. Encoding: ' + data.encoding);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load content');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [artifact.id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="dense-surface w-full max-w-2xl h-full overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
        style={{ borderRadius: 0 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">{artifact.original_filename}</h2>
            {artifact.relative_path && (
              <p className="text-xs text-ink-soft">{artifact.relative_path}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/40"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <Detail label="Category" value={artifact.category} />
          <Detail label="Support Level" value={SUPPORT_LEVEL_LABELS[artifact.support_level] ?? artifact.support_level} />
          <Detail label="Encoding" value={artifact.detected_encoding} />
          <Detail label="Size" value={formatSize(artifact.size_bytes)} />
          <Detail label="SHA-256" value={artifact.sha256.substring(0, 16) + '...'} />
          <Detail label="Fixed Record Length" value={artifact.fixed_record_length_hint ? `${artifact.fixed_record_length_hint} chars` : '—'} />
          <Detail label="Detection Reason" value={artifact.detection_reason ?? '—'} />
          <Detail label="Parse Status" value={artifact.parse_status} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-ink-muted">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4 rounded-tile bg-severity-medium/10 text-severity-medium text-sm">{error}</div>
        ) : (
          <div className="rounded-tile bg-white/60 border border-solid-border overflow-hidden">
            <pre className="p-4 text-xs font-mono text-ink overflow-x-auto whitespace-pre-wrap max-h-[60vh]">
              {content ?? '(empty file)'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-ink-soft block">{label}</span>
      <span className="text-sm text-ink font-medium break-all">{value}</span>
    </div>
  );
}
