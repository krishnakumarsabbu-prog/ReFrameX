import { useState, useEffect, useCallback } from 'react';
import {
  Boxes, Plus, Trash2, Edit3, Check, X, Loader2, AlertCircle,
  FolderOpen, FileText,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import StatusBadge from '@/components/StatusBadge';
import { api, type Application, type ApplicationCreate } from '@/api/client';

const ASSESSMENT_STATUSES = ['Not Started', 'In Progress', 'Complete', 'On Hold'];

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listApplications();
      setApps(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(data: ApplicationCreate) {
    try {
      await api.createApplication(data);
      await load();
      setShowCreate(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create application');
    }
  }

  async function handleSetActive(id: string) {
    try {
      await api.updateApplication(id, { is_active: true });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set active application');
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteApplication(id);
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete application');
    }
  }

  return (
    <>
      <PageHeader
        title="Applications"
        breadcrumb={['ReframeX', 'Applications']}
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <Plus size={16} /> New application
          </button>
        }
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-tile bg-severity-high/10 text-severity-high text-sm">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-ink-muted">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : apps.length === 0 ? (
        <BentoCard className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent">
            <Boxes size={28} />
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">No applications yet</h2>
          <p className="text-ink-muted mb-6 max-w-sm">
            Create your first mainframe application to start ingesting artifacts and running assessments.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-pill bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <Plus size={16} /> Create application
          </button>
        </BentoCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {apps.map((app) => (
            <BentoCard key={app.id} className="p-6 flex flex-col">
              {editing === app.id ? (
                <EditForm
                  app={app}
                  onSave={async (data) => {
                    await api.updateApplication(app.id, data);
                    setEditing(null);
                    await load();
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center text-accent">
                        <Boxes size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-ink">{app.name}</h3>
                        {app.business_domain && (
                          <p className="text-xs text-ink-soft">{app.business_domain}</p>
                        )}
                      </div>
                    </div>
                    {app.is_active && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[10px] font-medium bg-severity-low/15 text-severity-low">
                        <Check size={10} /> Active
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-ink-muted mb-4 line-clamp-2 min-h-[2rem]">
                    {app.description || 'No description provided.'}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div>
                      <span className="text-ink-soft">Owner</span>
                      <p className="text-ink font-medium">{app.owner || '—'}</p>
                    </div>
                    <div>
                      <span className="text-ink-soft">Environment</span>
                      <p className="text-ink font-medium">{app.environment || '—'}</p>
                    </div>
                    <div>
                      <span className="text-ink-soft">Stack</span>
                      <p className="text-ink font-medium">{app.technology_stack || '—'}</p>
                    </div>
                    <div>
                      <span className="text-ink-soft">Artifacts</span>
                      <p className="text-ink font-medium">{app.artifact_count}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/20">
                    <StatusBadge status={app.assessment_status} />
                    <div className="flex items-center gap-1">
                      {!app.is_active && (
                        <button
                          onClick={() => handleSetActive(app.id)}
                          className="p-1.5 rounded-lg hover:bg-white/30 transition-colors text-ink-muted"
                          title="Set as active"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => setEditing(app.id)}
                        className="p-1.5 rounded-lg hover:bg-white/30 transition-colors text-ink-muted"
                        title="Edit"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(app.id)}
                        className="p-1.5 rounded-lg hover:bg-severity-high/15 transition-colors text-ink-muted hover:text-severity-high"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {confirmDelete === app.id && (
                    <div className="mt-3 p-3 rounded-tile bg-severity-high/10 border border-severity-high/20">
                      <p className="text-xs text-ink mb-2">Delete this application and all its artifacts?</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(app.id)}
                          className="px-3 py-1 rounded-pill bg-severity-high text-white text-xs font-medium hover:opacity-90"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-3 py-1 rounded-pill bg-white/30 text-ink-muted text-xs font-medium hover:bg-white/50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </BentoCard>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
    </>
  );
}

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: ApplicationCreate) => Promise<void> }) {
  const [form, setForm] = useState<ApplicationCreate>({
    name: '', description: '', business_domain: '', owner: '', technology_stack: '', environment: '',
    assessment_status: 'Not Started',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!form.name.trim()) { setErr('Name is required'); return; }
    setSaving(true);
    setErr(null);
    try {
      await onCreate(form);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-strong rounded-bento p-6 w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">New Application</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/30"><X size={16} /></button>
        </div>
        {err && <div className="mb-3 text-xs text-severity-high">{err}</div>}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <Field label="Name *">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-base" placeholder="CLAIMS-MGR" />
          </Field>
          <Field label="Description">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-base min-h-[60px]" placeholder="Brief description of the application" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Business Domain">
              <input value={form.business_domain} onChange={(e) => setForm({ ...form, business_domain: e.target.value })}
                className="input-base" placeholder="Insurance" />
            </Field>
            <Field label="Owner">
              <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })}
                className="input-base" placeholder="Team A" />
            </Field>
            <Field label="Technology Stack">
              <input value={form.technology_stack} onChange={(e) => setForm({ ...form, technology_stack: e.target.value })}
                className="input-base" placeholder="COBOL, DB2, CICS" />
            </Field>
            <Field label="Environment">
              <input value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}
                className="input-base" placeholder="Production" />
            </Field>
          </div>
          <Field label="Assessment Status">
            <select value={form.assessment_status} onChange={(e) => setForm({ ...form, assessment_status: e.target.value })}
              className="input-base">
              {ASSESSMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-white/20">
          <button onClick={onClose} className="px-4 py-2 rounded-pill bg-white/30 text-ink-muted text-sm hover:bg-white/50">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create
          </button>
        </div>
      </div>
    </div>
  );
}

function EditForm({ app, onSave, onCancel }: {
  app: Application;
  onSave: (data: Partial<ApplicationCreate>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: app.name,
    description: app.description || '',
    business_domain: app.business_domain || '',
    owner: app.owner || '',
    technology_stack: app.technology_stack || '',
    environment: app.environment || '',
    assessment_status: app.assessment_status,
  });
  const [saving, setSaving] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink">Edit Application</h3>
        <button onClick={onCancel} className="p-1 rounded-lg hover:bg-white/30"><X size={14} /></button>
      </div>
      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-base" placeholder="Name" />
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-base min-h-[50px]" placeholder="Description" />
        <div className="grid grid-cols-2 gap-2">
          <input value={form.business_domain} onChange={(e) => setForm({ ...form, business_domain: e.target.value })} className="input-base" placeholder="Domain" />
          <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className="input-base" placeholder="Owner" />
          <input value={form.technology_stack} onChange={(e) => setForm({ ...form, technology_stack: e.target.value })} className="input-base" placeholder="Stack" />
          <input value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })} className="input-base" placeholder="Env" />
        </div>
        <select value={form.assessment_status} onChange={(e) => setForm({ ...form, assessment_status: e.target.value })} className="input-base">
          {ASSESSMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-white/20">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-pill bg-white/30 text-ink-muted text-xs hover:bg-white/50">Cancel</button>
        <button onClick={async () => { setSaving(true); await onSave(form); setSaving(false); }} disabled={saving}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
        </button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-ink-soft mb-1 block">{label}</span>
      {children}
    </label>
  );
}
