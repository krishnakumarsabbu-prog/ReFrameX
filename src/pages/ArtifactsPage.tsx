import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileSearch, UploadCloud, FolderUp, Loader2, AlertCircle, X,
  Trash2, Download, Filter, Database, FileText, ChevronDown,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import StatusBadge from '@/components/StatusBadge';
import { api, type Application, type Artifact, type ArtifactSummary } from '@/api/client';
import { resolveActiveApp, setStoredActiveAppId } from '@/utils/activeApp';

const SUPPORT_LEVEL_LABELS: Record<string, string> = {
  SUPPORTED_PARSE: 'Supported',
  DETECT_ONLY: 'Detect Only',
  UNSUPPORTED: 'Unsupported',
};

const SUPPORT_LEVEL_BADGE: Record<string, string> = {
  SUPPORTED_PARSE: 'bg-[#F0FDF4] text-[#166534] border-[#DCFCE7]',
  DETECT_ONLY: 'bg-[#FEFCE8] text-[#92400E] border-[#FEF08A]',
  UNSUPPORTED: 'bg-[#F5F3FF] text-[#5B21B6] border-[#DDD6FE]',
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
      const active = resolveActiveApp(data);
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
    setStoredActiveAppId(id);
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
        <PageHeader title="Artifact Explorer" breadcrumb={['ReFrameX', 'Artifact Explorer']} />
        <BentoCard className="mx-auto flex max-w-xl flex-col items-center p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E3E5E7] bg-[#F1F2F3] text-[#202124]">
            <FileSearch size={24} />
          </div>
          <h2 className="mb-2 text-xl font-medium tracking-tight text-[#202124]">No applications to explore</h2>
          <p className="max-w-sm text-xs leading-relaxed text-[#777D83]">
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
        breadcrumb={['ReFrameX', 'Artifact Explorer']}
        action={
          <div className="flex items-center gap-2">
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
          </div>
        }
      />

      {error && (
        <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#991B1B]">
          <AlertCircle size={15} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Upload bar */}
      <BentoCard className="mb-6 p-5 border border-indigo-100 bg-gradient-to-r from-white via-slate-50/60 to-indigo-50/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !activeApp}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-600/20 transition-all hover:from-indigo-700 hover:to-blue-700 active:scale-[0.98] disabled:opacity-50"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={14} />}
              Upload files
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={uploading || !activeApp}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              <FolderUp size={14} className="text-blue-400" /> Upload folder
            </button>
            <button
              onClick={handleImportFolder}
              disabled={uploading || !activeApp}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition-all disabled:opacity-50"
            >
              <Database size={14} className="text-emerald-600" /> Import metadata folder
            </button>
          </div>
          <span className="font-mono text-xs text-slate-500">
            TARGET APP: <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">{activeApp?.name}</span>
          </span>
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
        <div className="mb-6 grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <SummaryTile label="Total Artifacts" value={String(summary.total)} color="blue" />
          <SummaryTile label="Total Size" value={formatSize(summary.total_size_bytes)} color="teal" />
          <SummaryTile label="Categories" value={String(categories.length)} color="purple" />
          <SummaryTile label="Supported" value={String(summary.by_support_level['SUPPORTED_PARSE'] ?? 0)} color="emerald" />
        </div>
      )}

      {/* Filters */}
      {artifacts.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#777D83]">
            <Filter size={13} />
            <span className="font-medium uppercase tracking-[0.08em] text-[10px]">Filter by:</span>
          </div>
          <div className="relative">
            <select
              value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="h-8 appearance-none rounded-xl border border-[#E3E5E7] bg-white pl-3 pr-7 text-xs font-medium text-[#202124] outline-none hover:border-[#CBD5E1]"
            >
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={11} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#777D83]" />
          </div>
          <div className="relative">
            <select
              value={filterSupport} onChange={(e) => setFilterSupport(e.target.value)}
              className="h-8 appearance-none rounded-xl border border-[#E3E5E7] bg-white pl-3 pr-7 text-xs font-medium text-[#202124] outline-none hover:border-[#CBD5E1]"
            >
              <option value="all">All support levels</option>
              <option value="SUPPORTED_PARSE">Supported</option>
              <option value="DETECT_ONLY">Detect Only</option>
              <option value="UNSUPPORTED">Unsupported</option>
            </select>
            <ChevronDown size={11} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#777D83]" />
          </div>
          <span className="ml-auto font-mono text-xs text-[#777D83] tabular-nums">
            {filtered.length} of {artifacts.length} artifacts
          </span>
        </div>
      )}

      {/* Artifact table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#777D83]">
          <Loader2 size={24} className="animate-spin text-[#202124]" />
        </div>
      ) : artifacts.length === 0 ? (
        <BentoCard className="mx-auto flex max-w-xl flex-col items-center p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E3E5E7] bg-[#F1F2F3] text-[#202124]">
            <FileSearch size={24} />
          </div>
          <h2 className="mb-2 text-xl font-medium tracking-tight text-[#202124]">No artifacts yet</h2>
          <p className="max-w-sm text-xs leading-relaxed text-[#777D83]">
            Upload COBOL programs, JCL, copybooks, BMS maps, or other mainframe artifacts to build the inventory.
          </p>
        </BentoCard>
      ) : (
        <BentoCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#E3E5E7] bg-[#F1F2F3]">
                  <th className="px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Filename</th>
                  <th className="px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Category</th>
                  <th className="px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Support</th>
                  <th className="px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Size</th>
                  <th className="px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Encoding</th>
                  <th className="px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Status</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-medium uppercase tracking-[0.06em] text-[#777D83]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E5E7] bg-white">
                {filtered.map((art) => (
                  <tr key={art.id} className="h-12 transition-colors hover:bg-[#F1F2F3]/50">
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setSelectedArtifact(art)}
                        className="flex items-center gap-2 text-left transition-colors hover:text-[#202124]"
                      >
                        <FileText size={14} className="shrink-0 text-[#777D83]" />
                        <span className="font-mono text-xs font-medium text-[#202124] truncate max-w-[240px]">
                          {art.original_filename}
                        </span>
                      </button>
                      {art.relative_path && (
                        <p className="ml-5 font-mono text-[10px] text-[#A0A4A8] truncate max-w-[240px]">{art.relative_path}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-[#777D83]">{art.category}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-lg border px-2 py-0.5 font-mono text-[11px] font-medium leading-none ${SUPPORT_LEVEL_BADGE[art.support_level] ?? ''}`}>
                        {SUPPORT_LEVEL_LABELS[art.support_level] ?? art.support_level}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs tabular-nums text-[#777D83]">{formatSize(art.size_bytes)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-[#777D83]">{art.detected_encoding}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={art.processing_status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedArtifact(art)}
                          className="rounded-lg p-1.5 text-[#777D83] transition-colors hover:bg-[#F1F2F3] hover:text-[#202124]"
                          title="View content"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(art.id)}
                          className="rounded-lg p-1.5 text-[#777D83] transition-colors hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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

function SummaryTile({ label, value, color = 'blue' }: { label: string; value: string; color?: string }) {
  const colorMap: Record<string, { topBorder: string; text: string }> = {
    blue: { topBorder: 'border-t-4 border-blue-500', text: 'text-blue-900' },
    teal: { topBorder: 'border-t-4 border-teal-500', text: 'text-teal-900' },
    purple: { topBorder: 'border-t-4 border-purple-500', text: 'text-purple-900' },
    emerald: { topBorder: 'border-t-4 border-emerald-500', text: 'text-emerald-900' },
    amber: { topBorder: 'border-t-4 border-amber-500', text: 'text-amber-900' },
  };
  const theme = colorMap[color] || colorMap.blue;

  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs ${theme.topBorder} hover:shadow-sm transition-all`}>
      <div className="font-mono text-2xl font-bold leading-none tabular-nums text-slate-900">{value}</div>
      <div className="mt-2 text-xs font-medium text-slate-500">{label}</div>
    </div>
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
    <div className="fixed inset-0 z-50 flex justify-end bg-[#202124]/30 backdrop-blur-sm p-0" onClick={onClose}>
      <div
        className="w-full max-w-2xl h-full overflow-y-auto bg-white border-l border-[#E3E5E7] p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between border-b border-[#E3E5E7] pb-4">
          <div>
            <h2 className="font-mono text-base font-medium text-[#202124]">{artifact.original_filename}</h2>
            {artifact.relative_path && (
              <p className="font-mono text-xs text-[#777D83]">{artifact.relative_path}</p>
            )}
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-[#777D83] hover:bg-[#F1F2F3]"><X size={18} /></button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl border border-[#E3E5E7] bg-[#F1F2F3]/70 p-4 text-xs">
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
          <div className="flex items-center justify-center py-12 text-[#777D83]">
            <Loader2 size={22} className="animate-spin text-[#202124]" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-[#FEF08A] bg-[#FEFCE8] p-4 text-xs font-medium text-[#92400E]">{error}</div>
        ) : (
          <div className="rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] overflow-hidden">
            <div className="border-b border-[#E3E5E7] bg-white px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[#777D83]">
              Source Viewer · UTF-8 Decoded
            </div>
            <pre className="p-4 font-mono text-xs text-[#202124] overflow-x-auto whitespace-pre-wrap max-h-[60vh] leading-relaxed">
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
      <span className="block text-[10px] font-medium uppercase tracking-[0.08em] text-[#777D83]">{label}</span>
      <span className="font-mono text-xs font-normal text-[#202124] break-all">{value}</span>
    </div>
  );
}
