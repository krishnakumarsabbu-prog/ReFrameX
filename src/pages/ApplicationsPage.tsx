import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes, Plus, Trash2, Edit3, Check, X, Loader2, AlertCircle,
  Layers, ArrowRight, Sparkles,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BentoCard from '@/components/BentoCard';
import StatusBadge from '@/components/StatusBadge';
import { api, type Application, type ApplicationCreate } from '@/api/client';

const ASSESSMENT_STATUSES = ['Not Started', 'In Progress', 'Complete', 'On Hold'];

export default function ApplicationsPage() {
  const navigate = useNavigate();
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

  async function handleCreate(data: ApplicationCreate, openOverview = false) {
    try {
      const created = await api.createApplication(data);
      await api.updateApplication(created.id, { is_active: true });
      await load();
      setShowCreate(false);
      if (openOverview) {
        navigate(`/applications/${created.id}/overview`);
      }
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
        breadcrumb={['ReFrameX', 'Applications']}
        action={
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/applications/overview')}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E3E5E7] bg-white px-4 py-2 text-xs font-medium text-[#202124] shadow-sm transition-all hover:bg-[#F1F2F3] active:scale-[0.98]"
            >
              <Layers size={14} className="text-[#166534]" /> Application Overview Cockpit
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#202124] px-4 py-2 text-xs font-medium text-white shadow-[0_2px_8px_rgba(25,30,35,0.08)] transition-all hover:bg-[#333538] active:scale-[0.98]"
            >
              <Plus size={14} /> New application
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

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#777D83]">
          <Loader2 size={24} className="animate-spin text-[#202124]" />
        </div>
      ) : apps.length === 0 ? (
        <BentoCard className="mx-auto flex max-w-xl flex-col items-center p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E3E5E7] bg-[#F1F2F3] text-[#202124]">
            <Boxes size={24} />
          </div>
          <h2 className="mb-2 text-xl font-medium tracking-tight text-[#202124]">No applications yet</h2>
          <p className="mb-6 max-w-sm text-xs leading-relaxed text-[#777D83]">
            Create your first mainframe application to start ingesting artifacts and running assessments.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#202124] px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#333538]"
          >
            <Plus size={14} /> Create application
          </button>
        </BentoCard>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => {
            const statusBorder = app.assessment_status === 'Complete'
              ? 'border-t-4 border-emerald-500'
              : app.assessment_status === 'In Progress'
                ? 'border-t-4 border-blue-500'
                : 'border-t-4 border-amber-500';

            return (
              <BentoCard key={app.id} className={`flex flex-col justify-between p-6 ${statusBorder} hover:shadow-md transition-all`}>
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
                    <div>
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => navigate(`/applications/${app.id}/overview`)}
                            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20 hover:scale-105 transition-all"
                          >
                            <Boxes size={20} />
                          </div>
                          <div>
                            <h3
                              onClick={() => navigate(`/applications/${app.id}/overview`)}
                              className="font-mono text-base font-bold text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors"
                            >
                              {app.name}
                            </h3>
                            {app.business_domain && (
                              <p className="text-[11px] font-medium text-slate-500">{app.business_domain}</p>
                            )}
                          </div>
                        </div>
                        {app.is_active && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                            <Check size={10} className="text-emerald-600" /> Active
                          </span>
                        )}
                      </div>

                      <p className="mb-4 min-h-[2.5rem] text-xs leading-relaxed text-slate-600 line-clamp-2">
                        {app.description || 'No description provided.'}
                      </p>

                      <div className="mb-4 grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500">Owner</span>
                          <p className="font-semibold text-slate-800 truncate">{app.owner || '—'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500">Environment</span>
                          <p className="font-semibold text-slate-800 truncate">{app.environment || '—'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500">Stack</span>
                          <p className="font-mono text-[11px] font-semibold text-indigo-700 truncate">{app.technology_stack || '—'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500">Artifacts</span>
                          <p className="font-mono font-bold tabular-nums text-slate-900">{app.artifact_count}</p>
                        </div>
                      </div>

                      {/* Cockpit link button on card */}
                      <button
                        onClick={() => navigate(`/applications/${app.id}/overview`)}
                        className="w-full mb-3 flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/60 px-3.5 py-2 text-xs font-semibold text-indigo-900 hover:bg-gradient-to-r hover:from-indigo-600 hover:to-blue-600 hover:text-white transition-all group shadow-2xs"
                      >
                        <span className="flex items-center gap-2">
                          <Layers size={14} className="text-indigo-600 group-hover:text-white" />
                          Application Overview Cockpit
                        </span>
                        <ArrowRight size={13} className="text-indigo-400 group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>

                  <div className="flex items-center justify-between border-t border-[#E3E5E7] pt-3">
                    <StatusBadge status={app.assessment_status} />
                    <div className="flex items-center gap-1">
                      {!app.is_active && (
                        <button
                          onClick={() => handleSetActive(app.id)}
                          className="rounded-lg p-1.5 text-[#777D83] transition-colors hover:bg-[#F1F2F3] hover:text-[#202124]"
                          title="Set as active"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => setEditing(app.id)}
                        className="rounded-lg p-1.5 text-[#777D83] transition-colors hover:bg-[#F1F2F3] hover:text-[#202124]"
                        title="Edit"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(app.id)}
                        className="rounded-lg p-1.5 text-[#777D83] transition-colors hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {confirmDelete === app.id && (
                    <div className="mt-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3">
                      <p className="mb-2 text-xs font-medium text-[#991B1B]">
                        Delete this application and all its artifacts?
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(app.id)}
                          className="rounded-lg bg-[#DC2626] px-3 py-1 font-mono text-xs font-medium text-white hover:bg-[#B91C1C]"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="rounded-lg border border-[#E3E5E7] bg-white px-3 py-1 font-mono text-xs font-medium text-[#777D83] hover:bg-[#F1F2F3]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </BentoCard>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
    </>
  );
}

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: ApplicationCreate, openOverview?: boolean) => Promise<void> }) {
  const [form, setForm] = useState<ApplicationCreate>({
    name: '', description: '', business_domain: 'Banking & Lending', owner: 'Modernization Assessor',
    technology_stack: 'COBOL, CICS, DB2, JCL', environment: 'Production',
    assessment_status: 'Not Started',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(openOverview = false) {
    if (!form.name.trim()) { setErr('Name is required'); return; }
    setSaving(true);
    setErr(null);
    try {
      await onCreate(form, openOverview);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#202124]/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-[#E3E5E7] bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#202124]">New Application</h2>
            <p className="text-[11px] text-[#777D83]">Create application and proceed directly to Overview Cockpit</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-1 text-[#777D83] hover:bg-[#F1F2F3]"><X size={16} /></button>
        </div>
        {err && <div className="mb-3 text-xs font-medium text-[#991B1B]">{err}</div>}
        <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
          <Field label="Application ID / Name *">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-base font-mono" placeholder="CLAIMS-MGR" />
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
                className="input-base font-mono text-xs" placeholder="COBOL, DB2, CICS" />
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
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-[#E3E5E7] pt-4">
          <button onClick={onClose} className="rounded-xl border border-[#E3E5E7] bg-white px-4 py-2 text-xs font-medium text-[#777D83] hover:bg-[#F1F2F3]">
            Cancel
          </button>
          <button onClick={() => submit(false)} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E3E5E7] bg-white px-3.5 py-2 text-xs font-medium text-[#202124] hover:bg-[#F1F2F3] disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create Only
          </button>
          <button onClick={() => submit(true)} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#202124] px-4 py-2 text-xs font-medium text-white hover:bg-[#333538] disabled:opacity-50 shadow-sm">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Layers size={13} />} Create & Open Overview Cockpit
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
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#202124]">Edit Application</h3>
        <button onClick={onCancel} className="rounded-xl p-1 text-[#777D83] hover:bg-[#F1F2F3]"><X size={14} /></button>
      </div>
      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-base font-mono" placeholder="Name" />
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-base min-h-[50px]" placeholder="Description" />
        <div className="grid grid-cols-2 gap-2.5">
          <input value={form.business_domain} onChange={(e) => setForm({ ...form, business_domain: e.target.value })} className="input-base" placeholder="Domain" />
          <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className="input-base" placeholder="Owner" />
          <input value={form.technology_stack} onChange={(e) => setForm({ ...form, technology_stack: e.target.value })} className="input-base font-mono text-xs" placeholder="Stack" />
          <input value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })} className="input-base" placeholder="Env" />
        </div>
        <select value={form.assessment_status} onChange={(e) => setForm({ ...form, assessment_status: e.target.value })} className="input-base">
          {ASSESSMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2.5 border-t border-[#E3E5E7] pt-3">
        <button onClick={onCancel} className="rounded-xl border border-[#E3E5E7] bg-white px-3.5 py-1.5 text-xs font-medium text-[#777D83] hover:bg-[#F1F2F3]">
          Cancel
        </button>
        <button onClick={async () => { setSaving(true); await onSave(form); setSaving(false); }} disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#202124] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#333538] disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
        </button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-[#777D83]">{label}</span>
      {children}
    </label>
  );
}
